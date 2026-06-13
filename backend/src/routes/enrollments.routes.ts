import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";
import * as progressService from "../services/progressService";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requireRole("STUDENT"),
  validate({ body: z.object({ courseId: z.string() }) }),
  asyncHandler(async (req, res) => {
    const enrollment = await progressService.enrollInCourse(req.user!.userId, req.body.courseId);
    res.status(201).json({ enrollment });
  }),
);

router.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.userId },
      include: { course: { select: { id: true, title: true, slug: true, thumbnailUrl: true } } },
    });
    res.json({ enrollments });
  }),
);

router.get(
  "/:courseId/resume",
  asyncHandler(async (req, res) => {
    const lesson = await progressService.findResumeLesson(req.user!.userId, req.params.courseId);
    res.json({ lesson });
  }),
);

router.get(
  "/:courseId/progress",
  asyncHandler(async (req, res) => {
    const progress = await progressService.computeCourseProgress(req.user!.userId, req.params.courseId);
    res.json({ progress });
  }),
);

router.get(
  "/:courseId/lesson-progress",
  asyncHandler(async (req, res) => {
    const lessons = await progressService.getCourseLessonProgress(req.user!.userId, req.params.courseId);
    res.json({ lessons });
  }),
);

export default router;
