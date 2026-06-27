import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { resetDatabase, testPrisma } from "../helpers";

const app = createApp();

describe("Auth API", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("registers a new student, hashes the password, and returns a session cookie", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Student",
      email: "student@example.com",
      password: "password123",
      role: "STUDENT",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("student@example.com");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.headers["set-cookie"]).toBeDefined();

    const dbUser = await testPrisma.user.findUniqueOrThrow({ where: { email: "student@example.com" } });
    expect(dbUser.passwordHash).not.toBe("password123");
    expect(dbUser.passwordHash.startsWith("$2")).toBe(true); // bcrypt hash prefix
  });

  it("rejects registration with a duplicate email", async () => {
    await request(app).post("/api/auth/register").send({
      name: "First",
      email: "dup@example.com",
      password: "password123",
      role: "STUDENT",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Second",
      email: "dup@example.com",
      password: "password456",
      role: "STUDENT",
    });

    expect(res.status).toBe(409);
  });

  it("rejects registration with an invalid payload", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "short",
      role: "STUDENT",
    });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login Test",
      email: "login@example.com",
      password: "correct-password",
      role: "STUDENT",
    });

    const good = await request(app).post("/api/auth/login").send({ email: "login@example.com", password: "correct-password" });
    expect(good.status).toBe(200);

    const bad = await request(app).post("/api/auth/login").send({ email: "login@example.com", password: "wrong-password" });
    expect(bad.status).toBe(401);
  });

  it("does not leak whether an email exists via the login error message", async () => {
    const unknownEmail = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "whatever123" });

    await request(app).post("/api/auth/register").send({
      name: "Exists",
      email: "exists@example.com",
      password: "correct-password",
      role: "STUDENT",
    });
    const wrongPassword = await request(app).post("/api/auth/login").send({ email: "exists@example.com", password: "wrong-password" });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
  });

  it("rejects /auth/me without a session, and returns the user with one", async () => {
    const unauthenticated = await request(app).get("/api/auth/me");
    expect(unauthenticated.status).toBe(401);

    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Session Test",
      email: "session@example.com",
      password: "password123",
      role: "INSTRUCTOR",
    });
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("INSTRUCTOR");
  });

  it("clears the session on logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Logout Test",
      email: "logout@example.com",
      password: "password123",
      role: "STUDENT",
    });
    await agent.post("/api/auth/logout");
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(401);
  });
});
