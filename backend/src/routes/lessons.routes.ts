import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/errors";
import * as courseService from "../services/courseService";
import { prisma } from "../lib/prisma";

const router = Router();

const lessonSchema = z.object({
  title: z.string().min(2).max(160),
  content: z.string().max(20000).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  durationSeconds: z.number().int().min(0).optional(),
});

router.post(
  "/modules/:moduleId/lessons",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: lessonSchema }),
  asyncHandler(async (req, res) => {
    const lesson = await courseService.createLesson(req.user!.userId, req.params.moduleId, req.body);
    res.status(201).json({ lesson });
  }),
);

router.post(
  "/modules/:moduleId/lessons/reorder",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: z.object({ orderedIds: z.array(z.string()) }) }),
  asyncHandler(async (req, res) => {
    await courseService.reorderLessons(req.user!.userId, req.params.moduleId, req.body.orderedIds);
    res.status(204).send();
  }),
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const lesson = await courseService.getLessonById(req.params.id);

    if (req.user!.role === "STUDENT") {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user!.userId, courseId: lesson.module.courseId } },
      });
      if (!enrollment) throw ApiError.forbidden("Enroll in this course to view lesson content.");
    } else if (lesson.module.course.instructorId !== req.user!.userId) {
      throw ApiError.forbidden();
    }

    res.json({ lesson });
  }),
);

router.patch(
  "/:id",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: lessonSchema.partial() }),
  asyncHandler(async (req, res) => {
    const lesson = await courseService.updateLesson(req.user!.userId, req.params.id, req.body);
    res.json({ lesson });
  }),
);

router.delete(
  "/:id",
  authenticate,
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    await courseService.deleteLesson(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
);

export default router;
