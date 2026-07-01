import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileQuestion, Layers, Lock, PlayCircle, Users } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../components/layout/AppLayout";
import { api, getErrorMessage } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, Card, ErrorState, PageSpinner } from "../components/ui";
import type { CourseDetail } from "../types";

const levelTone = { BEGINNER: "green", INTERMEDIATE: "amber", ADVANCED: "red" } as const;

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10}h` : `${minutes}m`;
}

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);

  const {
    data: course,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => (await api.get<{ course: CourseDetail }>(`/courses/${slug}`)).data.course,
    enabled: !!slug,
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ["enrollments", "mine"],
    queryFn: async () => (await api.get<{ enrollments: Array<{ course: { id: string } }> }>("/enrollments/mine")).data.enrollments,
    enabled: user?.role === "STUDENT",
  });

  const isEnrolled = !!course && !!myEnrollments?.some((e) => e.course.id === course.id);

  const enrollMutation = useMutation({
    mutationFn: async () => api.post("/enrollments", { courseId: course!.id }),
    onSuccess: () => {
      toast.success("Enrolled! Let's get started.");
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      navigate(`/learn/${slug}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !course) return <AppLayout><ErrorState message="Course not found." /></AppLayout>;

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalSeconds = course.modules.reduce((sum, m) => sum + m.lessons.reduce((s, l) => s + l.durationSeconds, 0), 0);

  function handlePrimaryCta() {
    if (!user) return navigate("/login", { state: { from: `/courses/${slug}` } });
    if (user.role === "INSTRUCTOR") return;
    if (isEnrolled) return navigate(`/learn/${slug}`);
    enrollMutation.mutate();
  }

  return (
    <AppLayout>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Badge tone={levelTone[course.level]}>{course.level}</Badge>
            <Badge tone="slate">{course.category}</Badge>
            {!course.isPublished && <Badge tone="amber">Draft — preview only</Badge>}
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{course.title}</h1>
          <p className="mt-3 text-slate-600">{course.description}</p>

          <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> {course.modules.length} modules · {totalLessons} lessons
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {formatDuration(totalSeconds)} total
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {course._count.enrollments} students enrolled
            </span>
          </div>

          <div className="mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
            {course.thumbnailUrl && <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
          </div>

          <h2 className="mb-4 mt-10 text-xl font-bold text-slate-900">Course content</h2>
          <div className="space-y-3">
            {course.modules.map((module, mIdx) => {
              const isOpen = openModuleId === module.id || (openModuleId === null && mIdx === 0);
              return (
                <Card key={module.id}>
                  <button
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                    onClick={() => setOpenModuleId(isOpen ? "__none__" : module.id)}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        Module {mIdx + 1}: {module.title}
                      </p>
                      {module.description && <p className="mt-0.5 text-sm text-slate-500">{module.description}</p>}
                    </div>
                    <span className="text-sm text-slate-400">{module.lessons.length} lessons</span>
                  </button>
                  {isOpen && (
                    <ul className="border-t border-slate-100">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center justify-between px-5 py-3 text-sm">
                          <span className="flex items-center gap-2.5 text-slate-700">
                            {isEnrolled ? <PlayCircle className="h-4 w-4 text-brand-600" /> : <Lock className="h-4 w-4 text-slate-300" />}
                            {lesson.title}
                            {lesson.quizzes.length > 0 && <FileQuestion className="h-3.5 w-3.5 text-slate-400" />}
                          </span>
                          <span className="text-slate-400">{formatDuration(lesson.durationSeconds)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <div>
          <Card className="sticky top-24 p-6">
            {isEnrolled && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> You're enrolled
              </div>
            )}
            {user?.role !== "INSTRUCTOR" && (
              <Button className="w-full" size="lg" onClick={handlePrimaryCta} isLoading={enrollMutation.isPending}>
                {!user ? "Log in to enroll" : isEnrolled ? "Continue learning" : "Enroll now — it's free"}
              </Button>
            )}
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {course.instructor.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{course.instructor.name}</p>
                  <p className="text-xs text-slate-500">Instructor</p>
                </div>
              </div>
              {course.instructor.bio && <p className="text-slate-500">{course.instructor.bio}</p>}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
