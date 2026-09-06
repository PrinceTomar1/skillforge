import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateParams {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

// Bounds any SDK call so a request can never hang forever. Seen in
// production on Render's free tier: the non-streaming Gemini call would
// occasionally just never resolve or reject (no error of its own), which
// hung the whole request instead of falling through to the honest error
// message below.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export interface LLMProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  generate(params: GenerateParams): Promise<string>;
  /**
   * Streams the answer as it's generated, calling `onChunk` with each new
   * piece of text as it arrives, and resolves with the full assembled text
   * once generation finishes. This is what makes the AI Tutor feel like a
   * real live conversation instead of a single multi-second blocking wait —
   * time-to-first-token is what the user actually perceives as "working."
   */
  generateStream(params: GenerateParams, onChunk: (text: string) => void): Promise<string>;
}

class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly isConfigured = true;
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  async generate({ system, messages, maxTokens = 1024 }: GenerateParams): Promise<string> {
    const response = await withTimeout(
      this.client.messages.create({
        model: env.anthropicModel,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
      60000,
      "Anthropic generate",
    );

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
  }

  async generateStream({ system, messages, maxTokens = 1024 }: GenerateParams, onChunk: (text: string) => void): Promise<string> {
    const stream = this.client.messages.stream({
      model: env.anthropicModel,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    stream.on("text", (text) => onChunk(text));
    const finalMessage = await stream.finalMessage();
    const textBlock = finalMessage.content.find((block) => block.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
  }
}

class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  readonly isConfigured = true;
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }

  private buildRequest(system: string, messages: ChatMessage[], maxTokens: number) {
    return {
      model: env.geminiModel,
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: system,
        // The SDK retries 5xx/429 responses up to 5 times by default with
        // exponential backoff, which can turn a single overloaded-model
        // error into a ~45s hang before the caller ever finds out. One
        // quick retry still absorbs a genuinely transient blip; anything
        // past that should surface promptly so the honest fallback message
        // (see tutorService/generation catch blocks) shows up fast instead
        // of the user staring at a spinner for the better part of a minute.
        httpOptions: { retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2 } },
        // Gemini's "thinking" models spend part of the output token budget
        // on internal reasoning before the visible answer, which can
        // silently truncate short responses if the budget is too tight.
        // (thinkingConfig.thinkingBudget: 0 would disable it outright, but
        // not every model in this family accepts that value, so the safer
        // fix is giving enough headroom for both thinking and the answer.)
        maxOutputTokens: maxTokens * 4,
      },
    };
  }

  // Deliberately implemented on top of generateContentStream rather than
  // the SDK's non-streaming generateContent. In production behind Render,
  // the non-streaming call would sometimes just hang with no error — the
  // streaming call never did, so this route calls it internally and
  // discards the per-chunk callback rather than exposing that failure mode
  // to every non-streaming caller (AI Tutor "ask", study resources, quiz
  // generation).
  async generate(params: GenerateParams): Promise<string> {
    return withTimeout(this.generateStream(params, () => {}), 60000, "Gemini generate");
  }

  async generateStream({ system, messages, maxTokens = 1024 }: GenerateParams, onChunk: (text: string) => void): Promise<string> {
    const stream = await this.client.models.generateContentStream(this.buildRequest(system, messages, maxTokens));
    let full = "";
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        full += text;
        onChunk(text);
      }
    }
    return full;
  }
}

/**
 * Used only when no AI_PROVIDER credential is configured. It never
 * fabricates a real answer — it returns a clear, honest message so the
 * rest of the product (routes, UI, retrieval pipeline) is fully testable
 * without pretending an LLM call happened.
 */
class UnconfiguredProvider implements LLMProvider {
  readonly name = "none";
  readonly isConfigured = false;

  private message(): string {
    return (
      "The AI Tutor is not fully configured yet: no LLM provider credential was found in the " +
      "backend environment. Retrieval over course material is still working (see the sources " +
      "below), but generating a natural-language answer requires an LLM provider. Set " +
      "AI_PROVIDER=anthropic (with ANTHROPIC_API_KEY) or AI_PROVIDER=gemini (with GEMINI_API_KEY) " +
      "in backend/.env, then restart the server."
    );
  }

  async generate(): Promise<string> {
    return this.message();
  }

  async generateStream(_params: GenerateParams, onChunk: (text: string) => void): Promise<string> {
    const text = this.message();
    onChunk(text);
    return text;
  }
}

/**
 * Both the Anthropic and Gemini SDKs expose a numeric `.status` on thrown
 * API errors. 429 covers both "too many requests per second" and, for
 * Gemini's free tier specifically, a hard per-day request quota per model
 * (as low as 20/day) — an account-level limit, not a bug. Distinguishing
 * this from a generic failure lets the honest fallback message actually
 * say what happened instead of a vague "temporary error."
 */
export function isRateLimitError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status?: unknown }).status === 429;
}

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  if (env.aiProvider === "anthropic" && env.anthropicApiKey.length > 0) {
    cached = new AnthropicProvider();
  } else if (env.aiProvider === "gemini" && env.geminiApiKey.length > 0) {
    cached = new GeminiProvider();
  } else {
    cached = new UnconfiguredProvider();
  }
  return cached;
}
