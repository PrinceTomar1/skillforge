import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/errors";
import { getLLMProvider, ChatMessage } from "./llmProvider";
import { retrieveRelevantChunks, RetrievedChunk } from "./retrieval";
import { logActivity } from "../activityService";

const HISTORY_WINDOW = 6;

function buildSystemPrompt(courseTitle: string, chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return `You are the SkillForge AI Tutor for the course "${courseTitle}".
No relevant material was found in the course content for this question.
You MUST tell the student, plainly, that you could not find this in the course material,
and that you don't want to guess. You may offer to help if they rephrase or ask about a
topic covered in the course. Do not fabricate course-specific facts.`;
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (lesson: "${c.lessonTitle ?? "General course material"}", relevance: ${c.similarity})\n${c.content}`,
    )
    .join("\n\n---\n\n");

  return `You are the SkillForge AI Tutor for the course "${courseTitle}". Answer the student's
question using ONLY the CONTEXT below, which was retrieved from this course's material.

Rules:
- Ground every factual claim in the context. Do not use outside knowledge to state
  course-specific facts, numbers, definitions, or procedures that aren't supported by it.
- When you use a source, reference it inline like "(Source 1)".
- If the context does not fully answer the question, say so explicitly and answer only
  the part you can support, rather than inventing the rest.
- If the context is irrelevant to the question, tell the student you could not find this
  in the course material rather than guessing.
- Keep answers focused and well-structured. Use short paragraphs or bullet points.
- You may still explain general concepts referenced by the context in your own words, as
  long as the underlying facts come from the context.

CONTEXT:
${context}`;
}

export async function askTutor(params: {
  userId: string;
  courseId: string;
  conversationId?: string;
  message: string;
}): Promise<{
  conversationId: string;
  answer: string;
  sources: Array<{ lessonId: string | null; lessonTitle: string | null; documentTitle: string; similarity: number; preview: string }>;
  aiConfigured: boolean;
}> {
  const { userId, courseId, message } = params;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw ApiError.notFound("Course not found");

  const conversation = params.conversationId
    ? await prisma.aIConversation.findFirst({ where: { id: params.conversationId, userId } })
    : await prisma.aIConversation.create({
        data: { userId, courseId, title: message.slice(0, 60) },
      });

  if (!conversation) throw ApiError.notFound("Conversation not found");

  const history = await prisma.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_WINDOW,
  });
  history.reverse();

  await prisma.aIMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: message },
  });

  const chunks = await retrieveRelevantChunks({ query: message, courseId, topK: 5 });
  const systemPrompt = buildSystemPrompt(course.title, chunks);

  const chatMessages: ChatMessage[] = [
    ...history.map((h): ChatMessage => ({ role: h.role === "USER" ? "user" : "assistant", content: h.content })),
    { role: "user", content: message },
  ];

  const llm = getLLMProvider();
  let answer: string;
  try {
    answer = await llm.generate({ system: systemPrompt, messages: chatMessages, maxTokens: 800 });
  } catch (err) {
    // A provider outage (rate limit, temporary overload, network blip)
    // shouldn't surface as a raw 500 or leave the user's message dangling
    // with no reply — the conversation still gets a real assistant turn,
    // just one that honestly explains generation failed and invites a retry.
    console.error("LLM generation failed:", err);
    answer =
      "The AI provider ran into a temporary error while generating a response (it may be rate-limited or " +
      "experiencing high demand). Your question and the retrieved sources below are saved — please try asking again in a moment.";
  }

  const sources = chunks.map((c) => ({
    lessonId: c.lessonId,
    lessonTitle: c.lessonTitle,
    documentTitle: c.documentTitle,
    similarity: c.similarity,
    preview: c.content.slice(0, 220) + (c.content.length > 220 ? "…" : ""),
  }));

  await prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: answer,
      sources: sources as unknown as object,
    },
  });

  await prisma.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  await logActivity(userId, "AI_TUTOR_USED", courseId, { question: message.slice(0, 120) });

  return { conversationId: conversation.id, answer, sources, aiConfigured: llm.isConfigured };
}

export async function listConversations(userId: string, courseId?: string) {
  return prisma.aIConversation.findMany({
    where: { userId, ...(courseId ? { courseId } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { course: { select: { title: true } }, _count: { select: { messages: true } } },
  });
}

export async function getConversation(userId: string, conversationId: string) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) throw ApiError.notFound("Conversation not found");
  return conversation;
}
