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

function buildSystemPrompt(courseTitle: string, chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return `You are a warm, patient tutor helping a student in the course "${courseTitle}".
Talk to them directly and naturally, the way a good human tutor would in office hours — not
like a formal report. You searched the course material and genuinely couldn't find anything
relevant to this question. Tell them that plainly and kindly: say you don't see this covered
in the course material, so you don't want to guess and risk telling them something wrong.
Invite them to rephrase, or ask about something you know is in the course. Never invent
course-specific facts to fill the gap — a short, honest "I couldn't find this" beats a
confident-sounding guess.`;
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (lesson: "${c.lessonTitle ?? "General course material"}", relevance: ${c.similarity})\n${c.content}`,
    )
    .join("\n\n---\n\n");

  return `You are a warm, encouraging tutor helping one student work through the course
"${courseTitle}". Talk directly to them, like a real tutor sitting next to them would —
in your own words, in plain conversational sentences, not like a research memo or a
Wikipedia article. Skip markdown headings (#, ##, ###) and skip "(Source 1)"-style inline
citation tags entirely — the exact lessons you drew on are already shown to the student
separately below your answer, so you never need to cite them inline. Use a short bullet
list only when you're genuinely walking through several distinct steps or items; otherwise
just write normal paragraphs, the way you'd actually explain something out loud.

What must stay true even though the tone is casual:
- Every factual claim about the course has to come from the CONTEXT below. Don't reach for
  outside knowledge to state course-specific facts, numbers, definitions, or procedures.
- If the context only partly answers the question, say so honestly and answer the part you
  can, rather than filling in the rest from a guess.
- If the context genuinely doesn't cover what they asked, tell them straightforwardly that
  you didn't find it in the course material — don't dress up a guess as an answer.
- It's fine to explain a concept from the context in your own words, or connect it to how a
  student might think about it, as long as the underlying facts are grounded in the context.

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
