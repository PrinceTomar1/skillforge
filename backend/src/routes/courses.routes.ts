import { Router } from "express";
import { z } from "zod";
import { authenticate, optionalAuthenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/errors";
import * as courseService from "../services/courseService";

const router = Router();

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    res.json({ categories: await courseService.listCategories() });
  }),
);

router.get(
  "/instructor/mine",
  authenticate,
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    res.json({ courses: await courseService.listInstructorCourses(req.user!.userId) });
  }),
);

router.get(
  "/instructor/:id/full",
  authenticate,
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    const course = await courseService.getCourseForInstructor(req.user!.userId, req.params.id);
    res.json({ course });
  }),
);

router.get(
  "/",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { search, category, level } = req.query as Record<string, string | undefined>;
    const courses = await courseService.listCourses({ search, category, level, publishedOnly: true });
    res.json({ courses });
  }),
);

const createCourseSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(4000),
  category: z.string().min(2).max(60),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
});

router.post(
  "/",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: createCourseSchema }),
  asyncHandler(async (req, res) => {
    const course = await courseService.createCourse(req.user!.userId, req.body);
    res.status(201).json({ course });
  }),
);

router.get(
  "/:slug",
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const course = await courseService.getCourseBySlug(req.params.slug);
    if (!course.isPublished && course.instructorId !== req.user?.userId) {
      throw ApiError.notFound("Course not found");
    }
    res.json({ course });
  }),
);

const updateCourseSchema = createCourseSchema.partial().extend({ isPublished: z.boolean().optional() });

router.patch(
  "/:id",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: updateCourseSchema }),
  asyncHandler(async (req, res) => {
    const course = await courseService.updateCourse(req.user!.userId, req.params.id, req.body);
    res.json({ course });
  }),
);

router.delete(
  "/:id",
  authenticate,
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    await courseService.deleteCourse(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
);

// --- Modules (nested under a course) ---

const moduleSchema = z.object({ title: z.string().min(2).max(120), description: z.string().max(2000).optional() });

router.post(
  "/:id/modules",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: moduleSchema }),
  asyncHandler(async (req, res) => {
    const module = await courseService.createModule(req.user!.userId, req.params.id, req.body);
    res.status(201).json({ module });
  }),
);

router.post(
  "/:id/modules/reorder",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: z.object({ orderedIds: z.array(z.string()) }) }),
  asyncHandler(async (req, res) => {
    await courseService.reorderModules(req.user!.userId, req.params.id, req.body.orderedIds);
    res.status(204).send();
  }),
);

router.patch(
  "/modules/:moduleId",
  authenticate,
  requireRole("INSTRUCTOR"),
  validate({ body: moduleSchema.partial() }),
  asyncHandler(async (req, res) => {
    const module = await courseService.updateModule(req.user!.userId, req.params.moduleId, req.body);
    res.json({ module });
  }),
);

router.delete(
  "/modules/:moduleId",
  authenticate,
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    await courseService.deleteModule(req.user!.userId, req.params.moduleId);
    res.status(204).send();
  }),
);

export default router;
