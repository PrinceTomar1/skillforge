import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/errors";
import { computeStreak, recentActivity } from "./activityService";
import { computeCourseProgress, findResumeLesson } from "./progressService";

const WEAK_TOPIC_THRESHOLD = 70;

export async function getWeakTopics(userId: string) {
  const answers = await prisma.quizAnswer.findMany({
    where: { attempt: { userId } },
    include: { question: { select: { topic: true } } },
  });

  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    const topic = answer.question.topic?.trim();
    if (!topic) continue;
    const bucket = byTopic.get(topic) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (answer.isCorrect) bucket.correct += 1;
    byTopic.set(topic, bucket);
  }

  return Array.from(byTopic.entries())
    .map(([topic, { correct, total }]) => ({
      topic,
      accuracy: Math.round((correct / total) * 100),
      attempts: total,
    }))
    .filter((t) => t.accuracy < WEAK_TOPIC_THRESHOLD && t.attempts >= 1)
    .sort((a, b) => a.accuracy - b.accuracy);
}

export async function getStudentDashboard(userId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        include: { modules: { include: { lessons: true } }, instructor: { select: { name: true } } },
      },
    },
    orderBy: { lastAccessedAt: "desc" },
  });

  const courses = await Promise.all(
    enrollments.map(async (e) => {
      const progress = await computeCourseProgress(userId, e.courseId);
      return {
        enrollmentId: e.id,
        course: {
          id: e.course.id,
          title: e.course.title,
          slug: e.course.slug,
          thumbnailUrl: e.course.thumbnailUrl,
          instructorName: e.course.instructor.name,
        },
        progress,
        completedAt: e.completedAt,
        lastAccessedAt: e.lastAccessedAt,
      };
    }),
  );

  const attempts = await prisma.quizAttempt.findMany({
    where: { userId, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: 10,
    include: { quiz: { select: { title: true, lesson: { select: { title: true } } } } },
  });

  const avgScore =
    attempts.length === 0 ? null : Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length);

  const weakTopics = await getWeakTopics(userId);
  const streak = await computeStreak(userId);
  const activity = await recentActivity(userId, 8);

  const completedLessonSeconds = await prisma.lessonProgress.findMany({
    where: { userId, completed: true },
    include: { lesson: { select: { durationSeconds: true } } },
  });
  const hoursLearned =
    Math.round((completedLessonSeconds.reduce((sum, p) => sum + p.lesson.durationSeconds, 0) / 3600) * 10) / 10;

  const inProgress = courses.filter((c) => c.progress.percent < 100).sort((a, b) => (b.lastAccessedAt > a.lastAccessedAt ? 1 : -1));

  const recommendations: Array<{ type: "RESUME_LESSON" | "WEAK_TOPIC"; courseId: string; courseTitle: string; label: string; lessonId?: string }> = [];
  for (const c of inProgress.slice(0, 3)) {
    const lesson = await findResumeLesson(userId, c.course.id);
    if (lesson) {
      recommendations.push({
        type: "RESUME_LESSON",
        courseId: c.course.id,
        courseTitle: c.course.title,
        label: `Continue "${lesson.title}"`,
        lessonId: lesson.id,
      });
    }
  }
  if (weakTopics.length > 0) {
    recommendations.push({
      type: "WEAK_TOPIC",
      courseId: courses[0]?.course.id ?? "",
      courseTitle: courses[0]?.course.title ?? "",
      label: `Review "${weakTopics[0].topic}" with the AI Tutor (${weakTopics[0].accuracy}% accuracy so far)`,
    });
  }

  return {
    stats: {
      enrolledCourses: courses.length,
      completedCourses: courses.filter((c) => c.progress.percent === 100).length,
      averageQuizScore: avgScore,
      learningStreakDays: streak,
      hoursLearned,
    },
    continueLearning: inProgress[0] ?? null,
    courses,
    recentQuizAttempts: attempts.map((a) => ({
      id: a.id,
      quizTitle: a.quiz.title,
      lessonTitle: a.quiz.lesson.title,
      score: a.score,
      passed: a.passed,
      submittedAt: a.submittedAt,
    })),
    weakTopics,
    recentActivity: activity,
    recommendations,
  };
}

export async function getInstructorDashboard(instructorId: string) {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    include: {
      enrollments: true,
      modules: { include: { lessons: { include: { quizzes: { include: { attempts: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const courseStats = courses.map((c) => {
    const enrollmentCount = c.enrollments.length;
    const completedCount = c.enrollments.filter((e) => e.completedAt).length;
    const attempts = c.modules.flatMap((m) => m.lessons.flatMap((l) => l.quizzes.flatMap((q) => q.attempts)));
    const submitted = attempts.filter((a) => a.submittedAt);
    const avgQuizScore =
      submitted.length === 0 ? null : Math.round(submitted.reduce((sum, a) => sum + a.score, 0) / submitted.length);

    return {
      id: c.id,
      title: c.title,
      slug: c.slug,
      isPublished: c.isPublished,
      enrollmentCount,
      completionRate: enrollmentCount === 0 ? 0 : Math.round((completedCount / enrollmentCount) * 100),
      avgQuizScore,
      lessonCount: c.modules.reduce((sum, m) => sum + m.lessons.length, 0),
      moduleCount: c.modules.length,
      createdAt: c.createdAt,
    };
  });

  const totalStudents = new Set(courses.flatMap((c) => c.enrollments.map((e) => e.userId))).size;

  return {
    stats: {
      totalCourses: courses.length,
      publishedCourses: courses.filter((c) => c.isPublished).length,
      totalStudents,
      totalEnrollments: courses.reduce((sum, c) => sum + c.enrollments.length, 0),
    },
    courses: courseStats,
  };
}

export async function getCourseAnalytics(instructorId: string, courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      enrollments: { include: { user: { select: { id: true, name: true, email: true } } } },
      modules: { include: { lessons: { include: { quizzes: { include: { questions: true, attempts: { where: { submittedAt: { not: null } } } } } } } } },
    },
  });
  if (course.instructorId !== instructorId) throw ApiError.forbidden("You do not own this course.");

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);

  const students = await Promise.all(
    course.enrollments.map(async (e) => {
      const progress = await computeCourseProgress(e.userId, courseId);
      return {
        userId: e.user.id,
        name: e.user.name,
        email: e.user.email,
        progress,
        enrolledAt: e.enrolledAt,
        completedAt: e.completedAt,
      };
    }),
  );

  const quizzes = course.modules.flatMap((m) =>
    m.lessons.flatMap((l) =>
      l.quizzes.map((q) => {
        const attempts = q.attempts;
        const avgScore = attempts.length === 0 ? null : Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length);
        const passRate = attempts.length === 0 ? null : Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100);
        return {
          quizId: q.id,
          title: q.title,
          lessonTitle: l.title,
          questionCount: q.questions.length,
          attemptCount: attempts.length,
          avgScore,
          passRate,
        };
      }),
    ),
  );

  const topicAccuracy = new Map<string, { correct: number; total: number }>();
  const allAnswers = await prisma.quizAnswer.findMany({
    where: { question: { quiz: { lesson: { module: { courseId } } } } },
    include: { question: { select: { topic: true } } },
  });
  for (const a of allAnswers) {
    const topic = a.question.topic?.trim();
    if (!topic) continue;
    const bucket = topicAccuracy.get(topic) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (a.isCorrect) bucket.correct += 1;
    topicAccuracy.set(topic, bucket);
  }

  return {
    course: { id: course.id, title: course.title, isPublished: course.isPublished, totalLessons, moduleCount: course.modules.length },
    students,
    quizzes,
    topicBreakdown: Array.from(topicAccuracy.entries()).map(([topic, { correct, total }]) => ({
      topic,
      accuracy: Math.round((correct / total) * 100),
      totalAnswers: total,
    })),
  };
}
