import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/errors";
import { getLLMProvider } from "./llmProvider";
import { logActivity } from "../activityService";

const MAX_CONTEXT_CHUNKS = 24;

/**
 * Study-resource generation needs "all the material for this known scope"
 * (a lesson, or the whole course), not a similarity search against a guessed
 * query — unlike the AI Tutor, there's no real user question to match
 * against here. Fetching chunks directly by scope avoids the failure mode
 * where a generic synthetic query scores below the retrieval similarity
 * threshold and silently returns nothing, even though the material exists
 * and was successfully ingested.
 */
async function buildContext(courseId: string, lessonId: string | undefined): Promise<string> {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        status: "READY",
        courseId,
        ...(lessonId ? { lessonId } : {}),
      },
    },
    orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
    take: MAX_CONTEXT_CHUNKS,
    select: { content: true },
  });

  return chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{") === -1 ? candidate.indexOf("[") : candidate.indexOf("{");
  const jsonSlice = start >= 0 ? candidate.slice(start) : candidate;
  try {
    return JSON.parse(jsonSlice);
  } catch {
    throw ApiError.internal("The AI returned a response that could not be parsed as structured data. Please try again.");
  }
}

const flashcardsSchema = z.object({ flashcards: z.array(z.object({ front: z.string(), back: z.string() })).min(1) });
const summarySchema = z.object({ summary: z.string(), keyTakeaways: z.array(z.string()) });
const keyConceptsSchema = z.object({
  concepts: z.array(z.object({ term: z.string(), definition: z.string() })).min(1),
});
const studyPlanSchema = z.object({
  plan: z.array(z.object({ day: z.number(), focus: z.string(), tasks: z.array(z.string()) })).min(1),
});
const revisionNotesSchema = z.object({ sections: z.array(z.object({ heading: z.string(), points: z.array(z.string()) })).min(1) });
const practiceQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()).length(4),
        correctOption: z.number().min(0).max(3),
        explanation: z.string(),
      }),
    )
    .min(1),
});

type ResourceType = "SUMMARY" | "FLASHCARDS" | "PRACTICE_QUESTIONS" | "KEY_CONCEPTS" | "STUDY_PLAN" | "REVISION_NOTES";

const PROMPTS: Record<ResourceType, { instruction: string; schema: z.ZodTypeAny }> = {
  SUMMARY: {
    instruction:
      'Write a concise summary of the material and 4-6 key takeaways. Respond with strict JSON: {"summary": string, "keyTakeaways": string[]}.',
    schema: summarySchema,
  },
  FLASHCARDS: {
    instruction:
      'Create 8 study flashcards from the material. Respond with strict JSON: {"flashcards": [{"front": string, "back": string}]}.',
    schema: flashcardsSchema,
  },
  KEY_CONCEPTS: {
    instruction:
      'Extract the 6-10 most important concepts with a one-sentence definition each. Respond with strict JSON: {"concepts": [{"term": string, "definition": string}]}.',
    schema: keyConceptsSchema,
  },
  STUDY_PLAN: {
    instruction:
      'Design a 5-day study plan covering this material. Respond with strict JSON: {"plan": [{"day": number, "focus": string, "tasks": string[]}]}.',
    schema: studyPlanSchema,
  },
  REVISION_NOTES: {
    instruction:
      'Write structured revision notes grouped under short headings with bullet points. Respond with strict JSON: {"sections": [{"heading": string, "points": string[]}]}.',
    schema: revisionNotesSchema,
  },
  PRACTICE_QUESTIONS: {
    instruction:
      'Write 5 multiple-choice practice questions (4 options each, one correct) grounded in the material. Respond with strict JSON: {"questions": [{"prompt": string, "options": string[4], "correctOption": number, "explanation": string}]}.',
    schema: practiceQuestionsSchema,
  },
};

export async function generateStudyResource(params: {
  userId: string;
  courseId: string;
  lessonId?: string;
  type: ResourceType;
}): Promise<{ aiConfigured: boolean; resource: unknown; message?: string }> {
  const llm = getLLMProvider();
  const course = await prisma.course.findUnique({ where: { id: params.courseId } });
  if (!course) throw ApiError.notFound("Course not found");

  if (!llm.isConfigured) {
    return {
      aiConfigured: false,
      resource: null,
      message:
        "AI generation is not configured on this server (no LLM provider credential found). Set AI_PROVIDER + a matching API key in backend/.env and restart to enable this feature.",
    };
  }

  const lesson = params.lessonId ? await prisma.lesson.findUnique({ where: { id: params.lessonId } }) : null;
  const focusLabel = lesson ? `${course.title} — ${lesson.title}` : course.title;
  const context = await buildContext(params.courseId, params.lessonId);

  if (!context.trim()) {
    return {
      aiConfigured: true,
      resource: null,
      message: "No ingested course material was found yet for this scope, so a grounded resource can't be generated.",
    };
  }

  const { instruction, schema } = PROMPTS[params.type];
  const system = `You are an instructional designer generating study material for the course "${focusLabel}".
Base your output strictly on the provided course material. Do not invent facts that aren't
supported by it. Respond with ONLY valid JSON matching the requested shape — no prose, no
markdown fences.`;
  const userPrompt = `COURSE MATERIAL:\n${context}\n\nTASK: ${instruction}`;

  const raw = await llm.generate({ system, messages: [{ role: "user", content: userPrompt }], maxTokens: 1600 });
  const parsed = schema.parse(extractJson(raw));

  const saved = await prisma.studyResource.create({
    data: {
      userId: params.userId,
      courseId: params.courseId,
      lessonId: params.lessonId,
      type: params.type,
      title: `${prettyType(params.type)} — ${focusLabel}`,
      content: parsed as object,
    },
  });

  await logActivity(params.userId, "RESOURCE_GENERATED", params.courseId, { type: params.type });

  return { aiConfigured: true, resource: saved };
}

function prettyType(type: ResourceType): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export async function listStudyResources(userId: string, courseId?: string) {
  return prisma.studyResource.findMany({
    where: { userId, ...(courseId ? { courseId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { title: true } } },
  });
}

/**
 * AI-assisted quiz authoring for instructors: generates draft questions
 * grounded in a lesson's ingested material, which the instructor can review
 * and publish. Saved directly as a real Quiz + Question rows (isAiGenerated
 * flag kept for transparency), never faked.
 */
export async function generateQuizForLesson(params: {
  lessonId: string;
  count?: number;
}): Promise<{ aiConfigured: boolean; quizId?: string; message?: string }> {
  const llm = getLLMProvider();
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: { module: true },
  });
  if (!lesson) throw ApiError.notFound("Lesson not found");

  if (!llm.isConfigured) {
    return {
      aiConfigured: false,
      message: "AI generation is not configured on this server (no LLM provider credential found).",
    };
  }

  const context = await buildContext(lesson.module.courseId, lesson.id);
  if (!context.trim()) {
    return { aiConfigured: true, message: "No ingested material found for this lesson yet." };
  }

  const count = params.count ?? 5;
  const system = `You are writing a quiz for the lesson "${lesson.title}". Base every question strictly
on the provided material. Respond with ONLY valid JSON: {"questions": [{"prompt": string,
"options": string[4], "correctOption": number, "explanation": string, "topic": string}]}`;
  const raw = await llm.generate({
    system,
    messages: [{ role: "user", content: `LESSON MATERIAL:\n${context}\n\nGenerate ${count} multiple-choice questions.` }],
    maxTokens: 1800,
  });

  const parsed = z
    .object({
      questions: z
        .array(
          z.object({
            prompt: z.string(),
            options: z.array(z.string()).length(4),
            correctOption: z.number().min(0).max(3),
            explanation: z.string(),
            topic: z.string().optional(),
          }),
        )
        .min(1),
    })
    .parse(extractJson(raw));

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: lesson.id,
      title: `${lesson.title} — Quiz`,
      description: "AI-generated quiz grounded in this lesson's material. Review before publishing.",
      isAiGenerated: true,
      questions: {
        create: parsed.questions.map((q, i) => ({
          prompt: q.prompt,
          options: q.options,
          correctOption: q.correctOption,
          explanation: q.explanation,
          topic: q.topic,
          order: i,
        })),
      },
    },
  });

  return { aiConfigured: true, quizId: quiz.id };
}
