import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "../../components/layout/AppLayout";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorState, PageSpinner, ProgressBar } from "../../components/ui";
import type { StudentDashboard } from "../../types";

export default function ProgressDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "student"],
    queryFn: async () => (await api.get<StudentDashboard>("/analytics/student")).data,
  });

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !data) return <AppLayout><ErrorState message="Couldn't load your progress." onRetry={() => refetch()} /></AppLayout>;

  const chartData = [...data.recentQuizAttempts]
    .reverse()
    .map((a, i) => ({ name: `#${i + 1}`, score: a.score, title: a.quizTitle }));

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Your progress</h1>
        <p className="mt-1 text-slate-500">A detailed look at course completion and quiz performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Quiz score trend</h2>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Take some quizzes to see your trend here.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, "Score"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ""}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                  />
                  <Bar dataKey="score" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Course completion</h2>
            {data.courses.length === 0 ? (
              <EmptyState title="No enrolled courses yet" />
            ) : (
              <div className="space-y-3">
                {data.courses.map((c) => (
                  <Card key={c.enrollmentId} className="p-5">
                    <div className="flex items-center justify-between">
                      <Link to={`/learn/${c.course.slug}`} className="font-medium text-slate-900 hover:text-brand-600">
                        {c.course.title}
                      </Link>
                      {c.progress.percent === 100 ? <Badge tone="green">Complete</Badge> : <Badge tone="slate">In progress</Badge>}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <ProgressBar value={c.progress.percent} tone={c.progress.percent === 100 ? "green" : "brand"} />
                      <span className="text-sm font-medium text-slate-500">{c.progress.percent}%</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {c.progress.completedLessons} of {c.progress.totalLessons} lessons completed
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Weak topics</h3>
            {data.weakTopics.length === 0 ? (
              <p className="text-sm text-slate-400">No weak spots detected yet — keep taking quizzes to build this picture.</p>
            ) : (
              <ul className="space-y-3">
                {data.weakTopics.map((t) => (
                  <li key={t.topic}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{t.topic}</span>
                      <span className="font-medium text-amber-600">
                        {t.accuracy}% ({t.attempts} qs)
                      </span>
                    </div>
                    <ProgressBar value={t.accuracy} className="mt-1.5 h-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Quiz attempts</h3>
            {data.recentQuizAttempts.length === 0 ? (
              <p className="text-sm text-slate-400">No attempts yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentQuizAttempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-slate-700">{a.quizTitle}</span>
                    <Badge tone={a.passed ? "green" : "red"}>{a.score}%</Badge>
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
