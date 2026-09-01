import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppLayout } from "../../components/layout/AppLayout";
import { api } from "../../lib/api";
import { Badge, Card, ErrorState, PageSpinner, ProgressBar } from "../../components/ui";

interface CourseAnalytics {
  course: { id: string; title: string; isPublished: boolean; totalLessons: number; moduleCount: number };
  students: Array<{ userId: string; name: string; email: string; progress: { percent: number; completedLessons: number; totalLessons: number }; enrolledAt: string; completedAt: string | null }>;
  quizzes: Array<{ quizId: string; title: string; lessonTitle: string; questionCount: number; attemptCount: number; avgScore: number | null; passRate: number | null }>;
  topicBreakdown: Array<{ topic: string; accuracy: number; totalAnswers: number }>;
}

export default function CourseAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["course-analytics", id],
    queryFn: async () => (await api.get<CourseAnalytics>(`/analytics/instructor/courses/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !data) return <AppLayout><ErrorState message="Couldn't load analytics." onRetry={() => refetch()} /></AppLayout>;

  const quizChartData = data.quizzes.filter((q) => q.avgScore !== null).map((q) => ({ name: q.title.slice(0, 18), score: q.avgScore }));

  return (
    <AppLayout>
      <div className="mb-8">
        <Badge tone={data.course.isPublished ? "green" : "amber"}>{data.course.isPublished ? "Published" : "Draft"}</Badge>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{data.course.title}</h1>
        <p className="mt-1 text-slate-500">
          {data.students.length} students · {data.course.moduleCount} modules · {data.course.totalLessons} lessons
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Average quiz score by quiz</h2>
            {quizChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No quiz attempts yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={quizChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Avg score"]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  <Bar dataKey="score" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div>
            <h2 className="mb-4 text-base font-semibold text-slate-900">Student progress</h2>
            <Card>
              {data.students.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-400">No students enrolled yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-5 py-3 font-medium">Student</th>
                        <th className="px-5 py-3 font-medium">Progress</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.students.map((s) => (
                        <tr key={s.userId}>
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-800">{s.name}</p>
                            <p className="text-xs text-slate-400">{s.email}</p>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <ProgressBar value={s.progress.percent} className="w-28" />
                              <span className="text-xs text-slate-500">{s.progress.percent}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={s.completedAt ? "green" : "slate"}>{s.completedAt ? "Completed" : "In progress"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Quizzes</h3>
            <ul className="space-y-3">
              {data.quizzes.map((q) => (
                <li key={q.quizId} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-800">{q.title}</p>
                  <p className="text-xs text-slate-400">{q.lessonTitle}</p>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{q.attemptCount} attempts</span>
                    <span>{q.avgScore !== null ? `${q.avgScore}% avg` : "—"}</span>
                    <span>{q.passRate !== null ? `${q.passRate}% pass` : "—"}</span>
                  </div>
                </li>
              ))}
              {data.quizzes.length === 0 && <p className="text-sm text-slate-400">No quizzes yet.</p>}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Topic accuracy across students</h3>
            {data.topicBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400">No quiz data yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.topicBreakdown
                  .sort((a, b) => a.accuracy - b.accuracy)
                  .map((t) => (
                    <li key={t.topic}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{t.topic}</span>
                        <span className={`font-medium ${t.accuracy < 70 ? "text-amber-600" : "text-emerald-600"}`}>{t.accuracy}%</span>
                      </div>
                      <ProgressBar value={t.accuracy} tone={t.accuracy < 70 ? "brand" : "green"} className="mt-1.5 h-1.5" />
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
