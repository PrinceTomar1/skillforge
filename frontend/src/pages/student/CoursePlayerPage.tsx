import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, FileQuestion, Menu, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { api, getErrorMessage } from "../../lib/api";
import { Badge, Button, PageSpinner, ProgressBar } from "../../components/ui";
import type { CourseDetail, Lesson } from "../../types";

interface LessonProgressRow {
  lessonId: string;
  completed: boolean;
  lastPositionSeconds: number;
}

export default function CoursePlayerPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", slug],
    queryFn: async () => (await api.get<{ course: CourseDetail }>(`/courses/${slug}`)).data.course,
    enabled: !!slug,
  });

  const { data: progressRows } = useQuery({
    queryKey: ["lesson-progress", course?.id],
    queryFn: async () => (await api.get<{ lessons: LessonProgressRow[] }>(`/enrollments/${course!.id}/lesson-progress`)).data.lessons,
    enabled: !!course,
  });

  const { data: resumeLesson } = useQuery({
    queryKey: ["resume", course?.id],
    queryFn: async () => (await api.get<{ lesson: { id: string } | null }>(`/enrollments/${course!.id}/resume`)).data.lesson,
    enabled: !!course && !lessonId,
  });

  useEffect(() => {
    if (!lessonId && resumeLesson && slug) {
      navigate(`/learn/${slug}/lesson/${resumeLesson.id}`, { replace: true });
    }
  }, [lessonId, resumeLesson, slug, navigate]);

  const allLessons = course?.modules.flatMap((m) => m.lessons) ?? [];
  const activeLessonId = lessonId ?? allLessons[0]?.id;

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ["lesson", activeLessonId],
    queryFn: async () => (await api.get<{ lesson: Lesson }>(`/lessons/${activeLessonId}`)).data.lesson,
    enabled: !!activeLessonId,
  });

  const progressMap = new Map((progressRows ?? []).map((r) => [r.lessonId, r]));
  const isCompleted = activeLessonId ? !!progressMap.get(activeLessonId)?.completed : false;

  const completeMutation = useMutation({
    mutationFn: async (completed: boolean) => api.post("/progress", { lessonId: activeLessonId, completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lesson-progress", course?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "student"] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (courseLoading || !course) return <AppLayout wide><PageSpinner /></AppLayout>;

  const currentIndex = allLessons.findIndex((l) => l.id === activeLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const completedCount = (progressRows ?? []).filter((r) => r.completed).length;
  const percent = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  function goToLesson(id: string) {
    navigate(`/learn/${slug}/lesson/${id}`);
    setSidebarOpen(false);
  }

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <h2 className="line-clamp-2 text-sm font-bold text-slate-900">{course.title}</h2>
        <div className="mt-3 flex items-center gap-2">
          <ProgressBar value={percent} tone={percent === 100 ? "green" : "brand"} />
          <span className="text-xs font-medium text-slate-500">{percent}%</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {course.modules.map((module, mIdx) => (
          <div key={module.id} className="border-b border-slate-100">
            <p className="bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Module {mIdx + 1}: {module.title}
            </p>
            <ul>
              {module.lessons.map((l) => {
                const done = !!progressMap.get(l.id)?.completed;
                const active = l.id === activeLessonId;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => goToLesson(l.id)}
                      className={`flex w-full items-start gap-2.5 px-4 py-3 text-left text-sm transition-colors ${
                        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                      )}
                      <span className="flex-1">{l.title}</span>
                      {l.quizzes.length > 0 && <FileQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppLayout wide>
      <div className="flex h-[calc(100vh-8rem)] gap-6">
        <aside className="hidden w-80 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">{Sidebar}</aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-xl">
              <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
              {Sidebar}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="m-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 lg:hidden"
          >
            <Menu className="h-4 w-4" /> Lessons
          </button>

          {lessonLoading || !lesson ? (
            <PageSpinner />
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-8">
              {lesson.videoUrl && (
                <video
                  key={lesson.id}
                  src={lesson.videoUrl}
                  controls
                  className="mb-6 aspect-video w-full rounded-xl bg-black"
                  onEnded={() => !isCompleted && completeMutation.mutate(true)}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{lesson.title}</h1>
                {isCompleted && <Badge tone="green">Completed</Badge>}
              </div>

              {lesson.content && (
                <div className="prose-lesson mt-6 text-slate-700">
                  {lesson.content.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}

              {lesson.quizzes.length > 0 && (
                <div className="mt-8 rounded-xl border border-brand-100 bg-brand-50/60 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-brand-800">
                      <FileQuestion className="h-5 w-5" />
                      <p className="font-semibold">Check your understanding</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/quiz/${lesson.quizzes[0].id}`)}>
                      Take quiz
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                <Button variant="outline" disabled={!prevLesson} onClick={() => prevLesson && goToLesson(prevLesson.id)} icon={<ChevronLeft className="h-4 w-4" />}>
                  Previous
                </Button>

                <Button
                  variant={isCompleted ? "outline" : "primary"}
                  isLoading={completeMutation.isPending}
                  onClick={() => completeMutation.mutate(!isCompleted)}
                >
                  {isCompleted ? "Mark as incomplete" : "Mark as complete"}
                </Button>

                {nextLesson ? (
                  <Button variant="outline" onClick={() => goToLesson(nextLesson.id)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="w-24" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
