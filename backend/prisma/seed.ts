import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/utils/slugify";
import { ingestLessonContent } from "../src/services/ai/ingestion";
import { COURSES } from "./seedContent";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.$transaction([
    prisma.quizAnswer.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.question.deleteMany(),
    prisma.quiz.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.aIMessage.deleteMany(),
    prisma.aIConversation.deleteMany(),
    prisma.studyResource.deleteMany(),
    prisma.documentChunk.deleteMany(),
    prisma.document.deleteMany(),
    prisma.activityEvent.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.module.deleteMany(),
    prisma.course.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash("Instructor123!", 12);
  const studentPasswordHash = await bcrypt.hash("Student123!", 12);

  const instructorSarah = await prisma.user.create({
    data: {
      name: "Sarah Chen",
      email: "instructor@skillforge.dev",
      passwordHash,
      role: "INSTRUCTOR",
      bio: "Senior software engineer turned educator. 10 years building web platforms before moving into teaching full-stack development and applied ML.",
    },
  });

  const instructorDavid = await prisma.user.create({
    data: {
      name: "David Kim",
      email: "david.kim@skillforge.dev",
      passwordHash: await bcrypt.hash("Instructor123!", 12),
      role: "INSTRUCTOR",
      bio: "ML/AI engineer and cloud architect. Focused on making generative AI and infrastructure concepts practical for working developers.",
    },
  });

  const studentAlex = await prisma.user.create({
    data: {
      name: "Alex Rivera",
      email: "student@skillforge.dev",
      passwordHash: studentPasswordHash,
      role: "STUDENT",
      bio: "Learning full-stack development and AI engineering.",
    },
  });

  const fillerStudents = await Promise.all(
    [
      { name: "Priya Patel", email: "priya.patel@example.com" },
      { name: "Jordan Lee", email: "jordan.lee@example.com" },
      { name: "Maria Gonzalez", email: "maria.gonzalez@example.com" },
    ].map((s) =>
      prisma.user.create({
        data: { ...s, passwordHash: studentPasswordHash, role: "STUDENT" },
      }),
    ),
  );

  const instructors = [instructorSarah, instructorSarah, instructorDavid, instructorDavid];

  const createdCourses: Array<{ id: string; slug: string; title: string }> = [];
  const lessonRefs: Array<{ id: string; title: string; courseId: string; courseSlug: string }> = [];
  const quizRefs: Array<{ id: string; lessonId: string; questions: { id: string; topic: string | null; correctOption: number }[] }> = [];

  for (let i = 0; i < COURSES.length; i++) {
    const courseSeed = COURSES[i];
    const slug = slugify(courseSeed.title);

    const course = await prisma.course.create({
      data: {
        title: courseSeed.title,
        slug,
        description: courseSeed.description,
        category: courseSeed.category,
        level: courseSeed.level,
        thumbnailUrl: `https://picsum.photos/seed/${courseSeed.thumbnailSeed}/800/450`,
        isPublished: true,
        instructorId: instructors[i].id,
      },
    });
    createdCourses.push({ id: course.id, slug: course.slug, title: course.title });

    for (let mIdx = 0; mIdx < courseSeed.modules.length; mIdx++) {
      const moduleSeed = courseSeed.modules[mIdx];
      const module = await prisma.module.create({
        data: {
          courseId: course.id,
          title: moduleSeed.title,
          description: moduleSeed.description,
          order: mIdx,
        },
      });

      for (let lIdx = 0; lIdx < moduleSeed.lessons.length; lIdx++) {
        const lessonSeed = moduleSeed.lessons[lIdx];
        const lesson = await prisma.lesson.create({
          data: {
            moduleId: module.id,
            title: lessonSeed.title,
            content: lessonSeed.content,
            videoUrl: lessonSeed.videoUrl,
            durationSeconds: lessonSeed.durationSeconds,
            order: lIdx,
          },
        });
        lessonRefs.push({ id: lesson.id, title: lesson.title, courseId: course.id, courseSlug: course.slug });

        // Ingest lesson material into the RAG pipeline (chunk + embed + store)
        // right away, so the AI Tutor and study-resource generation have
        // real, retrievable material as soon as seeding finishes.
        await ingestLessonContent(lesson.id);

        if (lessonSeed.quiz) {
          const quiz = await prisma.quiz.create({
            data: {
              lessonId: lesson.id,
              title: lessonSeed.quiz.title,
              description: `Check your understanding of "${lessonSeed.title}".`,
              passingScore: lessonSeed.quiz.passingScore,
              questions: {
                create: lessonSeed.quiz.questions.map((q, order) => ({
                  prompt: q.prompt,
                  options: q.options,
                  correctOption: q.correctOption,
                  explanation: q.explanation,
                  topic: q.topic,
                  order,
                })),
              },
            },
            include: { questions: true },
          });
          quizRefs.push({
            id: quiz.id,
            lessonId: lesson.id,
            questions: quiz.questions.map((q) => ({ id: q.id, topic: q.topic, correctOption: q.correctOption })),
          });
        }
      }
    }
  }

  console.log(`Created ${createdCourses.length} courses, ${lessonRefs.length} lessons, ${quizRefs.length} quizzes.`);

  // --- Enrollments & progress for the primary demo student (Alex) ---

  async function enrollAndProgress(userId: string, courseIndex: number, completionFraction: number) {
    const course = createdCourses[courseIndex];
    const enrollment = await prisma.enrollment.create({
      data: { userId, courseId: course.id, enrolledAt: daysAgo(20 - courseIndex * 3) },
    });
    await prisma.activityEvent.create({
      data: { userId, courseId: course.id, type: "ENROLLED", createdAt: enrollment.enrolledAt },
    });

    const modules = await prisma.module.findMany({
      where: { courseId: course.id },
      orderBy: { order: "asc" },
      include: { lessons: { orderBy: { order: "asc" } } },
    });
    const lessons = modules.flatMap((m) => m.lessons);
    const completeCount = Math.round(lessons.length * completionFraction);

    for (let i = 0; i < lessons.length; i++) {
      const completed = i < completeCount;
      const activityDate = daysAgo(15 - courseIndex * 2 - i);
      await prisma.lessonProgress.create({
        data: {
          userId,
          lessonId: lessons[i].id,
          enrollmentId: enrollment.id,
          completed,
          completedAt: completed ? activityDate : null,
          lastPositionSeconds: completed ? lessons[i].durationSeconds : Math.floor(lessons[i].durationSeconds * 0.3),
        },
      });
      if (completed) {
        await prisma.activityEvent.create({
          data: { userId, courseId: course.id, type: "LESSON_COMPLETED", metadata: { lessonId: lessons[i].id }, createdAt: activityDate },
        });
      }

      // Attempt the quiz for completed lessons that have one.
      if (completed) {
        const quiz = quizRefs.find((q) => q.lessonId === lessons[i].id);
        if (quiz) {
          await attemptQuiz(userId, quiz, courseIndex, activityDate);
        }
      }
    }

    if (completeCount === lessons.length && lessons.length > 0) {
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: daysAgo(2) } });
    }

    return enrollment;
  }

  async function attemptQuiz(
    userId: string,
    quiz: { id: string; questions: { id: string; topic: string | null; correctOption: number }[] },
    courseIndex: number,
    when: Date,
  ) {
    // Intentionally make the student weaker on some topics so weak-topic
    // analytics has real signal to surface, not just uniformly high scores.
    const weakTopics = ["Overfitting & Regularization", "Infrastructure as Code", "Containerization"];

    const attempt = await prisma.quizAttempt.create({
      data: { quizId: quiz.id, userId, totalQuestions: quiz.questions.length, startedAt: when, submittedAt: when },
    });

    let correctCount = 0;
    const answers = quiz.questions.map((q) => {
      const isWeak = q.topic ? weakTopics.includes(q.topic) : false;
      const getsItRight = isWeak ? Math.random() < 0.35 : Math.random() < 0.85;
      const selectedOption = getsItRight ? q.correctOption : (q.correctOption + 1) % 4;
      if (getsItRight) correctCount += 1;
      return { attemptId: attempt.id, questionId: q.id, selectedOption, isCorrect: getsItRight };
    });

    await prisma.quizAnswer.createMany({ data: answers });
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { correctCount, score, passed: score >= 70 },
    });
    await prisma.activityEvent.create({
      data: { userId, type: "QUIZ_ATTEMPTED", metadata: { quizId: quiz.id, score }, createdAt: when },
    });
  }

  await enrollAndProgress(studentAlex.id, 0, 1.0); // Full-Stack course: complete
  await enrollAndProgress(studentAlex.id, 1, 0.5); // ML Fundamentals: half done
  await enrollAndProgress(studentAlex.id, 2, 0.25); // GenAI & LLMs: just started
  await enrollAndProgress(studentAlex.id, 3, 0.0); // Cloud & DevOps: enrolled only

  // Filler students spread across courses so instructor analytics has
  // realistic enrollment counts and score distributions.
  for (const student of fillerStudents) {
    await enrollAndProgress(student.id, 0, Math.random() > 0.5 ? 1.0 : 0.6);
    await enrollAndProgress(student.id, 1, Math.random() > 0.5 ? 0.8 : 0.4);
  }

  // --- Sample AI Tutor conversation (realistic, grounded, pre-written) ---

  const ragCourse = createdCourses[2]; // Generative AI & LLMs
  const conversation = await prisma.aIConversation.create({
    data: {
      userId: studentAlex.id,
      courseId: ragCourse.id,
      title: "Why does RAG reduce hallucination?",
    },
  });
  await prisma.aIMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: "Why does retrieval-augmented generation reduce hallucination compared to just asking the LLM directly?" },
  });
  await prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content:
        "Grounding is the key idea (Source 1). Instead of relying on whatever the model memorized during training, RAG retrieves the specific passages most relevant to your question from this course's material and puts them directly in the prompt, so the model is generating from text it can literally see rather than recalling facts it may have gotten wrong. On top of that, the system prompt explicitly instructs the model to say when the provided context doesn't answer the question, rather than guessing (Source 1) — that explicit permission to decline is one of the most effective single levers for reducing hallucination in a RAG system.",
      sources: [
        {
          lessonId: lessonRefs.find((l) => l.courseId === ragCourse.id && l.title === "Building a RAG Pipeline")?.id ?? null,
          lessonTitle: "Building a RAG Pipeline",
          documentTitle: "Building a RAG Pipeline",
          similarity: 0.41,
          preview: "Prompt construction is where retrieved chunks get turned into grounding for the LLM: a system prompt instructs the model to answer using only the provided context...",
        },
      ],
    },
  });
  await prisma.activityEvent.create({ data: { userId: studentAlex.id, courseId: ragCourse.id, type: "AI_TUTOR_USED", createdAt: daysAgo(1) } });

  // --- Sample generated study resources (pre-written, realistic shape) ---

  await prisma.studyResource.create({
    data: {
      userId: studentAlex.id,
      courseId: ragCourse.id,
      type: "FLASHCARDS",
      title: "Flashcards — Generative AI & Large Language Models",
      content: {
        flashcards: [
          { front: "What are the three vectors self-attention projects each token into?", back: "Query, Key, and Value." },
          { front: "Why are positional encodings needed in a transformer?", back: "Self-attention has no inherent sense of token order, so position must be injected explicitly." },
          { front: "What problem does chunking solve in a RAG pipeline?", back: "It balances passage specificity against needed context — chunks that are too large or too small both hurt retrieval quality." },
          { front: "What is the most effective instruction for reducing hallucination in a RAG system?", back: "Explicitly telling the model to say when the provided context doesn't answer the question, rather than guessing." },
        ],
      },
    },
  });

  await prisma.studyResource.create({
    data: {
      userId: studentAlex.id,
      courseId: createdCourses[1].id,
      type: "SUMMARY",
      title: "Summary — Machine Learning Fundamentals with Python",
      content: {
        summary:
          "This course covers the foundational vocabulary of machine learning (supervised vs. unsupervised learning, classification vs. regression), how linear regression is trained and evaluated, and how neural networks extend these ideas with layered nonlinear transformations trained via backpropagation, while covering the regularization techniques (dropout, early stopping, cross-validation) needed to keep models from overfitting.",
        keyTakeaways: [
          "Supervised learning uses labeled data; unsupervised learning finds structure without labels.",
          "A held-out test set must be touched only once, at the end, to give an honest accuracy estimate.",
          "Accuracy alone can be misleading on imbalanced datasets — precision, recall, and F1 give a fuller picture.",
          "Nonlinear activations are what let stacked neural network layers model complex functions.",
          "Overfitting shows up as a gap between training and validation performance, and is mitigated with dropout, early stopping, and regularization.",
        ],
      },
    },
  });

  console.log("\nSeed complete.\n");
  console.log("Demo credentials:");
  console.log("  Instructor: instructor@skillforge.dev / Instructor123!");
  console.log("  Student:    student@skillforge.dev / Student123!");
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
