import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as quizService from "../services/quizService";
import { generateQuizForLesson } from "../services/ai/generation";

const router = Router();
router.use(authenticate);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const quiz = await quizService.getQuizForAttempt(req.params.id);
    res.json({ quiz });
  }),
);

router.get(
  "/:id/edit",
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    const quiz = await quizService.getQuizForEditing(req.user!.userId, req.params.id);
    res.json({ quiz });
  }),
);

router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const attempts = await quizService.getAttemptHistory(req.user!.userId, req.params.id);
    res.json({ attempts });
  }),
);

router.post(
  "/:id/attempts",
  requireRole("STUDENT"),
  asyncHandler(async (req, res) => {
    const attempt = await quizService.startAttempt(req.user!.userId, req.params.id);
    res.status(201).json({ attempt });
  }),
);

const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), selectedOption: z.number().int().min(0) })),
});

router.post(
  "/attempts/:attemptId/submit",
  requireRole("STUDENT"),
  validate({ body: submitSchema }),
  asyncHandler(async (req, res) => {
    const result = await quizService.submitAttempt({
      userId: req.user!.userId,
      attemptId: req.params.attemptId,
      answers: req.body.answers,
    });
    res.json({ result });
  }),
);

router.get(
  "/attempts/:attemptId",
  asyncHandler(async (req, res) => {
    const result = await quizService.getAttemptResult(req.user!.userId, req.params.attemptId);
    res.json({ result });
  }),
);

// --- Instructor authoring ---

const quizSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional(),
  timeLimitSeconds: z.number().int().min(0).optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
});

router.post(
  "/lessons/:lessonId",
  requireRole("INSTRUCTOR"),
  validate({ body: quizSchema }),
  asyncHandler(async (req, res) => {
    const quiz = await quizService.createQuiz(req.user!.userId, req.params.lessonId, req.body);
    res.status(201).json({ quiz });
  }),
);

router.post(
  "/lessons/:lessonId/generate",
  requireRole("INSTRUCTOR"),
  validate({ body: z.object({ count: z.number().int().min(1).max(10).optional() }) }),
  asyncHandler(async (req, res) => {
    const result = await generateQuizForLesson({ lessonId: req.params.lessonId, count: req.body.count });
    res.json(result);
  }),
);

router.patch(
  "/:id",
  requireRole("INSTRUCTOR"),
  validate({ body: quizSchema.partial() }),
  asyncHandler(async (req, res) => {
    const quiz = await quizService.updateQuiz(req.user!.userId, req.params.id, req.body);
    res.json({ quiz });
  }),
);

router.delete(
  "/:id",
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    await quizService.deleteQuiz(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
);

const questionSchema = z.object({
  prompt: z.string().min(3).max(1000),
  options: z.array(z.string().min(1)).length(4),
  correctOption: z.number().int().min(0).max(3),
  explanation: z.string().max(1000).optional(),
  topic: z.string().max(80).optional(),
});

router.post(
  "/:id/questions",
  requireRole("INSTRUCTOR"),
  validate({ body: questionSchema }),
  asyncHandler(async (req, res) => {
    const question = await quizService.addQuestion(req.user!.userId, req.params.id, req.body);
    res.status(201).json({ question });
  }),
);

router.patch(
  "/questions/:questionId",
  requireRole("INSTRUCTOR"),
  validate({ body: questionSchema.partial() }),
  asyncHandler(async (req, res) => {
    const question = await quizService.updateQuestion(req.user!.userId, req.params.questionId, req.body);
    res.json({ question });
  }),
);

router.delete(
  "/questions/:questionId",
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    await quizService.deleteQuestion(req.user!.userId, req.params.questionId);
    res.status(204).send();
  }),
);

export default router;
