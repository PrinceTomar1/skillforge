import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/errors";
import { logActivity } from "./activityService";
import { assertOwnsCourse } from "./courseService";

export async function getQuizForAttempt(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: { order: "asc" } }, lesson: { select: { title: true, moduleId: true } } },
  });
  if (!quiz) throw ApiError.notFound("Quiz not found");

  // Hide correct answers/explanations from students until they submit.
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      order: q.order,
    })),
  };
}

export async function startAttempt(userId: string, quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
  if (!quiz) throw ApiError.notFound("Quiz not found");

  return prisma.quizAttempt.create({
    data: { quizId, userId, totalQuestions: quiz.questions.length },
  });
}

export async function submitAttempt(params: {
  userId: string;
  attemptId: string;
  answers: Array<{ questionId: string; selectedOption: number }>;
}) {
  const attempt = await prisma.quizAttempt.findUnique({ where: { id: params.attemptId }, include: { quiz: { include: { questions: true } } } });
  if (!attempt) throw ApiError.notFound("Attempt not found");
  if (attempt.userId !== params.userId) throw ApiError.forbidden();
  if (attempt.submittedAt) throw ApiError.conflict("This attempt was already submitted.");

  const questionMap = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  let correctCount = 0;

  const answerRows = params.answers.map((a) => {
    const question = questionMap.get(a.questionId);
    const isCorrect = !!question && question.correctOption === a.selectedOption;
    if (isCorrect) correctCount += 1;
    return {
      attemptId: attempt.id,
      questionId: a.questionId,
      selectedOption: a.selectedOption,
      isCorrect,
    };
  });

  const total = attempt.quiz.questions.length;
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  const passed = score >= attempt.quiz.passingScore;

  await prisma.$transaction([
    prisma.quizAnswer.createMany({ data: answerRows }),
    prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { correctCount, totalQuestions: total, score, passed, submittedAt: new Date() },
    }),
  ]);

  await logActivity(params.userId, "QUIZ_ATTEMPTED", undefined, { quizId: attempt.quizId, score });

  return getAttemptResult(params.userId, attempt.id);
}

export async function getAttemptResult(userId: string, attemptId: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { include: { questions: { orderBy: { order: "asc" } } } },
      answers: true,
    },
  });
  if (!attempt) throw ApiError.notFound("Attempt not found");
  if (attempt.userId !== userId) throw ApiError.forbidden();

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quiz.title,
    score: attempt.score,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.totalQuestions,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
    questions: attempt.quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      correctOption: q.correctOption,
      explanation: q.explanation,
      topic: q.topic,
      selectedOption: answerMap.get(q.id)?.selectedOption ?? null,
      isCorrect: answerMap.get(q.id)?.isCorrect ?? false,
    })),
  };
}

export async function getAttemptHistory(userId: string, quizId: string) {
  return prisma.quizAttempt.findMany({
    where: { userId, quizId, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
  });
}

// --- Instructor authoring ---

export async function createQuiz(instructorId: string, lessonId: string, data: {
  title: string; description?: string; timeLimitSeconds?: number; passingScore?: number;
}) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { module: true } });
  await assertOwnsCourse(instructorId, lesson.module.courseId);
  return prisma.quiz.create({ data: { ...data, lessonId } });
}

export async function updateQuiz(instructorId: string, quizId: string, data: Partial<{
  title: string; description: string; timeLimitSeconds: number; passingScore: number;
}>) {
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { lesson: { include: { module: true } } } });
  await assertOwnsCourse(instructorId, quiz.lesson.module.courseId);
  return prisma.quiz.update({ where: { id: quizId }, data });
}

export async function deleteQuiz(instructorId: string, quizId: string) {
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { lesson: { include: { module: true } } } });
  await assertOwnsCourse(instructorId, quiz.lesson.module.courseId);
  await prisma.quiz.delete({ where: { id: quizId } });
}

export async function getQuizForEditing(instructorId: string, quizId: string) {
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: { questions: { orderBy: { order: "asc" } }, lesson: { include: { module: true } } },
  });
  await assertOwnsCourse(instructorId, quiz.lesson.module.courseId);
  return quiz;
}

export async function addQuestion(instructorId: string, quizId: string, data: {
  prompt: string; options: string[]; correctOption: number; explanation?: string; topic?: string;
}) {
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { lesson: { include: { module: true } } } });
  await assertOwnsCourse(instructorId, quiz.lesson.module.courseId);
  const maxOrder = await prisma.question.aggregate({ where: { quizId }, _max: { order: true } });
  return prisma.question.create({ data: { ...data, quizId, order: (maxOrder._max.order ?? -1) + 1 } });
}

export async function updateQuestion(instructorId: string, questionId: string, data: Partial<{
  prompt: string; options: string[]; correctOption: number; explanation: string; topic: string;
}>) {
  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { quiz: { include: { lesson: { include: { module: true } } } } } });
  await assertOwnsCourse(instructorId, question.quiz.lesson.module.courseId);
  return prisma.question.update({ where: { id: questionId }, data });
}

export async function deleteQuestion(instructorId: string, questionId: string) {
  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, include: { quiz: { include: { lesson: { include: { module: true } } } } } });
  await assertOwnsCourse(instructorId, question.quiz.lesson.module.courseId);
  await prisma.question.delete({ where: { id: questionId } });
}
