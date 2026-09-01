import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Flame,
  PlayCircle,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Badge, Card, EmptyState, ErrorState, PageSpinner, ProgressBar, StatCard } from "../../components/ui";
import type { StudentDashboard } from "../../types";

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const activityLabels: Record<string, string> = {
  ENROLLED: "Enrolled in a course",
  LESSON_COMPLETED: "Completed a lesson",
  QUIZ_ATTEMPTED: "Attempted a quiz",
  AI_TUTOR_USED: "Asked the AI Tutor a question",
  RESOURCE_GENERATED: "Generated a study resource",
};

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: async () => (await api.get<StudentDashboard>("/analytics/student")).data,
  });

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !data) return <AppLayout><ErrorState message="Couldn't load your dashboard." onRetry={() => refetch()} /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name.split(" ")[0]} 👋</h1>
        <p className="mt-1 text-slate-500">Here's where you left off and how you're progressing.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Enrolled" value={data.stats.enrolledCourses} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Completed" value={data.stats.completedCourses} icon={<Target className="h-4 w-4" />} />
        <StatCard label="Avg. quiz score" value={data.stats.averageQuizScore !== null ? `${data.stats.averageQuizScore}%` : "—"} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Streak" value={`${data.stats.learningStreakDays}d`} icon={<Flame className="h-4 w-4" />} />
        <StatCard label="Hours learned" value={data.stats.hoursLearned} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {data.continueLearning && (
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Continue learning</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{data.continueLearning.course.title}</h2>
                  <p className="mt-1 text-sm text-slate-500">by {data.continueLearning.course.instructorName}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={data.continueLearning.progress.percent} className="w-40" />
                    <span className="text-sm font-medium text-slate-600">{data.continueLearning.progress.percent}%</span>
                  </div>
                </div>
                <Link
                  to={`/learn/${data.continueLearning.course.slug}`}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <PlayCircle className="h-4 w-4" /> Resume
                </Link>
              </div>
            </Card>
          )}

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Your courses</h2>
              <Link to="/courses" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Browse more →
              </Link>
            </div>
            {data.courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-8 w-8" />}
                title="You haven't enrolled in any courses yet"
                description="Browse the catalog and enroll in your first course to get started."
                action={
                  <Link to="/courses" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                    Browse courses
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {data.courses.map((c) => (
                  <Link key={c.enrollmentId} to={`/learn/${c.course.slug}`}>
                    <Card className="h-full p-5 transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{c.course.title}</h3>
                        {c.progress.percent === 100 && <Badge tone="green">Complete</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{c.course.instructorName}</p>
                      <div className="mt-4 flex items-center gap-3">
                        <ProgressBar value={c.progress.percent} tone={c.progress.percent === 100 ? "green" : "brand"} />
                        <span className="text-xs font-medium text-slate-500">{c.progress.percent}%</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {c.progress.completedLessons}/{c.progress.totalLessons} lessons complete
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Recent quiz attempts</h2>
            {data.recentQuizAttempts.length === 0 ? (
              <EmptyState title="No quiz attempts yet" description="Take a quiz after finishing a lesson to see your results here." />
            ) : (
              <Card>
                <ul className="divide-y divide-slate-100">
                  {data.recentQuizAttempts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{a.quizTitle}</p>
                        <p className="text-xs text-slate-500">{a.lessonTitle}</p>
                      </div>
                      <Badge tone={a.passed ? "green" : "red"}>{a.score}%</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <h3 className="font-semibold text-slate-900">AI Tutor</h3>
            </div>
            <p className="text-sm text-slate-500">Ask questions grounded in your course material, get cited answers.</p>
            <Link to="/ai-tutor" className="mt-4 block rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700">
              Open AI Tutor
            </Link>
          </Card>

          {data.recommendations.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 font-semibold text-slate-900">Recommended for you</h3>
              <ul className="space-y-3">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="text-sm">
                    {r.type === "RESUME_LESSON" && r.lessonId ? (
                      <Link to={`/learn/${data.courses.find((c) => c.course.id === r.courseId)?.course.slug ?? ""}/lesson/${r.lessonId}`} className="text-brand-700 hover:underline">
                        {r.label}
                      </Link>
                    ) : (
                      <Link to="/ai-tutor" className="text-brand-700 hover:underline">
                        {r.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.weakTopics.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-slate-900">Weak topics</h3>
              </div>
              <ul className="space-y-3">
                {data.weakTopics.slice(0, 5).map((t) => (
                  <li key={t.topic}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{t.topic}</span>
                      <span className="font-medium text-amber-600">{t.accuracy}%</span>
                    </div>
                    <ProgressBar value={t.accuracy} className="mt-1.5 h-1.5" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Recent activity</h3>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="text-slate-700">{activityLabels[a.type] ?? a.type}</p>
                    <p className="text-xs text-slate-400">
                      {a.course?.title ? `${a.course.title} · ` : ""}
                      {timeAgo(a.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
