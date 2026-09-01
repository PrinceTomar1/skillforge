import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as authService from "../services/authService";

const router = Router();

router.use(authenticate);

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

router.patch(
  "/me",
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    res.json({ user });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  "/me/password",
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await authService.changePassword(req.user!.userId, req.body.currentPassword, req.body.newPassword);
    res.status(204).send();
  }),
);

export default router;
