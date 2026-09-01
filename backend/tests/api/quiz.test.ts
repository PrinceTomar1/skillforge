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

async function setUpCourseWithQuiz() {
  const instructor = await registerAgent("INSTRUCTOR", "quiz-instructor@example.com");
  const course = (
    await instructor.post("/api/courses").send({
      title: "Quiz Course",
      description: "A course used to test the quiz engine end to end.",
      category: "Test",
      level: "BEGINNER",
    })
  ).body.course;
  await instructor.patch(`/api/courses/${course.id}`).send({ isPublished: true });
  const module = (await instructor.post(`/api/courses/${course.id}/modules`).send({ title: "Module 1" })).body.module;
  const lesson = (
    await instructor.post(`/api/lessons/modules/${module.id}/lessons`).send({ title: "Lesson 1", content: "Some lesson content." })
  ).body.lesson;
  const quiz = (
    await instructor.post(`/api/quizzes/lessons/${lesson.id}`).send({ title: "Quiz 1", passingScore: 70 })
  ).body.quiz;

  const q1 = (
    await instructor.post(`/api/quizzes/${quiz.id}/questions`).send({
      prompt: "2 + 2 = ?",
      options: ["3", "4", "5", "6"],
      correctOption: 1,
      topic: "Arithmetic",
    })
  ).body.question;
  const q2 = (
    await instructor.post(`/api/quizzes/${quiz.id}/questions`).send({
      prompt: "The sky is usually what color on a clear day?",
      options: ["Green", "Red", "Blue", "Purple"],
      correctOption: 2,
      topic: "General",
    })
  ).body.question;

  return { instructor, course, lesson, quiz, questions: [q1, q2] };
}

describe("Quiz engine", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("computes a real score from submitted answers rather than a hardcoded result", async () => {
    const { quiz, questions } = await setUpCourseWithQuiz();
    const student = await registerAgent("STUDENT", "quiz-student@example.com");
    const course = await testPrisma.course.findFirstOrThrow({ where: { title: "Quiz Course" } });
    await student.post("/api/enrollments").send({ courseId: course.id });

    const attempt = (await student.post(`/api/quizzes/${quiz.id}/attempts`)).body.attempt;

    // Answer both correctly.
    const allCorrect = await student.post(`/api/quizzes/attempts/${attempt.id}/submit`).send({
      answers: [
        { questionId: questions[0].id, selectedOption: 1 },
        { questionId: questions[1].id, selectedOption: 2 },
      ],
    });
    expect(allCorrect.body.result.score).toBe(100);
    expect(allCorrect.body.result.correctCount).toBe(2);
    expect(allCorrect.body.result.passed).toBe(true);

    // A second attempt, answered entirely wrong, should score 0 — proving
    // the score is genuinely computed per-attempt, not memoized/hardcoded.
    const attempt2 = (await student.post(`/api/quizzes/${quiz.id}/attempts`)).body.attempt;
    const allWrong = await student.post(`/api/quizzes/attempts/${attempt2.id}/submit`).send({
      answers: [
        { questionId: questions[0].id, selectedOption: 0 },
        { questionId: questions[1].id, selectedOption: 0 },
      ],
    });
    expect(allWrong.body.result.score).toBe(0);
    expect(allWrong.body.result.passed).toBe(false);
  });

  it("does not return the correct answers before a student submits", async () => {
    const { quiz } = await setUpCourseWithQuiz();
    const student = await registerAgent("STUDENT", "peek-student@example.com");
    const course = await testPrisma.course.findFirstOrThrow({ where: { title: "Quiz Course" } });
    await student.post("/api/enrollments").send({ courseId: course.id });

    const res = await student.get(`/api/quizzes/${quiz.id}`);
    const serialized = JSON.stringify(res.body.quiz);
    expect(serialized).not.toContain("correctOption");
    expect(serialized).not.toContain("explanation");
  });

  it("rejects submitting the same attempt twice", async () => {
    const { quiz, questions } = await setUpCourseWithQuiz();
    const student = await registerAgent("STUDENT", "double-submit@example.com");
    const course = await testPrisma.course.findFirstOrThrow({ where: { title: "Quiz Course" } });
    await student.post("/api/enrollments").send({ courseId: course.id });

    const attempt = (await student.post(`/api/quizzes/${quiz.id}/attempts`)).body.attempt;
    const payload = { answers: [{ questionId: questions[0].id, selectedOption: 1 }] };
    const first = await student.post(`/api/quizzes/attempts/${attempt.id}/submit`).send(payload);
    const second = await student.post(`/api/quizzes/attempts/${attempt.id}/submit`).send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
  });

  it("prevents a student from marking lesson progress before enrolling", async () => {
    const { lesson } = await setUpCourseWithQuiz();
    const student = await registerAgent("STUDENT", "not-enrolled@example.com");

    const res = await student.post("/api/progress").send({ lessonId: lesson.id, completed: true });
    expect(res.status).toBe(403);
  });

  it("computes real course completion percentage from actual lesson progress", async () => {
    const { lesson, course: createdCourse } = await setUpCourseWithQuiz();
    const student = await registerAgent("STUDENT", "progress-student@example.com");
    await student.post("/api/enrollments").send({ courseId: createdCourse.id });

    const before = await student.get(`/api/enrollments/${createdCourse.id}/progress`);
    expect(before.body.progress.percent).toBe(0);

    await student.post("/api/progress").send({ lessonId: lesson.id, completed: true });

    const after = await student.get(`/api/enrollments/${createdCourse.id}/progress`);
    expect(after.body.progress.percent).toBe(100); // only lesson in this course
    expect(after.body.progress.completedLessons).toBe(1);
  });
});
