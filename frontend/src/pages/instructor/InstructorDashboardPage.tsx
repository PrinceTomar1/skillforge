import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, BookOpen, PlusCircle, TrendingUp, Users } from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";
import { api } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorState, PageSpinner, ProgressBar, StatCard } from "../../components/ui";
import type { InstructorDashboard } from "../../types";

export default function InstructorDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard", "instructor"],
    queryFn: async () => (await api.get<InstructorDashboard>("/analytics/instructor")).data,
  });

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !data) return <AppLayout><ErrorState message="Couldn't load your dashboard." onRetry={() => refetch()} /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Instructor dashboard</h1>
          <p className="mt-1 text-slate-500">An overview of your courses and student engagement.</p>
        </div>
        <Link to="/instructor/courses" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <PlusCircle className="h-4 w-4" /> Manage courses
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total courses" value={data.stats.totalCourses} icon={<BookOpen className="h-4 w-4" />} />
        <StatCard label="Published" value={data.stats.publishedCourses} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Total students" value={data.stats.totalStudents} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Total enrollments" value={data.stats.totalEnrollments} icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Your courses</h2>
      </div>

      {data.courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="You haven't created any courses yet"
          description="Create your first course to start teaching students."
          action={
            <Link to="/instructor/courses" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Create a course
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{c.title}</h3>
                <Badge tone={c.isPublished ? "green" : "amber"}>{c.isPublished ? "Published" : "Draft"}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-sm font-bold text-slate-900">{c.enrollmentCount}</p>
                  <p className="text-slate-500">Students</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-sm font-bold text-slate-900">{c.avgQuizScore ?? "—"}</p>
                  <p className="text-slate-500">Avg score</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <p className="text-sm font-bold text-slate-900">{c.completionRate}%</p>
                  <p className="text-slate-500">Completion</p>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={c.completionRate} />
              </div>
              <div className="mt-4 flex gap-2">
                <Link to={`/instructor/courses/${c.id}/edit`} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Manage
                </Link>
                <Link to={`/instructor/courses/${c.id}/analytics`} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Analytics
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
