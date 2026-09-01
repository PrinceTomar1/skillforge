import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/errors";
import { logActivity } from "./activityService";

export async function computeCourseProgress(userId: string, courseId: string) {
  const totalLessons = await prisma.lesson.count({ where: { module: { courseId } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { userId, completed: true, lesson: { module: { courseId } } },
  });
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  return { totalLessons, completedLessons, percent };
}

export async function enrollInCourse(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished) throw ApiError.notFound("Course not found");

  const existing = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return existing;

  const enrollment = await prisma.enrollment.create({ data: { userId, courseId } });
  await logActivity(userId, "ENROLLED", courseId);
  return enrollment;
}

export async function markLessonProgress(params: {
  userId: string;
  lessonId: string;
  completed?: boolean;
  lastPositionSeconds?: number;
}) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: { module: true },
  });
  if (!lesson) throw ApiError.notFound("Lesson not found");

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: params.userId, courseId: lesson.module.courseId } },
  });
  if (!enrollment) throw ApiError.forbidden("You must enroll in this course first.");

  const wasCompleted = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: params.userId, lessonId: params.lessonId } },
  });

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: params.userId, lessonId: params.lessonId } },
    create: {
      userId: params.userId,
      lessonId: params.lessonId,
      enrollmentId: enrollment.id,
      completed: params.completed ?? false,
      completedAt: params.completed ? new Date() : null,
      lastPositionSeconds: params.lastPositionSeconds ?? 0,
    },
    update: {
      ...(params.completed !== undefined
        ? { completed: params.completed, completedAt: params.completed ? new Date() : null }
        : {}),
      ...(params.lastPositionSeconds !== undefined ? { lastPositionSeconds: params.lastPositionSeconds } : {}),
    },
  });

  await prisma.enrollment.update({ where: { id: enrollment.id }, data: { lastAccessedAt: new Date() } });

  if (params.completed && !wasCompleted?.completed) {
    await logActivity(params.userId, "LESSON_COMPLETED", lesson.module.courseId, { lessonId: lesson.id });

    const { percent } = await computeCourseProgress(params.userId, lesson.module.courseId);
    if (percent === 100) {
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: new Date() } });
    }
  }

  return progress;
}

export async function getCourseLessonProgress(userId: string, courseId: string) {
  return prisma.lessonProgress.findMany({
    where: { userId, lesson: { module: { courseId } } },
    select: { lessonId: true, completed: true, lastPositionSeconds: true },
  });
}

export async function findResumeLesson(userId: string, courseId: string) {
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const lessons = modules.flatMap((m) => m.lessons);
  if (lessons.length === 0) return null;

  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessons.map((l) => l.id) } },
  });
  const completedIds = new Set(progressRows.filter((p) => p.completed).map((p) => p.lessonId));

  const next = lessons.find((l) => !completedIds.has(l.id));
  return next ?? lessons[lessons.length - 1];
}
