import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, PlusCircle, Settings2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { api, getErrorMessage } from "../../lib/api";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Label, PageSpinner, Select, Textarea } from "../../components/ui";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { CourseLevel } from "../../types";

interface InstructorCourse {
  id: string;
  title: string;
  slug: string;
  category: string;
  level: CourseLevel;
  isPublished: boolean;
  modules: Array<{ lessons: unknown[] }>;
  _count: { enrollments: number };
}

export default function InstructorCoursesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InstructorCourse | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Web Development");
  const [level, setLevel] = useState<CourseLevel>("BEGINNER");

  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: ["instructor-courses"],
    queryFn: async () => (await api.get<{ courses: InstructorCourse[] }>("/courses/instructor/mine")).data.courses,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post<{ course: InstructorCourse }>("/courses", { title, description, category, level })).data.course,
    onSuccess: (course) => {
      toast.success("Course created — now add some content.");
      queryClient.invalidateQueries({ queryKey: ["instructor-courses"] });
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      navigate(`/instructor/courses/${course.id}/edit`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (course: InstructorCourse) => api.patch(`/courses/${course.id}`, { isPublished: !course.isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instructor-courses"] });
      toast.success("Course updated");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      toast.success("Course deleted");
      queryClient.invalidateQueries({ queryKey: ["instructor-courses"] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      toast.error("Description must be at least 10 characters.");
      return;
    }
    createMutation.mutate();
  }

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError) return <AppLayout><ErrorState message="Couldn't load your courses." onRetry={() => refetch()} /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My courses</h1>
          <p className="mt-1 text-slate-500">Create, edit, and publish your courses.</p>
        </div>
        <Button icon={<PlusCircle className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          New course
        </Button>
      </div>

      {courses?.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No courses yet" description="Create your first course to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses?.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{c.title}</h3>
                <Badge tone={c.isPublished ? "green" : "amber"}>{c.isPublished ? "Published" : "Draft"}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {c.category} · {c.modules.reduce((s, m) => s + m.lessons.length, 0)} lessons · {c._count.enrollments} students
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/instructor/courses/${c.id}/edit`} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <Settings2 className="h-3.5 w-3.5" /> Manage
                </Link>
                <Link to={`/instructor/courses/${c.id}/analytics`} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  <BarChart3 className="h-3.5 w-3.5" /> Analytics
                </Link>
                <button
                  onClick={() => togglePublishMutation.mutate(c)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {c.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create a new course">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="title">Course title</Label>
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Advanced TypeScript Patterns" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" required rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" required value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="level">Level</Label>
              <Select id="level" value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)}>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" isLoading={createMutation.isPending}>
            Create course
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete course?"
        description={`This will permanently delete "${deleteTarget?.title}" and all of its modules, lessons, and enrollment data. This cannot be undone.`}
        confirmLabel="Delete course"
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
