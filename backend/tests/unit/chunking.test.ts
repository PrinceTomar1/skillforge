import { describe, expect, it } from "vitest";
import { chunkText, cleanText, estimateTokenCount } from "../../src/services/ai/chunking";

describe("cleanText", () => {
  it("collapses repeated whitespace but preserves paragraph breaks", () => {
    const raw = "Hello   world.\r\n\r\n\r\nSecond   paragraph.";
    const cleaned = cleanText(raw);
    expect(cleaned).toBe("Hello world.\n\nSecond paragraph.");
  });

  it("trims leading and trailing whitespace", () => {
    expect(cleanText("   padded text   ")).toBe("padded text");
  });
});

describe("chunkText", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const chunks = chunkText("A short lesson about React components and props.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("React components");
  });

  it("splits long text into multiple overlapping chunks", () => {
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(words);
    expect(chunks.length).toBeGreaterThan(1);

    // Chunk size is 220 words with a 40-word overlap, so chunk 1 covers
    // word0..word219 and chunk 2 starts back at word180 — the tail of
    // chunk 1 (its last 40 words) should exactly match the head of chunk 2
    // (its first 40 words).
    const firstChunkWords = chunks[0].content.split(" ");
    const secondChunkWords = chunks[1].content.split(" ");
    expect(firstChunkWords.slice(-40)).toEqual(secondChunkWords.slice(0, 40));
  });

  it("every chunk has a positive token estimate", () => {
    const chunks = chunkText("Some reasonably sized piece of lesson content for testing purposes.");
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }
  });
});

describe("estimateTokenCount", () => {
  it("scales roughly with text length", () => {
    expect(estimateTokenCount("a".repeat(400))).toBe(100);
    expect(estimateTokenCount("")).toBe(0);
  });
});
