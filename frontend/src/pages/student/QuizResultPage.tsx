import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Trophy } from "lucide-react";
import { AppLayout } from "../../components/layout/AppLayout";
import { api } from "../../lib/api";
import { Badge, Button, Card, ErrorState, PageSpinner } from "../../components/ui";
import type { QuizResult } from "../../types";

export default function QuizResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const {
    data: result,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["quiz-attempt", attemptId],
    queryFn: async () => (await api.get<{ result: QuizResult }>(`/quizzes/attempts/${attemptId}`)).data.result,
    enabled: !!attemptId,
  });

  if (isLoading || !result) return <AppLayout><PageSpinner /></AppLayout>;
  if (isError) return <AppLayout><ErrorState message="Couldn't load this result." /></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              result.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
            }`}
          >
            <Trophy className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{result.passed ? "Nice work!" : "Keep practicing"}</h1>
          <p className="mt-1 text-slate-500">{result.quizTitle}</p>
          <p className="mt-6 text-5xl font-extrabold text-slate-900">{result.score}%</p>
          <p className="mt-2 text-sm text-slate-500">
            {result.correctCount} of {result.totalQuestions} correct
          </p>
          <Badge tone={result.passed ? "green" : "red"} className="mt-3">
            {result.passed ? "Passed" : "Not passed"}
          </Badge>
        </Card>

        <h2 className="mb-4 mt-8 text-lg font-bold text-slate-900">Review your answers</h2>
        <div className="space-y-4">
          {result.questions.map((q, i) => (
            <Card key={q.id} className="p-5">
              <div className="flex items-start gap-3">
                {q.isCorrect ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {i + 1}. {q.prompt}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {q.options.map((option, oi) => {
                      const isSelected = q.selectedOption === oi;
                      const isCorrectOption = q.correctOption === oi;
                      return (
                        <div
                          key={oi}
                          className={`rounded-lg border px-3 py-2 text-sm ${
                            isCorrectOption
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : isSelected
                                ? "border-red-300 bg-red-50 text-red-800"
                                : "border-slate-200 text-slate-600"
                          }`}
                        >
                          {option}
                          {isCorrectOption && <span className="ml-2 text-xs font-medium">(correct)</span>}
                          {isSelected && !isCorrectOption && <span className="ml-2 text-xs font-medium">(your answer)</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && <p className="mt-3 text-sm text-slate-500">{q.explanation}</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <Link to={`/quiz/${result.quizId}`}>
            <Button variant="outline">Retake quiz</Button>
          </Link>
          <Link to="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
