import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/errors";
import { assertOwnsCourse } from "./courseService";
import { ingestUploadedDocument } from "./ai/ingestion";

async function extractText(file: Express.Multer.File): Promise<string> {
  if (file.mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(file.buffer);
    return result.text;
  }
  return file.buffer.toString("utf-8");
}

export async function uploadCourseDocument(params: {
  instructorId: string;
  courseId: string;
  lessonId?: string;
  file: Express.Multer.File;
}) {
  await assertOwnsCourse(params.instructorId, params.courseId);

  const allowed = ["application/pdf", "text/plain", "text/markdown"];
  if (!allowed.includes(params.file.mimetype) && !params.file.originalname.match(/\.(pdf|txt|md)$/i)) {
    throw ApiError.badRequest("Only PDF, TXT, or Markdown files are supported.");
  }

  const rawText = await extractText(params.file);
  if (rawText.trim().length < 20) {
    throw ApiError.badRequest("Could not extract meaningful text from this file.");
  }

  const documentId = await ingestUploadedDocument({
    courseId: params.courseId,
    lessonId: params.lessonId,
    title: params.file.originalname,
    rawText,
  });

  return prisma.document.findUniqueOrThrow({ where: { id: documentId } });
}

export async function listCourseDocuments(courseId: string) {
  return prisma.document.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    include: { lesson: { select: { title: true } }, _count: { select: { chunks: true } } },
  });
}

export async function deleteDocument(instructorId: string, documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  await assertOwnsCourse(instructorId, document.courseId);
  await prisma.document.delete({ where: { id: documentId } });
}
