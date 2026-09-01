import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { api, getErrorMessage } from "../../lib/api";
import { Button, Card, ErrorState, PageSpinner } from "../../components/ui";
import type { QuizForAttempt, QuizResult } from "../../types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const submittingRef = useRef(false);

  const {
    data: quiz,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => (await api.get<{ quiz: QuizForAttempt }>(`/quizzes/${quizId}`)).data.quiz,
    enabled: !!quizId,
  });

  const startMutation = useMutation({
    mutationFn: async () => (await api.post<{ attempt: { id: string } }>(`/quizzes/${quizId}/attempts`)).data.attempt,
    onSuccess: (attempt) => setAttemptId(attempt.id),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  useEffect(() => {
    if (quiz && !attemptId && !startMutation.isPending) {
      startMutation.mutate();
      if (quiz.timeLimitSeconds) setTimeLeft(quiz.timeLimitSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = { answers: Object.entries(answers).map(([questionId, selectedOption]) => ({ questionId, selectedOption })) };
      return (await api.post<{ result: QuizResult }>(`/quizzes/attempts/${attemptId}/submit`, payload)).data.result;
    },
    onSuccess: (result) => navigate(`/quiz/attempts/${result.id}/result`),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = useCallback(() => {
    if (submittingRef.current || !attemptId) return;
    submittingRef.current = true;
    submitMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => (v !== null ? v - 1 : v)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, handleSubmit]);

  if (isLoading || !quiz) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError) return <AppLayout><ErrorState message="Couldn't load this quiz." /></AppLayout>;
  if (!attemptId) return <AppLayout><PageSpinner /></AppLayout>;

  const question = quiz.questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === quiz.questions.length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{quiz.title}</h1>
            <p className="text-sm text-slate-500">
              Question {currentIdx + 1} of {quiz.questions.length}
            </p>
          </div>
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${timeLeft < 30 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
              <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
            </div>
          )}
        </div>

        <div className="mb-6 flex gap-1.5">
          {quiz.questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === currentIdx ? "bg-brand-600" : answers[q.id] !== undefined ? "bg-brand-300" : "bg-slate-200"
              }`}
              aria-label={`Go to question ${i + 1}`}
            />
          ))}
        </div>

        <Card className="p-6">
          <p className="text-base font-medium text-slate-900">{question.prompt}</p>
          <div className="mt-5 space-y-2.5">
            {question.options.map((option, i) => (
              <button
                key={i}
                data-testid="quiz-option"
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: i }))}
                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  answers[question.id] === i ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                    answers[question.id] === i ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-slate-400"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                {option}
              </button>
            ))}
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={currentIdx === 0} onClick={() => setCurrentIdx((i) => i - 1)}>
            Previous
          </Button>

          {currentIdx < quiz.questions.length - 1 ? (
            <Button onClick={() => setCurrentIdx((i) => i + 1)} disabled={answers[question.id] === undefined}>
              Next question
            </Button>
          ) : (
            <Button onClick={handleSubmit} isLoading={submitMutation.isPending} disabled={!allAnswered}>
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit quiz"}
            </Button>
          )}
        </div>
        {!allAnswered && currentIdx === quiz.questions.length - 1 && (
          <p className="mt-3 text-center text-sm text-amber-600">Answer all questions before submitting ({answeredCount}/{quiz.questions.length} answered).</p>
        )}
      </div>
    </AppLayout>
  );
}
