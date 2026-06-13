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
