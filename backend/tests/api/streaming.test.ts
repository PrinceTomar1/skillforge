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

function parseSseEvents(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)));
}

describe("AI Tutor streaming endpoint", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("streams at least one chunk event and a final done event over SSE", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "stream-instructor@example.com");
    const course = (
      await instructor.post("/api/courses").send({
        title: "Streaming Test Course",
        description: "Testing the SSE streaming endpoint end to end.",
        category: "Test",
        level: "BEGINNER",
      })
    ).body.course;
    await instructor.patch(`/api/courses/${course.id}`).send({ isPublished: true });
    const module = (await instructor.post(`/api/courses/${course.id}/modules`).send({ title: "Module 1" })).body.module;
    await instructor.post(`/api/lessons/modules/${module.id}/lessons`).send({
      title: "Some Lesson",
      content: "Some lesson content used only to verify the streaming endpoint responds.",
    });

    const student = await registerAgent("STUDENT", "stream-student@example.com");
    await student.post("/api/enrollments").send({ courseId: course.id });

    const res = await student
      .post("/api/ai/tutor/ask/stream")
      .send({ courseId: course.id, message: "What is this lesson about?" })
      .buffer(true)
      .parse((response, callback) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => callback(null, data));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");

    const events = parseSseEvents(res.body as unknown as string);
    expect(events.some((e) => e.type === "chunk")).toBe(true);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent).toHaveProperty("conversationId");
    expect(doneEvent).toHaveProperty("sources");
    expect(doneEvent!.aiConfigured).toBe(false); // AI_PROVIDER=none in the test environment

    // The streamed chunks concatenated should be the same honest
    // "not configured" message the non-streaming endpoint returns —
    // streaming must never fabricate a different (or fake) answer.
    const fullText = events
      .filter((e) => e.type === "chunk")
      .map((e) => e.text)
      .join("");
    expect(fullText.toLowerCase()).toContain("not fully configured");
  });
});
