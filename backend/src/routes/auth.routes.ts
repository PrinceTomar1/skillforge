import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as authService from "../services/authService";

const router = Router();

// The frontend proxies /api/* to this backend at the edge (Vercel rewrites
// in production, the Vite dev server proxy locally), so every request the
// browser actually makes targets the frontend's own origin — this cookie is
// always same-site from the browser's point of view. That's deliberate:
// SameSite=None (needed for a genuinely cross-site setup) gets blocked
// outright by Safari's Intelligent Tracking Prevention regardless of
// Secure, which broke login for every Safari user when the frontend called
// the Render domain directly. Routing through the same origin sidesteps
// that entirely and lets us keep the strictly safer "lax".
const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STUDENT", "INSTRUCTOR"]),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

router.post(
  "/register",
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.registerUser(req.body);
    res.cookie(env.cookieName, token, cookieOptions);
    res.status(201).json({ user, token });
  }),
);

router.post(
  "/login",
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.loginUser(req.body.email, req.body.password);
    res.cookie(env.cookieName, token, cookieOptions);
    res.json({ user, token });
  }),
);

router.post("/logout", (_req, res) => {
  res.clearCookie(env.cookieName, { httpOnly: cookieOptions.httpOnly, secure: cookieOptions.secure, sameSite: cookieOptions.sameSite });
  res.status(204).send();
});

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getUserById(req.user!.userId);
    res.json({ user });
  }),
);

export default router;
