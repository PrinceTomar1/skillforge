import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { resetDatabase, testPrisma } from "../helpers";

const app = createApp();

async function registerAgent(role: "STUDENT" | "INSTRUCTOR", email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ name: "Test User", email, password: "password123", role });
  return agent;
}

describe("Courses API", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("prevents a student from creating a course", async () => {
    const student = await registerAgent("STUDENT", "student@example.com");
    const res = await student.post("/api/courses").send({
      title: "Should Fail",
      description: "This should not be allowed for a student account.",
      category: "Test",
      level: "BEGINNER",
    });
    expect(res.status).toBe(403);
  });

  it("prevents an unauthenticated request from creating a course", async () => {
    const res = await request(app).post("/api/courses").send({
      title: "Should Fail",
      description: "No auth at all.",
      category: "Test",
      level: "BEGINNER",
    });
    expect(res.status).toBe(401);
  });

  it("allows an instructor to create a course as an unpublished draft by default", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "instructor@example.com");
    const res = await instructor.post("/api/courses").send({
      title: "Draft Course",
      description: "A course that starts life as a draft.",
      category: "Test",
      level: "BEGINNER",
    });
    expect(res.status).toBe(201);
    expect(res.body.course.isPublished).toBe(false);
    expect(res.body.course.slug).toBe("draft-course");
  });

  it("does not show unpublished courses in the public course list", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "instructor2@example.com");
    await instructor.post("/api/courses").send({
      title: "Hidden Draft",
      description: "Should not appear publicly until published.",
      category: "Test",
      level: "BEGINNER",
    });

    const publicList = await request(app).get("/api/courses");
    expect(publicList.body.courses.find((c: { title: string }) => c.title === "Hidden Draft")).toBeUndefined();

    const course = await testPrisma.course.findFirstOrThrow({ where: { title: "Hidden Draft" } });
    await instructor.patch(`/api/courses/${course.id}`).send({ isPublished: true });

    const publicListAfterPublish = await request(app).get("/api/courses");
    expect(publicListAfterPublish.body.courses.find((c: { title: string }) => c.title === "Hidden Draft")).toBeDefined();
  });

  it("prevents one instructor from editing another instructor's course", async () => {
    const owner = await registerAgent("INSTRUCTOR", "owner@example.com");
    const intruder = await registerAgent("INSTRUCTOR", "intruder@example.com");

    const created = await owner.post("/api/courses").send({
      title: "Owned Course",
      description: "Only the owner should be able to edit this.",
      category: "Test",
      level: "BEGINNER",
    });

    const res = await intruder.patch(`/api/courses/${created.body.course.id}`).send({ title: "Hijacked" });
    expect(res.status).toBe(403);
  });

  it("does not leak full lesson content through the public course detail endpoint", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "gating@example.com");
    const course = (
      await instructor.post("/api/courses").send({
        title: "Gated Course",
        description: "Testing that lesson content requires enrollment.",
        category: "Test",
        level: "BEGINNER",
      })
    ).body.course;
    await instructor.patch(`/api/courses/${course.id}`).send({ isPublished: true });

    const module = (await instructor.post(`/api/courses/${course.id}/modules`).send({ title: "Module 1" })).body.module;
    await instructor.post(`/api/lessons/modules/${module.id}/lessons`).send({
      title: "Secret Lesson",
      content: "This is confidential lesson material that should not leak publicly.",
    });

    const publicDetail = await request(app).get(`/api/courses/${course.slug}`);
    const lessonJson = JSON.stringify(publicDetail.body.course);
    expect(lessonJson).not.toContain("confidential lesson material");
  });
});
