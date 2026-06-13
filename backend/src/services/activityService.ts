import { prisma } from "../lib/prisma";

export type ActivityType = "ENROLLED" | "LESSON_COMPLETED" | "QUIZ_ATTEMPTED" | "AI_TUTOR_USED" | "RESOURCE_GENERATED";

export async function logActivity(userId: string, type: ActivityType, courseId?: string, metadata?: object) {
  return prisma.activityEvent.create({
    data: { userId, type, courseId, metadata: metadata as object | undefined },
  });
}

/**
 * Learning streak = consecutive days (ending today or yesterday) that have
 * at least one activity event. Computed from real ActivityEvent rows, not
 * stored, so it's always accurate.
 */
export async function computeStreak(userId: string): Promise<number> {
  const events = await prisma.activityEvent.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  if (events.length === 0) return 0;

  const days = new Set(events.map((e) => e.createdAt.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date();

  const todayKey = cursor.toISOString().slice(0, 10);
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export async function recentActivity(userId: string, limit = 10) {
  return prisma.activityEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { course: { select: { title: true, slug: true } } },
  });
}
