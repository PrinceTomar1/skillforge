import { describe, expect, it, beforeEach, vi } from "vitest";

async function freshProvider(env: { AI_PROVIDER?: string; ANTHROPIC_API_KEY?: string; GEMINI_API_KEY?: string }) {
  vi.resetModules();
  process.env.AI_PROVIDER = env.AI_PROVIDER ?? "";
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY ?? "";
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY ?? "";
  const mod = await import("../../src/services/ai/llmProvider");
  return mod.getLLMProvider();
}

describe("getLLMProvider provider selection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("falls back to the honest unconfigured provider when no provider/key is set", async () => {
    const provider = await freshProvider({});
    expect(provider.name).toBe("none");
    expect(provider.isConfigured).toBe(false);
  });

  it("falls back to unconfigured when AI_PROVIDER is set but the matching key is missing", async () => {
    const anthropicNoKey = await freshProvider({ AI_PROVIDER: "anthropic" });
    expect(anthropicNoKey.name).toBe("none");

    const geminiNoKey = await freshProvider({ AI_PROVIDER: "gemini" });
    expect(geminiNoKey.name).toBe("none");
  });

  it("selects the Anthropic provider when AI_PROVIDER=anthropic and a key is present", async () => {
    const provider = await freshProvider({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-ant-test-key" });
    expect(provider.name).toBe("anthropic");
    expect(provider.isConfigured).toBe(true);
  });

  it("selects the Gemini provider when AI_PROVIDER=gemini and a key is present", async () => {
    const provider = await freshProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-gemini-key" });
    expect(provider.name).toBe("gemini");
    expect(provider.isConfigured).toBe(true);
  });

  it("the unconfigured provider's message mentions both supported providers, not just one", async () => {
    const provider = await freshProvider({});
    const message = await provider.generate({ system: "", messages: [] });
    expect(message).toContain("AI_PROVIDER=anthropic");
    expect(message).toContain("AI_PROVIDER=gemini");
  });
});
