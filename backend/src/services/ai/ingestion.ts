import { prisma } from "../../lib/prisma";
import { cleanText, chunkText } from "./chunking";
import { getEmbeddingProvider } from "./embeddingProvider";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Full ingestion pipeline for one document: clean -> chunk -> embed -> store.
 * Called for every lesson's learning material (auto-ingested) and for any
 * instructor file upload.
 */
export async function ingestDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.document.update({ where: { id: documentId }, data: { status: "PROCESSING", error: null } });

  try {
    const cleaned = cleanText(document.rawText);
    const chunks = chunkText(cleaned);

    if (chunks.length === 0) {
      await prisma.document.update({ where: { id: documentId }, data: { status: "READY" } });
      return;
    }

    const provider = getEmbeddingProvider();
    const embeddings = await provider.embed(chunks.map((c) => c.content));

    await prisma.documentChunk.deleteMany({ where: { documentId } });

    for (let i = 0; i < chunks.length; i++) {
      const created = await prisma.documentChunk.create({
        data: {
          documentId,
          chunkIndex: i,
          content: chunks[i].content,
          tokenCount: chunks[i].tokenCount,
        },
      });
      await prisma.$executeRawUnsafe(
        `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2`,
        toVectorLiteral(embeddings[i]),
        created.id,
      );
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: "READY" } });
  } catch (err) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Unknown ingestion error" },
    });
    throw err;
  }
}

/**
 * Creates a Document row from lesson content and ingests it immediately.
 * Called whenever an instructor saves lesson material, so the AI Tutor's
 * knowledge stays in sync with what students are actually shown.
 */
export async function ingestLessonContent(lessonId: string): Promise<void> {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });

  if (!lesson.content || lesson.content.trim().length === 0) return;

  const existing = await prisma.document.findFirst({
    where: { lessonId, sourceType: "LESSON_CONTENT" },
  });

  const document = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: { rawText: lesson.content, title: lesson.title, status: "PENDING" },
      })
    : await prisma.document.create({
        data: {
          courseId: lesson.module.courseId,
          lessonId: lesson.id,
          title: lesson.title,
          sourceType: "LESSON_CONTENT",
          rawText: lesson.content,
          status: "PENDING",
        },
      });

  await ingestDocument(document.id);
}

export async function ingestUploadedDocument(params: {
  courseId: string;
  lessonId?: string;
  title: string;
  rawText: string;
}): Promise<string> {
  const document = await prisma.document.create({
    data: {
      courseId: params.courseId,
      lessonId: params.lessonId,
      title: params.title,
      sourceType: "UPLOAD",
      rawText: params.rawText,
      status: "PENDING",
    },
  });
  await ingestDocument(document.id);
  return document.id;
}
