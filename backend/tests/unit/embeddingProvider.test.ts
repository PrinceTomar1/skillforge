import { describe, expect, it, beforeEach, vi } from "vitest";

async function freshProvider() {
  vi.resetModules();
  process.env.EMBEDDING_PROVIDER = "local";
  process.env.OPENAI_API_KEY = "";
  const mod = await import("../../src/services/ai/embeddingProvider");
  return mod.getEmbeddingProvider();
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already L2-normalized by the provider
}

describe("LocalHashEmbeddingProvider (fallback used when no OPENAI_API_KEY is set)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is selected when no OpenAI key is configured, and is clearly labeled as non-semantic", async () => {
    const provider = await freshProvider();
    expect(provider.name).toBe("local-hashing");
    expect(provider.isRealSemanticModel).toBe(false);
  });

  it("produces deterministic vectors for the same input", async () => {
    const provider = await freshProvider();
    const [a] = await provider.embed(["React hooks manage component state"]);
    const [b] = await provider.embed(["React hooks manage component state"]);
    expect(a).toEqual(b);
  });

  it("produces L2-normalized vectors", async () => {
    const provider = await freshProvider();
    const [vec] = await provider.embed(["some lesson content about testing"]);
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("scores lexically similar text as more similar than unrelated text", async () => {
    const provider = await freshProvider();
    const [query] = await provider.embed(["React hooks and component state management"]);
    const [related] = await provider.embed(["Hooks let function components manage state"]);
    const [unrelated] = await provider.embed(["Docker containers package an application with its dependencies"]);

    const simRelated = cosineSimilarity(query, related);
    const simUnrelated = cosineSimilarity(query, unrelated);
    expect(simRelated).toBeGreaterThan(simUnrelated);
  });
});
