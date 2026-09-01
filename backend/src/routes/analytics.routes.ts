import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import * as analyticsService from "../services/analyticsService";

const router = Router();
router.use(authenticate);

router.get(
  "/student",
  requireRole("STUDENT"),
  asyncHandler(async (req, res) => {
    res.json(await analyticsService.getStudentDashboard(req.user!.userId));
  }),
);

router.get(
  "/instructor",
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    res.json(await analyticsService.getInstructorDashboard(req.user!.userId));
  }),
);

router.get(
  "/instructor/courses/:courseId",
  requireRole("INSTRUCTOR"),
  asyncHandler(async (req, res) => {
    res.json(await analyticsService.getCourseAnalytics(req.user!.userId, req.params.courseId));
  }),
);

export default router;
