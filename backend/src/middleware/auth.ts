import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/errors";
import { verifyToken } from "../utils/jwt";

declare global {
  // Augmenting Express's own types requires its namespace merging pattern.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { userId: string; role: "STUDENT" | "INSTRUCTOR" };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token =
    req.cookies?.[env.cookieName] ??
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);

  if (!token) {
    return next(ApiError.unauthorized("You must be logged in to do that."));
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    next(ApiError.unauthorized("Your session has expired. Please log in again."));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token =
    req.cookies?.[env.cookieName] ??
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);

  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function requireRole(...roles: Array<"STUDENT" | "INSTRUCTOR">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action."));
    }
    next();
  };
}
