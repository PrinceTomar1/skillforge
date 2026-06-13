import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as progressService from "../services/progressService";

const router = Router();

const bodySchema = z.object({
  lessonId: z.string(),
  completed: z.boolean().optional(),
  lastPositionSeconds: z.number().int().min(0).optional(),
});

router.post(
  "/",
  authenticate,
  requireRole("STUDENT"),
  validate({ body: bodySchema }),
  asyncHandler(async (req, res) => {
    const progress = await progressService.markLessonProgress({ userId: req.user!.userId, ...req.body });
    res.json({ progress });
  }),
);

export default router;
