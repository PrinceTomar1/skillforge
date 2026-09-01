import { prisma } from "../../lib/prisma";
import { getEmbeddingProvider } from "./embeddingProvider";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  content: string;
  similarity: number;
}

const MIN_SIMILARITY = 0.08;

/**
 * Embeds the query and runs a cosine-similarity nearest-neighbor search
 * (via pgvector's `<=>` operator) over the chunks belonging to one course.
 * This is the "retrieval" half of RAG — kept fully separate from prompt
 * construction and generation so each stage is independently testable.
 */
export async function retrieveRelevantChunks(params: {
  query: string;
  courseId: string;
  topK?: number;
}): Promise<RetrievedChunk[]> {
  const { query, courseId, topK = 5 } = params;

  const provider = getEmbeddingProvider();
  const [queryEmbedding] = await provider.embed([query]);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      content: string;
      documentId: string;
      documentTitle: string;
      lessonId: string | null;
      lessonTitle: string | null;
      similarity: number;
    }>
  >(
    `
    SELECT
      dc.id,
      dc.content,
      dc."documentId" as "documentId",
      d.title as "documentTitle",
      d."lessonId" as "lessonId",
      l.title as "lessonTitle",
      1 - (dc.embedding <=> $1::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc."documentId" = d.id
    LEFT JOIN "Lesson" l ON d."lessonId" = l.id
    WHERE d."courseId" = $2 AND d.status = 'READY' AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    courseId,
    topK,
  );

  return rows
    .filter((r) => r.similarity >= MIN_SIMILARITY)
    .map((r) => ({
      chunkId: r.id,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      content: r.content,
      similarity: Math.round(r.similarity * 1000) / 1000,
    }));
}
