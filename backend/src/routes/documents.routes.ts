import { Router } from "express";
import multer from "multer";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/errors";
import { env } from "../config/env";
import * as documentService from "../services/documentService";

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 },
});

router.get(
  "/course/:courseId",
  asyncHandler(async (req, res) => {
    const documents = await documentService.listCourseDocuments(req.params.courseId);
    res.json({ documents });
  }),
);

router.post(
  "/course/:courseId",
  requireRole("INSTRUCTOR"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded.");
    const document = await documentService.uploadCourseDocument({
      instructorId: req.user!.userId,
      courseId: req.params.courseId,
      lessonId: typeof req.body.lessonId === "string" ? req.body.lessonId : undefined,
      file: req.file,
    });
    res.status(201).json({ document });
  }),
);

router.delete(
  "/:id",
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    await documentService.deleteDocument(req.user!.userId, req.params.id);
    res.status(204).send();
  }),
);

export default router;
