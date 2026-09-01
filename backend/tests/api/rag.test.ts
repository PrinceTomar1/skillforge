import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { resetDatabase, testPrisma } from "../helpers";
import { retrieveRelevantChunks } from "../../src/services/ai/retrieval";

const app = createApp();

async function registerAgent(role: "STUDENT" | "INSTRUCTOR", email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ name: "Test User", email, password: "password123", role });
  return agent;
}

describe("RAG retrieval pipeline", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("ingests lesson content into retrievable, embedded chunks", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "rag-instructor@example.com");
    const course = (
      await instructor.post("/api/courses").send({
        title: "RAG Test Course",
        description: "Testing document ingestion.",
        category: "Test",
        level: "BEGINNER",
      })
    ).body.course;
    const module = (await instructor.post(`/api/courses/${course.id}/modules`).send({ title: "Module 1" })).body.module;
    await instructor.post(`/api/lessons/modules/${module.id}/lessons`).send({
      title: "Kubernetes Basics",
      content:
        "Kubernetes is a container orchestration platform that schedules containers across a cluster of machines, restarts failed containers, and scales replicas based on load.",
    });

    const documents = await testPrisma.document.findMany({ where: { courseId: course.id } });
    expect(documents).toHaveLength(1);
    expect(documents[0].status).toBe("READY");

    const chunks = await testPrisma.documentChunk.findMany({ where: { documentId: documents[0].id } });
    expect(chunks.length).toBeGreaterThan(0);

    const embeddedCount = await testPrisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) FROM "DocumentChunk" WHERE "documentId" = $1 AND embedding IS NOT NULL`,
      documents[0].id,
    );
    expect(Number(embeddedCount[0].count)).toBe(chunks.length);
  });

  it("scopes retrieval to the requested course and never leaks another course's material", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "rag-scope-instructor@example.com");

    const courseA = (
      await instructor.post("/api/courses").send({
        title: "Container Orchestration",
        description: "About Kubernetes.",
        category: "Test",
        level: "BEGINNER",
      })
    ).body.course;
    const moduleA = (await instructor.post(`/api/courses/${courseA.id}/modules`).send({ title: "Module 1" })).body.module;
    await instructor.post(`/api/lessons/modules/${moduleA.id}/lessons`).send({
      title: "Kubernetes Orchestration",
      content:
        "Kubernetes orchestrates containers across a cluster, automatically restarting failed containers and scaling replicas based on observed load and defined policies.",
    });

    const courseB = (
      await instructor.post("/api/courses").send({
        title: "Watercolor Painting",
        description: "About watercolor painting techniques.",
        category: "Test",
        level: "BEGINNER",
      })
    ).body.course;
    const moduleB = (await instructor.post(`/api/courses/${courseB.id}/modules`).send({ title: "Module 1" })).body.module;
    await instructor.post(`/api/lessons/modules/${moduleB.id}/lessons`).send({
      title: "Watercolor Techniques",
      content:
        "Watercolor painting relies on wet-on-wet and wet-on-dry brush techniques, layering translucent pigment washes to build depth on textured paper.",
    });

    const resultsFromCourseA = await retrieveRelevantChunks({
      query: "How does Kubernetes restart failed containers across a cluster?",
      courseId: courseA.id,
      topK: 5,
    });

    // Every chunk returned must actually belong to course A — retrieval must
    // never cross the course boundary, even though the query is highly
    // relevant to course A's content only.
    for (const chunk of resultsFromCourseA) {
      const chunkCourse = await testPrisma.document.findUniqueOrThrow({ where: { id: chunk.documentId } });
      expect(chunkCourse.courseId).toBe(courseA.id);
    }
    expect(resultsFromCourseA.length).toBeGreaterThan(0);
    expect(resultsFromCourseA.some((c) => c.content.toLowerCase().includes("kubernetes"))).toBe(true);

    // Asking the same Kubernetes-specific question but scoped to course B
    // (watercolor painting) should not fabricate a match — course B simply
    // has nothing relevant, and the low-similarity results (if any survive
    // the threshold at all) must still only be watercolor content.
    const resultsFromCourseB = await retrieveRelevantChunks({
      query: "How does Kubernetes restart failed containers across a cluster?",
      courseId: courseB.id,
      topK: 5,
    });
    for (const chunk of resultsFromCourseB) {
      expect(chunk.content.toLowerCase()).not.toContain("kubernetes");
    }
  });

  it("honestly reports when the LLM provider is not configured, instead of fabricating an answer", async () => {
    const instructor = await registerAgent("INSTRUCTOR", "honesty-instructor@example.com");
    const course = (
      await instructor.post("/api/courses").send({
        title: "Honesty Course",
        description: "Testing the unconfigured-provider fallback.",
        category: "Test",
        level: "BEGINNER",
      })
    ).body.course;
    await instructor.patch(`/api/courses/${course.id}`).send({ isPublished: true });
    const module = (await instructor.post(`/api/courses/${course.id}/modules`).send({ title: "Module 1" })).body.module;
    await instructor.post(`/api/lessons/modules/${module.id}/lessons`).send({
      title: "Some Lesson",
      content: "Some lesson content used only to verify honest fallback behavior.",
    });

    const student = await registerAgent("STUDENT", "honesty-student@example.com");
    await student.post("/api/enrollments").send({ courseId: course.id });

    const res = await student.post("/api/ai/tutor/ask").send({ courseId: course.id, message: "What is this lesson about?" });

    expect(res.status).toBe(200);
    expect(res.body.aiConfigured).toBe(false);
    expect(res.body.answer.toLowerCase()).toContain("not fully configured");
  });
});
