import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/errors";
import { signToken } from "../utils/jwt";

const SALT_ROUNDS = 12;

export async function registerUser(params: { name: string; email: string; password: string; role: "STUDENT" | "INSTRUCTOR" }) {
  const existing = await prisma.user.findUnique({ where: { email: params.email.toLowerCase() } });
  if (existing) throw ApiError.conflict("An account with this email already exists.");

  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: params.name,
      email: params.email.toLowerCase(),
      passwordHash,
      role: params.role,
    },
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { user: sanitize(user), token };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw ApiError.unauthorized("Invalid email or password.");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password.");

  const token = signToken({ userId: user.id, role: user.role });
  return { user: sanitize(user), token };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  return sanitize(user);
}

export async function updateProfile(userId: string, data: { name?: string; bio?: string; avatarUrl?: string }) {
  const user = await prisma.user.update({ where: { id: userId }, data });
  return sanitize(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest("Current password is incorrect.");
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

function sanitize<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
