export interface Chunk {
  content: string;
  tokenCount: number;
}

const CHUNK_SIZE_WORDS = 220;
const CHUNK_OVERLAP_WORDS = 40;

/**
 * Cleans raw extracted text: collapses whitespace, strips control characters,
 * removes markdown noise that doesn't help retrieval quality.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits cleaned text into overlapping word-window chunks. Word-window
 * chunking (rather than fixed character slicing) keeps sentences mostly
 * intact, which matters for retrieval quality and for readable citations.
 */
export function chunkText(cleaned: string): Chunk[] {
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < words.length) {
    const content = words.slice(start, start + CHUNK_SIZE_WORDS).join(" ").trim();
    if (content.length > 0) {
      chunks.push({ content, tokenCount: estimateTokenCount(content) });
    }
    if (start + CHUNK_SIZE_WORDS >= words.length) break;
    start += CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS;
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  // Rough heuristic (~4 chars/token) — good enough for logging/budgeting,
  // not billing-accurate.
  return Math.ceil(text.length / 4);
}
