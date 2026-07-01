export type Role = "STUDENT" | "INSTRUCTOR";
export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
}

export interface Instructor {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
}

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  level: CourseLevel;
  thumbnailUrl: string | null;
  isPublished: boolean;
  instructorId: string;
  instructor: Instructor;
  modules: { lessons: { id: string; durationSeconds: number }[] }[];
  _count: { enrollments: number };
  createdAt: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationSeconds: number;
  order: number;
  quizzes: { id: string; title: string }[];
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  lessons: Lesson[];
}

export interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  level: CourseLevel;
  thumbnailUrl: string | null;
  isPublished: boolean;
  instructorId: string;
  instructor: Instructor;
  modules: Module[];
  _count: { enrollments: number };
}

export interface QuizQuestionForAttempt {
  id: string;
  prompt: string;
  type: string;
  options: string[];
  order: number;
}

export interface QuizForAttempt {
  id: string;
  title: string;
  description: string | null;
  timeLimitSeconds: number | null;
  passingScore: number;
  questions: QuizQuestionForAttempt[];
}

export interface QuizResultQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOption: number;
  explanation: string | null;
  topic: string | null;
  selectedOption: number | null;
  isCorrect: boolean;
}

export interface QuizResult {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  submittedAt: string | null;
  questions: QuizResultQuestion[];
}

export interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  percent: number;
}

export interface EnrolledCourseCard {
  enrollmentId: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnailUrl: string | null;
    instructorName: string;
  };
  progress: CourseProgress;
  completedAt: string | null;
  lastAccessedAt: string;
}

export interface WeakTopic {
  topic: string;
  accuracy: number;
  attempts: number;
}

export interface Recommendation {
  type: "RESUME_LESSON" | "WEAK_TOPIC";
  courseId: string;
  courseTitle: string;
  label: string;
  lessonId?: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  createdAt: string;
  course: { title: string; slug: string } | null;
  metadata: Record<string, unknown> | null;
}

export interface StudentDashboard {
  stats: {
    enrolledCourses: number;
    completedCourses: number;
    averageQuizScore: number | null;
    learningStreakDays: number;
    hoursLearned: number;
  };
  continueLearning: EnrolledCourseCard | null;
  courses: EnrolledCourseCard[];
  recentQuizAttempts: Array<{
    id: string;
    quizTitle: string;
    lessonTitle: string;
    score: number;
    passed: boolean;
    submittedAt: string | null;
  }>;
  weakTopics: WeakTopic[];
  recentActivity: ActivityItem[];
  recommendations: Recommendation[];
}

export interface InstructorCourseStats {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  enrollmentCount: number;
  completionRate: number;
  avgQuizScore: number | null;
  lessonCount: number;
  moduleCount: number;
  createdAt: string;
}

export interface InstructorDashboard {
  stats: {
    totalCourses: number;
    publishedCourses: number;
    totalStudents: number;
    totalEnrollments: number;
  };
  courses: InstructorCourseStats[];
}

export interface TutorSource {
  lessonId: string | null;
  lessonTitle: string | null;
  documentTitle: string;
  similarity: number;
  preview: string;
}

export interface TutorMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: TutorSource[] | null;
  createdAt: string;
}

export interface TutorConversation {
  id: string;
  title: string;
  courseId: string | null;
  course?: { title: string } | null;
  updatedAt: string;
  messages?: TutorMessage[];
  _count?: { messages: number };
}

export type StudyResourceType =
  | "SUMMARY"
  | "FLASHCARDS"
  | "PRACTICE_QUESTIONS"
  | "KEY_CONCEPTS"
  | "STUDY_PLAN"
  | "REVISION_NOTES";

export interface StudyResource {
  id: string;
  type: StudyResourceType;
  title: string;
  content: unknown;
  createdAt: string;
  course?: { title: string };
  courseId: string;
  lessonId: string | null;
}

export interface ApiErrorShape {
  error: string;
  details?: Array<{ path: string; message: string }>;
}
