import OpenAI from "openai";
import crypto from "node:crypto";
import { env, embeddingsUseRealProvider } from "../../config/env";

export interface EmbeddingProvider {
  readonly name: string;
  readonly isRealSemanticModel: boolean;
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Real semantic embeddings via OpenAI. Used whenever OPENAI_API_KEY is configured.
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly isRealSemanticModel = true;
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: env.openaiApiKey });
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: env.embeddingModel,
      input: texts,
      dimensions: env.embeddingDimensions,
    });
    return response.data.map((d) => d.embedding);
  }
}

/**
 * Deterministic local fallback so the full ingestion -> retrieval pipeline
 * runs end-to-end with zero external credentials. This is NOT a semantic
 * model: it is a signed feature-hashing bag-of-words vector (a classic
 * "hashing trick" embedding). It gives lexically similar text meaningfully
 * higher cosine similarity than unrelated text, which is enough to
 * demonstrate a working retrieval pipeline, but it does not capture meaning
 * the way a trained embedding model does. The app is transparent about this
 * distinction everywhere the AI Tutor is shown (see AIProvider.isConfigured).
 */
class LocalHashEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local-hashing";
  readonly isRealSemanticModel = false;
  private dims: number;

  constructor(dims: number) {
    this.dims = dims;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const vector = new Array(this.dims).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);

    for (const token of tokens) {
      const hash = crypto.createHash("sha256").update(token).digest();
      const index = hash.readUInt32BE(0) % this.dims;
      const sign = hash[4] % 2 === 0 ? 1 : -1;
      vector[index] += sign;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / magnitude);
  }
}

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  cached = embeddingsUseRealProvider
    ? new OpenAIEmbeddingProvider()
    : new LocalHashEmbeddingProvider(env.embeddingDimensions);
  return cached;
}
