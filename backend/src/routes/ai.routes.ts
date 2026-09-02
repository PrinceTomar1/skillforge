import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { aiIsConfigured, embeddingsUseRealProvider } from "../config/env";
import * as tutorService from "../services/ai/tutorService";
import { generateStudyResource, listStudyResources } from "../services/ai/generation";

const router = Router();
router.use(authenticate);

router.get("/status", (_req, res) => {
  res.json({
    llmConfigured: aiIsConfigured,
    realSemanticEmbeddings: embeddingsUseRealProvider,
  });
});

const askSchema = z.object({
  courseId: z.string(),
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
});

router.post(
  "/tutor/ask",
  requireRole("STUDENT"),
  validate({ body: askSchema }),
  asyncHandler(async (req, res) => {
    const result = await tutorService.askTutor({ userId: req.user!.userId, ...req.body });
    res.json(result);
  }),
);

/**
 * Server-Sent Events variant: streams the answer as it's generated instead
 * of waiting for the full response. A real LLM call can legitimately take
 * many seconds, and a single blocking wait with nothing visible reads as
 * "broken" even when it's working — streaming the first token back quickly
 * is what makes it feel like a live conversation.
 */
router.post("/tutor/ask/stream", requireRole("STUDENT"), validate({ body: askSchema }), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx proxy buffering if deployed behind one
  res.flushHeaders();

  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);

  try {
    const result = await tutorService.askTutorStream({ userId: req.user!.userId, ...req.body }, (text) => send({ type: "chunk", text }));
    send({ type: "done", conversationId: result.conversationId, sources: result.sources, aiConfigured: result.aiConfigured });
  } catch (err) {
    console.error("Streaming AI Tutor request failed:", err);
    send({ type: "error", message: "Something went wrong generating a response. Please try again." });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

router.get(
  "/tutor/conversations",
  asyncHandler(async (req, res) => {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const conversations = await tutorService.listConversations(req.user!.userId, courseId);
    res.json({ conversations });
  }),
);

router.get(
  "/tutor/conversations/:id",
  asyncHandler(async (req, res) => {
    const conversation = await tutorService.getConversation(req.user!.userId, req.params.id);
    res.json({ conversation });
  }),
);

const generateSchema = z.object({
  courseId: z.string(),
  lessonId: z.string().optional(),
  type: z.enum(["SUMMARY", "FLASHCARDS", "PRACTICE_QUESTIONS", "KEY_CONCEPTS", "STUDY_PLAN", "REVISION_NOTES"]),
});

router.post(
  "/resources/generate",
  requireRole("STUDENT"),
  validate({ body: generateSchema }),
  asyncHandler(async (req, res) => {
    const result = await generateStudyResource({ userId: req.user!.userId, ...req.body });
    res.json(result);
  }),
);

router.get(
  "/resources",
  asyncHandler(async (req, res) => {
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
    const resources = await listStudyResources(req.user!.userId, courseId);
    res.json({ resources });
  }),
);

export default router;
