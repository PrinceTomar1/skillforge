import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/errors";
import { slugify } from "../utils/slugify";
import { ingestLessonContent } from "./ai/ingestion";

export async function listCourses(params: { search?: string; category?: string; level?: string; publishedOnly?: boolean }) {
  return prisma.course.findMany({
    where: {
      ...(params.publishedOnly ? { isPublished: true } : {}),
      ...(params.category ? { category: params.category } : {}),
      ...(params.level ? { level: params.level as never } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: "insensitive" } },
              { description: { contains: params.search, mode: "insensitive" } },
              { category: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      instructor: { select: { id: true, name: true, avatarUrl: true } },
      modules: { select: { lessons: { select: { id: true, durationSeconds: true } } } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCourseBySlug(slug: string) {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      instructor: { select: { id: true, name: true, avatarUrl: true, bio: true } },
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              moduleId: true,
              title: true,
              durationSeconds: true,
              order: true,
              // content and videoUrl are intentionally excluded here — the
              // public/curriculum view must not leak lesson material to
              // non-enrolled users. Full lesson data is only served by the
              // enrollment-gated GET /lessons/:id endpoint.
              quizzes: { select: { id: true, title: true } },
            },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) throw ApiError.notFound("Course not found");
  return course;
}

export async function getCourseById(id: string) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw ApiError.notFound("Course not found");
  return course;
}

export async function assertOwnsCourse(instructorId: string, courseId: string) {
  const course = await getCourseById(courseId);
  if (course.instructorId !== instructorId) throw ApiError.forbidden("You do not own this course.");
  return course;
}

export async function createCourse(instructorId: string, data: {
  title: string;
  description: string;
  category: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  thumbnailUrl?: string;
}) {
  const baseSlug = slugify(data.title);
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.course.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  return prisma.course.create({
    data: { ...data, slug, instructorId },
  });
}

export async function updateCourse(instructorId: string, courseId: string, data: Partial<{
  title: string; description: string; category: string; level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"; thumbnailUrl: string; isPublished: boolean;
}>) {
  await assertOwnsCourse(instructorId, courseId);
  return prisma.course.update({ where: { id: courseId }, data });
}

export async function deleteCourse(instructorId: string, courseId: string) {
  await assertOwnsCourse(instructorId, courseId);
  await prisma.course.delete({ where: { id: courseId } });
}

export async function getCourseForInstructor(instructorId: string, courseId: string) {
  await assertOwnsCourse(instructorId, courseId);
  return prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" }, include: { quizzes: { select: { id: true, title: true } } } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
}

export async function listInstructorCourses(instructorId: string) {
  return prisma.course.findMany({
    where: { instructorId },
    include: { modules: { include: { lessons: true } }, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// --- Modules ---

export async function createModule(instructorId: string, courseId: string, data: { title: string; description?: string }) {
  await assertOwnsCourse(instructorId, courseId);
  const maxOrder = await prisma.module.aggregate({ where: { courseId }, _max: { order: true } });
  return prisma.module.create({
    data: { ...data, courseId, order: (maxOrder._max.order ?? -1) + 1 },
  });
}

export async function updateModule(instructorId: string, moduleId: string, data: Partial<{ title: string; description: string; order: number }>) {
  const module = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  await assertOwnsCourse(instructorId, module.courseId);
  return prisma.module.update({ where: { id: moduleId }, data });
}

export async function deleteModule(instructorId: string, moduleId: string) {
  const module = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  await assertOwnsCourse(instructorId, module.courseId);
  await prisma.module.delete({ where: { id: moduleId } });
}

export async function reorderModules(instructorId: string, courseId: string, orderedIds: string[]) {
  await assertOwnsCourse(instructorId, courseId);
  await prisma.$transaction(orderedIds.map((id, index) => prisma.module.update({ where: { id }, data: { order: index } })));
}

// --- Lessons ---

async function assertOwnsModule(instructorId: string, moduleId: string) {
  const module = await prisma.module.findUniqueOrThrow({ where: { id: moduleId } });
  await assertOwnsCourse(instructorId, module.courseId);
  return module;
}

export async function createLesson(instructorId: string, moduleId: string, data: {
  title: string; content?: string; videoUrl?: string; durationSeconds?: number;
}) {
  await assertOwnsModule(instructorId, moduleId);
  const maxOrder = await prisma.lesson.aggregate({ where: { moduleId }, _max: { order: true } });
  const lesson = await prisma.lesson.create({
    data: { ...data, moduleId, order: (maxOrder._max.order ?? -1) + 1 },
  });
  if (lesson.content) await ingestLessonContent(lesson.id).catch((e) => console.error("Ingestion failed:", e));
  return lesson;
}

export async function updateLesson(instructorId: string, lessonId: string, data: Partial<{
  title: string; content: string; videoUrl: string; durationSeconds: number; order: number;
}>) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { module: true } });
  await assertOwnsCourse(instructorId, lesson.module.courseId);
  const updated = await prisma.lesson.update({ where: { id: lessonId }, data });
  if (data.content !== undefined) await ingestLessonContent(lessonId).catch((e) => console.error("Ingestion failed:", e));
  return updated;
}

export async function deleteLesson(instructorId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { module: true } });
  await assertOwnsCourse(instructorId, lesson.module.courseId);
  await prisma.lesson.delete({ where: { id: lessonId } });
}

export async function reorderLessons(instructorId: string, moduleId: string, orderedIds: string[]) {
  await assertOwnsModule(instructorId, moduleId);
  await prisma.$transaction(orderedIds.map((id, index) => prisma.lesson.update({ where: { id }, data: { order: index } })));
}

export async function getLessonById(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: true } }, quizzes: { select: { id: true, title: true } } },
  });
  if (!lesson) throw ApiError.notFound("Lesson not found");
  return lesson;
}

export async function listCategories() {
  const rows = await prisma.course.findMany({ where: { isPublished: true }, select: { category: true }, distinct: ["category"] });
  return rows.map((r) => r.category);
}
