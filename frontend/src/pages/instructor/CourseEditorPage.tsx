import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { api, getErrorMessage } from "../../lib/api";
import { Badge, Button, Card, ErrorState, Input, Label, PageSpinner, Textarea } from "../../components/ui";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { CourseLevel } from "../../types";

interface InstructorLesson {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  durationSeconds: number;
  order: number;
  quizzes: { id: string; title: string }[];
}
interface InstructorModule {
  id: string;
  title: string;
  description: string | null;
  order: number;
  lessons: InstructorLesson[];
}
interface InstructorFullCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  isPublished: boolean;
  modules: InstructorModule[];
}
interface CourseDocument {
  id: string;
  title: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  error: string | null;
  sourceType: string;
  lesson: { title: string } | null;
  _count: { chunks: number };
}

const statusTone = { PENDING: "slate", PROCESSING: "amber", READY: "green", FAILED: "red" } as const;

export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [moduleModal, setModuleModal] = useState<{ mode: "create" | "edit"; module?: InstructorModule } | null>(null);
  const [lessonModal, setLessonModal] = useState<{ moduleId: string; lesson?: InstructorLesson } | null>(null);
  const [deleteModule, setDeleteModule] = useState<InstructorModule | null>(null);
  const [deleteLesson, setDeleteLesson] = useState<InstructorLesson | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["instructor-course", id],
    queryFn: async () => (await api.get<{ course: InstructorFullCourse }>(`/courses/instructor/${id}/full`)).data.course,
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ["documents", id],
    queryFn: async () => (await api.get<{ documents: CourseDocument[] }>(`/documents/course/${id}`)).data.documents,
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.some((d) => d.status === "PENDING" || d.status === "PROCESSING") ? 2500 : false),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["instructor-course", id] });
  }

  const publishMutation = useMutation({
    mutationFn: async () => api.patch(`/courses/${id}`, { isPublished: !course?.isPublished }),
    onSuccess: () => {
      invalidate();
      toast.success(course?.isPublished ? "Course unpublished" : "Course published!");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveModuleMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) =>
      moduleModal?.mode === "edit" && moduleModal.module
        ? api.patch(`/courses/modules/${moduleModal.module.id}`, data)
        : api.post(`/courses/${id}/modules`, data),
    onSuccess: () => {
      invalidate();
      setModuleModal(null);
      toast.success("Module saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (moduleId: string) => api.delete(`/courses/modules/${moduleId}`),
    onSuccess: () => {
      invalidate();
      setDeleteModule(null);
      toast.success("Module deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveLessonMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; videoUrl: string; durationSeconds: number }) =>
      lessonModal?.lesson
        ? api.patch(`/lessons/${lessonModal.lesson.id}`, data)
        : api.post(`/lessons/modules/${lessonModal!.moduleId}/lessons`, data),
    onSuccess: () => {
      invalidate();
      setLessonModal(null);
      toast.success("Lesson saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => api.delete(`/lessons/${lessonId}`),
    onSuccess: () => {
      invalidate();
      setDeleteLesson(null);
      toast.success("Lesson deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const generateQuizMutation = useMutation({
    mutationFn: async (lessonId: string) => (await api.post<{ aiConfigured: boolean; quizId?: string; message?: string }>(`/quizzes/lessons/${lessonId}/generate`, {})).data,
    onSuccess: (data) => {
      invalidate();
      if (data.quizId) toast.success("Quiz generated — review it before publishing.");
      else toast(data.message ?? "Couldn't generate a quiz.", { icon: "⚠️" });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.post(`/documents/course/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      toast.success("Document uploaded — ingesting for the AI Tutor...");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => api.delete(`/documents/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      toast.success("Document removed");
    },
  });

  function toggleCollapse(moduleId: string) {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !course) return <AppLayout><ErrorState message="Couldn't load this course." /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={course.isPublished ? "green" : "amber"}>{course.isPublished ? "Published" : "Draft"}</Badge>
            <Badge tone="slate">{course.category}</Badge>
            <Badge tone="slate">{course.level}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{course.description}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/instructor/courses/${id}/analytics`}>
            <Button variant="outline">View analytics</Button>
          </Link>
          <Button variant={course.isPublished ? "outline" : "primary"} onClick={() => publishMutation.mutate()} isLoading={publishMutation.isPending}>
            {course.isPublished ? "Unpublish" : "Publish course"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Curriculum</h2>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setModuleModal({ mode: "create" })}>
              Add module
            </Button>
          </div>

          {course.modules.length === 0 ? (
            <Card className="p-10 text-center text-slate-500">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              No modules yet. Add your first module to start building the curriculum.
            </Card>
          ) : (
            <div className="space-y-3">
              {course.modules.map((module, mIdx) => {
                const collapsed = collapsedModules.has(module.id);
                return (
                  <Card key={module.id}>
                    <div className="flex items-center justify-between px-5 py-4">
                      <button className="flex flex-1 items-center gap-2 text-left" onClick={() => toggleCollapse(module.id)}>
                        {collapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
                        <span className="font-semibold text-slate-900">
                          Module {mIdx + 1}: {module.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModuleModal({ mode: "edit", module })}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button onClick={() => setDeleteModule(module)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {!collapsed && (
                      <div className="border-t border-slate-100">
                        <ul className="divide-y divide-slate-100">
                          {module.lessons.map((lesson) => (
                            <li key={lesson.id} className="flex items-center justify-between px-5 py-3">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{lesson.title}</p>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                                  {lesson.videoUrl && <span>Video</span>}
                                  {lesson.quizzes.length > 0 ? (
                                    <span className="flex items-center gap-1 text-brand-600">
                                      <FileQuestion className="h-3 w-3" /> {lesson.quizzes.length} quiz
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {lesson.quizzes.length > 0 ? (
                                  <Link to={`/instructor/quizzes/${lesson.quizzes[0].id}/edit`} className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                                    Edit quiz
                                  </Link>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => generateQuizMutation.mutate(lesson.id)}
                                      disabled={generateQuizMutation.isPending}
                                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                                    >
                                      <Sparkles className="h-3 w-3" /> AI Quiz
                                    </button>
                                  </>
                                )}
                                <button onClick={() => setLessonModal({ moduleId: module.id, lesson })} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                                  Edit
                                </button>
                                <button onClick={() => setDeleteLesson(lesson)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => setLessonModal({ moduleId: module.id })}
                          className="flex w-full items-center gap-2 px-5 py-3 text-sm font-medium text-brand-600 hover:bg-brand-50/50"
                        >
                          <Plus className="h-4 w-4" /> Add lesson
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Course documents</h2>
          </div>
          <Card className="p-5">
            <p className="mb-3 text-xs text-slate-500">
              Upload supplementary material (PDF, TXT, MD). It's chunked and embedded automatically so the AI Tutor can cite it.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" className="w-full" icon={<Upload className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()} isLoading={uploadMutation.isPending}>
              Upload document
            </Button>
            <ul className="mt-4 space-y-2">
              {documents?.map((doc) => (
                <li key={doc.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div>
                      <p className="line-clamp-1 text-xs font-medium text-slate-800">{doc.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone={statusTone[doc.status]}>{doc.status}</Badge>
                        {doc.status === "READY" && <span className="text-[11px] text-slate-400">{doc._count.chunks} chunks</span>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteDocMutation.mutate(doc.id)} className="rounded p-1 text-red-400 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {documents?.length === 0 && <p className="text-center text-xs text-slate-400">No documents uploaded yet.</p>}
            </ul>
          </Card>
        </div>
      </div>

      <ModuleFormModal
        key={moduleModal?.module?.id ?? "new-module"}
        isOpen={!!moduleModal}
        onClose={() => setModuleModal(null)}
        initial={moduleModal?.module}
        onSubmit={(data) => saveModuleMutation.mutate(data)}
        isLoading={saveModuleMutation.isPending}
      />
      <LessonFormModal
        key={lessonModal?.lesson?.id ?? `new-lesson-${lessonModal?.moduleId ?? ""}`}
        isOpen={!!lessonModal}
        onClose={() => setLessonModal(null)}
        initial={lessonModal?.lesson}
        onSubmit={(data) => saveLessonMutation.mutate(data)}
        isLoading={saveLessonMutation.isPending}
      />

      <ConfirmDialog
        isOpen={!!deleteModule}
        onClose={() => setDeleteModule(null)}
        onConfirm={() => deleteModule && deleteModuleMutation.mutate(deleteModule.id)}
        title="Delete module?"
        description={`This deletes "${deleteModule?.title}" and all of its lessons. This cannot be undone.`}
        confirmLabel="Delete module"
        isLoading={deleteModuleMutation.isPending}
      />
      <ConfirmDialog
        isOpen={!!deleteLesson}
        onClose={() => setDeleteLesson(null)}
        onConfirm={() => deleteLesson && deleteLessonMutation.mutate(deleteLesson.id)}
        title="Delete lesson?"
        description={`This deletes "${deleteLesson?.title}" and any associated quiz. This cannot be undone.`}
        confirmLabel="Delete lesson"
        isLoading={deleteLessonMutation.isPending}
      />
    </AppLayout>
  );
}

function ModuleFormModal({
  isOpen,
  onClose,
  initial,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: InstructorModule;
  onSubmit: (data: { title: string; description: string }) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ title, description });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit module" : "Add module"}>
      <form key={initial?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="mtitle">Title</Label>
          <Input id="mtitle" required defaultValue={initial?.title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="mdesc">Description (optional)</Label>
          <Textarea id="mdesc" rows={2} defaultValue={initial?.description ?? ""} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Save module
        </Button>
      </form>
    </Modal>
  );
}

function LessonFormModal({
  isOpen,
  onClose,
  initial,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: InstructorLesson;
  onSubmit: (data: { title: string; content: string; videoUrl: string; durationSeconds: number }) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [durationMinutes, setDurationMinutes] = useState(initial ? Math.round(initial.durationSeconds / 60) : 10);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ title, content, videoUrl, durationSeconds: durationMinutes * 60 });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit lesson" : "Add lesson"} size="lg">
      <form key={initial?.id ?? "new"} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="ltitle">Title</Label>
          <Input id="ltitle" required defaultValue={initial?.title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="lvideo">Video URL (optional)</Label>
            <Input id="lvideo" type="url" defaultValue={initial?.videoUrl ?? ""} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label htmlFor="lduration">Duration (minutes)</Label>
            <Input id="lduration" type="number" min={0} defaultValue={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label htmlFor="lcontent">Lesson material</Label>
          <Textarea
            id="lcontent"
            rows={10}
            defaultValue={initial?.content ?? ""}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the lesson content here. This is what students read, and what the AI Tutor retrieves from."
          />
          <p className="mt-1 text-xs text-slate-400">Saved content is automatically re-indexed for the AI Tutor.</p>
        </div>
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Save lesson
        </Button>
      </form>
    </Modal>
  );
}
