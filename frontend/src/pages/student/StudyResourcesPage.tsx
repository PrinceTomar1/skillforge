import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookMarked, BrainCircuit, Layers, ListChecks, NotebookText, Sparkles, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { api, getErrorMessage } from "../../lib/api";
import { Button, Card, EmptyState, Select } from "../../components/ui";
import { Modal } from "../../components/Modal";
import type { StudyResource, StudyResourceType } from "../../types";

const RESOURCE_TYPES: Array<{ value: StudyResourceType; label: string; icon: typeof Sparkles; description: string }> = [
  { value: "SUMMARY", label: "Summary", icon: NotebookText, description: "A concise overview with key takeaways." },
  { value: "FLASHCARDS", label: "Flashcards", icon: Layers, description: "Front/back cards for quick recall practice." },
  { value: "KEY_CONCEPTS", label: "Key Concepts", icon: BrainCircuit, description: "The most important terms, defined." },
  { value: "PRACTICE_QUESTIONS", label: "Practice Questions", icon: ListChecks, description: "Extra multiple-choice practice." },
  { value: "STUDY_PLAN", label: "Study Plan", icon: CalendarClock, description: "A day-by-day plan to master this material." },
  { value: "REVISION_NOTES", label: "Revision Notes", icon: BookMarked, description: "Structured notes grouped by heading." },
];

function ResourceContent({ resource }: { resource: StudyResource }) {
  const content = resource.content as Record<string, unknown>;
  switch (resource.type) {
    case "SUMMARY":
      return (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-700">{content.summary as string}</p>
          <div>
            <p className="text-sm font-semibold text-slate-900">Key takeaways</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
              {(content.keyTakeaways as string[]).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "FLASHCARDS":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(content.flashcards as Array<{ front: string; back: string }>).map((f, i) => (
            <FlipCard key={i} front={f.front} back={f.back} />
          ))}
        </div>
      );
    case "KEY_CONCEPTS":
      return (
        <div className="space-y-3">
          {(content.concepts as Array<{ term: string; definition: string }>).map((c, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{c.term}</p>
              <p className="mt-1 text-sm text-slate-600">{c.definition}</p>
            </div>
          ))}
        </div>
      );
    case "PRACTICE_QUESTIONS":
      return (
        <div className="space-y-4">
          {(content.questions as Array<{ prompt: string; options: string[]; correctOption: number; explanation: string }>).map((q, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">
                {i + 1}. {q.prompt}
              </p>
              <ul className="mt-2 space-y-1.5">
                {q.options.map((o, oi) => (
                  <li key={oi} className={`rounded-md px-2.5 py-1.5 text-sm ${oi === q.correctOption ? "bg-emerald-50 text-emerald-700" : "text-slate-600"}`}>
                    {o} {oi === q.correctOption && "✓"}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">{q.explanation}</p>
            </div>
          ))}
        </div>
      );
    case "STUDY_PLAN":
      return (
        <ol className="space-y-3">
          {(content.plan as Array<{ day: number; focus: string; tasks: string[] }>).map((p, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-semibold text-brand-700">Day {p.day} — {p.focus}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {p.tasks.map((t, ti) => (
                  <li key={ti}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      );
    case "REVISION_NOTES":
      return (
        <div className="space-y-4">
          {(content.sections as Array<{ heading: string; points: string[] }>).map((s, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-slate-900">{s.heading}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {s.points.map((pt, pi) => (
                  <li key={pi}>{pt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    default:
      return <pre className="text-xs">{JSON.stringify(content, null, 2)}</pre>;
  }
}

function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className={`flex min-h-[110px] items-center justify-center rounded-xl border p-4 text-center text-sm transition-colors ${
        flipped ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      {flipped ? back : front}
    </button>
  );
}

export default function StudyResourcesPage() {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [type, setType] = useState<StudyResourceType>("SUMMARY");
  const [viewing, setViewing] = useState<StudyResource | null>(null);

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments", "mine"],
    queryFn: async () => (await api.get<{ enrollments: Array<{ course: { id: string; title: string; slug: string } }> }>("/enrollments/mine")).data.enrollments,
  });

  const { data: courseDetail } = useQuery({
    queryKey: ["course-for-resource", courseId],
    queryFn: async () => {
      const slug = enrollments?.find((e) => e.course.id === courseId)?.course.slug;
      if (!slug) return null;
      return (await api.get(`/courses/${slug}`)).data.course;
    },
    enabled: !!courseId && !!enrollments,
  });

  const { data: resources } = useQuery({
    queryKey: ["study-resources"],
    queryFn: async () => (await api.get<{ resources: StudyResource[] }>("/ai/resources")).data.resources,
  });

  const generateMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ aiConfigured: boolean; resource: StudyResource | null; message?: string }>("/ai/resources/generate", {
          courseId,
          lessonId: lessonId || undefined,
          type,
        })
      ).data,
    onSuccess: (data) => {
      if (data.resource) {
        toast.success("Generated!");
        queryClient.invalidateQueries({ queryKey: ["study-resources"] });
        setViewing(data.resource);
      } else {
        toast(data.message ?? "Couldn't generate this resource.", { icon: "⚠️" });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const lessons = courseDetail?.modules?.flatMap((m: { lessons: { id: string; title: string }[] }) => m.lessons) ?? [];

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Study resources</h1>
        <p className="mt-1 text-slate-500">Generate flashcards, summaries, and more — grounded in your course material.</p>
      </div>

      <Card className="mb-8 p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Generate a new resource</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Select value={courseId} onChange={(e) => { setCourseId(e.target.value); setLessonId(""); }}>
              <option value="">Select a course...</option>
              {enrollments?.map((e) => (
                <option key={e.course.id} value={e.course.id}>
                  {e.course.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!courseId}>
              <option value="">Whole course</option>
              {lessons.map((l: { id: string; title: string }) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select value={type} onChange={(e) => setType(e.target.value as StudyResourceType)}>
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button className="mt-4" onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending} disabled={!courseId} icon={<Sparkles className="h-4 w-4" />}>
          Generate
        </Button>
      </Card>

      <h2 className="mb-4 text-base font-semibold text-slate-900">Your generated resources</h2>
      {!resources || resources.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="No study resources yet"
          description="Generate your first one above — it'll be grounded in your course's actual material."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => {
            const meta = RESOURCE_TYPES.find((t) => t.value === r.type);
            const Icon = meta?.icon ?? Sparkles;
            return (
              <button key={r.id} onClick={() => setViewing(r)} className="text-left">
                <Card className="h-full p-5 transition-shadow hover:shadow-md">
                  <Icon className="h-5 w-5 text-brand-600" />
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900">{r.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{meta?.label} · {r.course?.title}</p>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ""} size="lg">
        {viewing && <ResourceContent resource={viewing} />}
      </Modal>
    </AppLayout>
  );
}

