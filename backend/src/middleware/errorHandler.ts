import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/errors";
import { env } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // Prisma unique constraint violation
  if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
    return res.status(409).json({ error: "A record with these details already exists." });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    error: "Something went wrong on our end. Please try again.",
    ...(env.nodeEnv === "development" ? { debug: err instanceof Error ? err.stack : err } : {}),
  });
}
