import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/errors";
import { getLLMProvider, isRateLimitError, ChatMessage } from "./llmProvider";
import { retrieveRelevantChunks, RetrievedChunk } from "./retrieval";
import { logActivity } from "../activityService";

const HISTORY_WINDOW = 6;

const GENERIC_PROVIDER_ERROR_MESSAGE =
  "The AI provider ran into a temporary error while generating a response. Your question and the " +
  "retrieved sources below are saved — please try asking again in a moment.";

const RATE_LIMIT_ERROR_MESSAGE =
  "The AI provider's request quota is used up right now — this is an account-level rate/quota limit " +
  "(common on free-tier API keys), not a bug in the app. Retrieval over your course material still " +
  "worked (see the sources below); the answer just couldn't be generated yet. It typically resolves " +
  "once the quota resets, or immediately if billing is enabled on the provider account. Please try " +
  "again shortly.";

function describeProviderFailure(err: unknown): string {
  return isRateLimitError(err) ? RATE_LIMIT_ERROR_MESSAGE : GENERIC_PROVIDER_ERROR_MESSAGE;
}

// A real tutor sitting next to a student doesn't refuse a question just
// because it's not on the syllabus — they answer it, and are honest about
// whether they're reading from the textbook or speaking from general
// knowledge. Retrieved course chunks (when there are any) are the preferred
// source and get used first; general knowledge fills in everything else
// instead of a flat "I don't know." The one thing that never happens is
// passing off a guess as a course fact.
function buildSystemPrompt(courseTitle: string, chunks: RetrievedChunk[]): string {
  const base = `You are a warm, encouraging tutor helping one student work through the course
"${courseTitle}". Talk directly to them, like a real tutor sitting next to them would — in
your own words, in plain conversational sentences, not like a research memo or a Wikipedia
article. Skip markdown headings (#, ##, ###) and skip "(Source 1)"-style inline citation
tags entirely. Use a short bullet list only when you're genuinely walking through several
distinct steps or items; otherwise just write normal paragraphs, the way you'd actually
explain something out loud.

You answer every real question the student asks — you're their tutor, not just a search box
over this one course. Don't refuse or deflect a question just because it falls outside the
syllabus; help with it the way a good tutor would in office hours, even if that means
teaching something adjacent to or beyond the course.`;

  if (chunks.length === 0) {
    return `${base}

You searched the course material for this question and found nothing relevant — so answer
from your own general knowledge instead, as a knowledgeable tutor would, and say plainly
up front that this isn't something covered in the course material specifically (one short
sentence is enough, then just answer normally). Never present a guess as if it were a fact
from the course.`;
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (lesson: "${c.lessonTitle ?? "General course material"}", relevance: ${c.similarity})\n${c.content}`,
    )
    .join("\n\n---\n\n");

  return `${base}

The exact lessons you draw on below are already shown to the student separately under your
answer, so you never need to cite them inline.

- If the CONTEXT below answers the question (fully or partly), ground that part of your
  answer in it — don't invent course-specific facts, numbers, definitions, or procedures
  that aren't in the context.
- If the question goes beyond what's in the CONTEXT, don't stop there — answer the rest
  from your own general knowledge, the way a tutor would when a student asks something a
  bit outside today's material. Just be honest about the boundary: make it clear which part
  is from the course and which part is you explaining beyond it, rather than blending them
  together as if everything came from the course.
- If the CONTEXT doesn't cover the question at all, say so in one short sentence, then
  answer it from general knowledge anyway — never just refuse.

CONTEXT:
${context}`;
}

interface TutorSource {
  lessonId: string | null;
  lessonTitle: string | null;
  documentTitle: string;
  similarity: number;
  preview: string;
}

async function prepareTurn(params: { userId: string; courseId: string; conversationId?: string; message: string }) {
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

  const sources: TutorSource[] = chunks.map((c) => ({
    lessonId: c.lessonId,
    lessonTitle: c.lessonTitle,
    documentTitle: c.documentTitle,
    similarity: c.similarity,
    preview: c.content.slice(0, 220) + (c.content.length > 220 ? "…" : ""),
  }));

  return { conversation, systemPrompt, chatMessages, sources, courseId };
}

async function finalizeTurn(params: { userId: string; conversationId: string; courseId: string; answer: string; sources: TutorSource[]; message: string }) {
  await prisma.aIMessage.create({
    data: {
      conversationId: params.conversationId,
      role: "ASSISTANT",
      content: params.answer,
      sources: params.sources as unknown as object,
    },
  });

  await prisma.aIConversation.update({ where: { id: params.conversationId }, data: { updatedAt: new Date() } });
  await logActivity(params.userId, "AI_TUTOR_USED", params.courseId, { question: params.message.slice(0, 120) });
}

export async function askTutor(params: {
  userId: string;
  courseId: string;
  conversationId?: string;
  message: string;
}): Promise<{
  conversationId: string;
  answer: string;
  sources: TutorSource[];
  aiConfigured: boolean;
}> {
  const { conversation, systemPrompt, chatMessages, sources } = await prepareTurn(params);

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
    answer = describeProviderFailure(err);
  }

  await finalizeTurn({ userId: params.userId, conversationId: conversation.id, courseId: params.courseId, answer, sources, message: params.message });

  return { conversationId: conversation.id, answer, sources, aiConfigured: llm.isConfigured };
}

/**
 * Same pipeline as askTutor, but streams the answer token-by-token via
 * `onChunk` as it's generated instead of waiting for the whole thing. This
 * is what makes the AI Tutor feel like a live conversation rather than a
 * long blocking spinner — generation against a real LLM provider can
 * legitimately take many seconds, and seeing text appear immediately is
 * what tells a user it's actually working.
 */
export async function askTutorStream(
  params: { userId: string; courseId: string; conversationId?: string; message: string },
  onChunk: (text: string) => void,
): Promise<{ conversationId: string; answer: string; sources: TutorSource[]; aiConfigured: boolean }> {
  const { conversation, systemPrompt, chatMessages, sources } = await prepareTurn(params);

  const llm = getLLMProvider();
  let answer: string;
  try {
    answer = await llm.generateStream({ system: systemPrompt, messages: chatMessages, maxTokens: 800 }, onChunk);
  } catch (err) {
    console.error("LLM streaming generation failed:", err);
    answer = describeProviderFailure(err);
    onChunk(answer);
  }

  await finalizeTurn({ userId: params.userId, conversationId: conversation.id, courseId: params.courseId, answer, sources, message: params.message });

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
