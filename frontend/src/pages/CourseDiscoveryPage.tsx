import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Search, Users, Layers, Clock } from "lucide-react";
import { AppLayout } from "../components/layout/AppLayout";
import { api } from "../lib/api";
import { Badge, Card, EmptyState, ErrorState, Select, Skeleton } from "../components/ui";
import type { CourseSummary } from "../types";

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return debounced;
}

function totalDuration(course: CourseSummary): string {
  const seconds = course.modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.durationSeconds, 0), 0);
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return hours > 0 ? `${hours}h` : "—";
}

function lessonCount(course: CourseSummary): number {
  return course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
}

const levelTone = { BEGINNER: "green", INTERMEDIATE: "amber", ADVANCED: "red" } as const;

export default function CourseDiscoveryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const debouncedSearch = useDebounced(search);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<{ categories: string[] }>("/courses/categories")).data.categories,
  });

  const {
    data: courses,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["courses", debouncedSearch, category, level],
    queryFn: async () =>
      (
        await api.get<{ courses: CourseSummary[] }>("/courses", {
          params: { search: debouncedSearch || undefined, category: category || undefined, level: level || undefined },
        })
      ).data.courses,
  });

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Explore courses</h1>
        <p className="mt-1 text-slate-500">Find your next skill. Search, filter by category and level.</p>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses by title, topic, or description..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm focus-ring focus-visible:border-brand-500"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={level} onChange={(e) => setLevel(e.target.value)} className="sm:w-44">
          <option value="">All levels</option>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
        </Select>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}

      {isError && <ErrorState message="Couldn't load courses right now." onRetry={() => refetch()} />}

      {!isLoading && !isError && courses?.length === 0 && (
        <EmptyState title="No courses match your filters" description="Try a different search term or clear your filters." />
      )}

      {!isLoading && !isError && courses && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} to={`/courses/${course.slug}`}>
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {course.thumbnailUrl && (
                    <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={levelTone[course.level]}>{course.level}</Badge>
                    <Badge tone="slate">{course.category}</Badge>
                  </div>
                  <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{course.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{course.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span>{course.instructor.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {lessonCount(course)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {totalDuration(course)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {course._count.enrollments}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
