import { PrismaClient } from "@prisma/client";

export const testPrisma = new PrismaClient();

export async function resetDatabase() {
  await testPrisma.$transaction([
    testPrisma.quizAnswer.deleteMany(),
    testPrisma.quizAttempt.deleteMany(),
    testPrisma.question.deleteMany(),
    testPrisma.quiz.deleteMany(),
    testPrisma.lessonProgress.deleteMany(),
    testPrisma.aIMessage.deleteMany(),
    testPrisma.aIConversation.deleteMany(),
    testPrisma.studyResource.deleteMany(),
    testPrisma.documentChunk.deleteMany(),
    testPrisma.document.deleteMany(),
    testPrisma.activityEvent.deleteMany(),
    testPrisma.enrollment.deleteMany(),
    testPrisma.lesson.deleteMany(),
    testPrisma.module.deleteMany(),
    testPrisma.course.deleteMany(),
    testPrisma.user.deleteMany(),
  ]);
}
