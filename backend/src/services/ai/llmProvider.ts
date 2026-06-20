import Anthropic from "@anthropic-ai/sdk";
import { aiIsConfigured, env } from "../../config/env";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateParams {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  generate(params: GenerateParams): Promise<string>;
}

class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly isConfigured = true;
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  async generate({ system, messages, maxTokens = 1024 }: GenerateParams): Promise<string> {
    const response = await this.client.messages.create({
      model: env.anthropicModel,
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
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

  async generate(): Promise<string> {
    return (
      "The AI Tutor is not fully configured yet: no ANTHROPIC_API_KEY was found in the " +
      "backend environment. Retrieval over course material is still working (see the sources " +
      "below), but generating a natural-language answer requires an LLM provider. Set " +
      "AI_PROVIDER=anthropic and ANTHROPIC_API_KEY in backend/.env, then restart the server."
    );
  }
}

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;
  cached = aiIsConfigured ? new AnthropicProvider() : new UnconfiguredProvider();
  return cached;
}
