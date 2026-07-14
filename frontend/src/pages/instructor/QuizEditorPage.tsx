import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { api, getErrorMessage } from "../../lib/api";
import { Button, Card, ErrorState, Input, Label, PageSpinner, Textarea } from "../../components/ui";
import { Modal } from "../../components/Modal";
import { ConfirmDialog } from "../../components/ConfirmDialog";

interface EditableQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOption: number;
  explanation: string | null;
  topic: string | null;
  order: number;
}
interface EditableQuiz {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitSeconds: number | null;
  isAiGenerated: boolean;
  lesson: { title: string };
  questions: EditableQuestion[];
}

export default function QuizEditorPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const queryClient = useQueryClient();
  const [questionModal, setQuestionModal] = useState<{ question?: EditableQuestion } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EditableQuestion | null>(null);

  const { data: quiz, isLoading, isError } = useQuery({
    queryKey: ["quiz-edit", quizId],
    queryFn: async () => (await api.get<{ quiz: EditableQuiz }>(`/quizzes/${quizId}/edit`)).data.quiz,
    enabled: !!quizId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["quiz-edit", quizId] });
  }

  const settingsMutation = useMutation({
    mutationFn: async (data: { passingScore: number; timeLimitSeconds: number | null }) => api.patch(`/quizzes/${quizId}`, data),
    onSuccess: () => {
      invalidate();
      toast.success("Quiz settings saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveQuestionMutation = useMutation({
    mutationFn: async (data: { prompt: string; options: string[]; correctOption: number; explanation: string; topic: string }) =>
      questionModal?.question ? api.patch(`/quizzes/questions/${questionModal.question.id}`, data) : api.post(`/quizzes/${quizId}/questions`, data),
    onSuccess: () => {
      invalidate();
      setQuestionModal(null);
      toast.success("Question saved");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => api.delete(`/quizzes/questions/${questionId}`),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast.success("Question deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError || !quiz) return <AppLayout><ErrorState message="Couldn't load this quiz." /></AppLayout>;

  return (
    <AppLayout>
      <div className="mb-6">
        <p className="text-sm text-slate-500">{quiz.lesson.title}</p>
        <h1 className="text-2xl font-bold text-slate-900">{quiz.title}</h1>
        {quiz.isAiGenerated && <p className="mt-1 text-xs font-medium text-brand-600">AI-generated — review carefully before publishing to students.</p>}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Questions ({quiz.questions.length})</h2>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setQuestionModal({})}>
              Add question
            </Button>
          </div>
          <div className="space-y-3">
            {quiz.questions.map((q, i) => (
              <Card key={q.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">
                    {i + 1}. {q.prompt}
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => setQuestionModal({ question: q })} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      Edit
                    </button>
                    <button onClick={() => setDeleteTarget(q)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <ul className="mt-3 space-y-1">
                  {q.options.map((o, oi) => (
                    <li key={oi} className={`rounded-md px-2.5 py-1.5 text-xs ${oi === q.correctOption ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}>
                      {o} {oi === q.correctOption && "✓ correct"}
                    </li>
                  ))}
                </ul>
                {q.topic && <p className="mt-2 text-xs text-slate-400">Topic: {q.topic}</p>}
              </Card>
            ))}
            {quiz.questions.length === 0 && <Card className="p-8 text-center text-sm text-slate-400">No questions yet. Add one to get started.</Card>}
          </div>
        </div>

        <div>
          <Card className="p-5">
            <h3 className="mb-4 font-semibold text-slate-900">Quiz settings</h3>
            <QuizSettingsForm quiz={quiz} onSave={(data) => settingsMutation.mutate(data)} isLoading={settingsMutation.isPending} />
          </Card>
        </div>
      </div>

      <QuestionFormModal
        key={questionModal?.question?.id ?? "new-question"}
        isOpen={!!questionModal}
        onClose={() => setQuestionModal(null)}
        initial={questionModal?.question}
        onSubmit={(data) => saveQuestionMutation.mutate(data)}
        isLoading={saveQuestionMutation.isPending}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteQuestionMutation.mutate(deleteTarget.id)}
        title="Delete question?"
        description="This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteQuestionMutation.isPending}
      />
    </AppLayout>
  );
}

function QuizSettingsForm({ quiz, onSave, isLoading }: { quiz: EditableQuiz; onSave: (data: { passingScore: number; timeLimitSeconds: number | null }) => void; isLoading: boolean }) {
  const [passingScore, setPassingScore] = useState(quiz.passingScore);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(quiz.timeLimitSeconds ? Math.round(quiz.timeLimitSeconds / 60) : 0);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({ passingScore, timeLimitSeconds: timeLimitMinutes > 0 ? timeLimitMinutes * 60 : null });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="passingScore">Passing score (%)</Label>
        <Input id="passingScore" type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} />
      </div>
      <div>
        <Label htmlFor="timeLimit">Time limit (minutes, 0 = none)</Label>
        <Input id="timeLimit" type="number" min={0} value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(Number(e.target.value))} />
      </div>
      <Button type="submit" className="w-full" variant="outline" isLoading={isLoading}>
        Save settings
      </Button>
    </form>
  );
}

function QuestionFormModal({
  isOpen,
  onClose,
  initial,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: EditableQuestion;
  onSubmit: (data: { prompt: string; options: string[]; correctOption: number; explanation: string; topic: string }) => void;
  isLoading: boolean;
}) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(initial?.options ?? ["", "", "", ""]);
  const [correctOption, setCorrectOption] = useState(initial?.correctOption ?? 0);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (options.some((o) => !o.trim())) {
      toast.error("All four options are required.");
      return;
    }
    onSubmit({ prompt, options, correctOption, explanation, topic });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? "Edit question" : "Add question"} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="qprompt">Question</Label>
          <Textarea id="qprompt" required rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div>
          <Label>Options (select the correct one)</Label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={correctOption === i} onChange={() => setCorrectOption(i)} className="h-4 w-4 accent-brand-600" />
                <Input
                  required
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, oi) => (oi === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qtopic">Topic (for weak-topic analytics)</Label>
            <Input id="qtopic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. React Hooks" />
          </div>
          <div>
            <Label htmlFor="qexplanation">Explanation</Label>
            <Input id="qexplanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Shown after submission" />
          </div>
        </div>
        <Button type="submit" className="w-full" isLoading={isLoading}>
          Save question
        </Button>
      </form>
    </Modal>
  );
}
