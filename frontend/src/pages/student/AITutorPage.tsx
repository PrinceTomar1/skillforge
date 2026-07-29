import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { Markdown } from "../../components/Markdown";
import { api, getErrorMessage } from "../../lib/api";
import { Button, Card, Select, Spinner } from "../../components/ui";
import type { TutorConversation, TutorMessage } from "../../types";

export default function AITutorPage() {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments", "mine"],
    queryFn: async () => (await api.get<{ enrollments: Array<{ course: { id: string; title: string } }> }>("/enrollments/mine")).data.enrollments,
  });

  const { data: status } = useQuery({
    queryKey: ["ai-status"],
    queryFn: async () => (await api.get<{ llmConfigured: boolean; realSemanticEmbeddings: boolean }>("/ai/status")).data,
  });

  useEffect(() => {
    if (!courseId && enrollments && enrollments.length > 0) setCourseId(enrollments[0].course.id);
  }, [enrollments, courseId]);

  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ["conversations", courseId],
    queryFn: async () => (await api.get<{ conversations: TutorConversation[] }>("/ai/tutor/conversations", { params: { courseId } })).data.conversations,
    enabled: !!courseId,
  });

  const loadConversation = useMutation({
    mutationFn: async (id: string) => (await api.get<{ conversation: TutorConversation }>(`/ai/tutor/conversations/${id}`)).data.conversation,
    onSuccess: (conv) => {
      setConversationId(conv.id);
      setMessages(conv.messages ?? []);
    },
  });

  const askMutation = useMutation({
    mutationFn: async (message: string) =>
      (
        await api.post<{ conversationId: string; answer: string; sources: TutorMessage["sources"]; aiConfigured: boolean }>("/ai/tutor/ask", {
          courseId,
          message,
          conversationId: conversationId ?? undefined,
        })
      ).data,
    onSuccess: (data, message) => {
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: `local-user-${Date.now()}`, role: "USER", content: message, createdAt: new Date().toISOString() },
        { id: `local-assistant-${Date.now()}`, role: "ASSISTANT", content: data.answer, sources: data.sources, createdAt: new Date().toISOString() },
      ]);
      queryClient.invalidateQueries({ queryKey: ["conversations", courseId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, askMutation.isPending]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || askMutation.isPending) return;
    setInput("");
    askMutation.mutate(trimmed);
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    refetchConversations();
  }

  return (
    <AppLayout wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Sparkles className="h-6 w-6 text-brand-600" /> AI Tutor
          </h1>
          <p className="mt-1 text-slate-500">Ask questions grounded in your course material.</p>
        </div>
        <Select value={courseId} onChange={(e) => { setCourseId(e.target.value); setConversationId(null); setMessages([]); }} className="w-64">
          {enrollments?.length === 0 && <option value="">Enroll in a course first</option>}
          {enrollments?.map((e) => (
            <option key={e.course.id} value={e.course.id}>
              {e.course.title}
            </option>
          ))}
        </Select>
      </div>

      {status && !status.llmConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">AI generation isn't configured on this server.</p>
            <p className="mt-0.5 text-amber-700">
              Retrieval over your course material still works (you'll see real cited sources below), but generating a natural-language
              answer requires an LLM provider key (<code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> or{" "}
              <code className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code>) in the backend environment.
            </p>
          </div>
        </div>
      )}

      {!courseId ? (
        <Card className="p-10 text-center text-slate-500">Enroll in a course to start using the AI Tutor.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Button variant="outline" className="mb-3 w-full" icon={<MessageSquarePlus className="h-4 w-4" />} onClick={startNewConversation}>
              New conversation
            </Button>
            <Card className="max-h-[60vh] overflow-y-auto">
              {conversations?.length === 0 && <p className="p-4 text-sm text-slate-400">No conversations yet for this course.</p>}
              <ul className="divide-y divide-slate-100">
                {conversations?.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => loadConversation.mutate(c.id)}
                      className={`block w-full px-4 py-3 text-left text-sm transition-colors ${
                        conversationId === c.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <p className="line-clamp-1 font-medium">{c.title}</p>
                      <p className="text-xs text-slate-400">{c._count?.messages ?? 0} messages</p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="flex h-[65vh] flex-col lg:col-span-3">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <Sparkles className="mb-3 h-8 w-8" />
                  <p className="text-sm">Ask anything about this course. Answers are grounded in the actual lesson material.</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === "USER" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                    <Markdown text={m.content} />
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-2.5">
                        <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                          <BookOpen className="h-3 w-3" /> Sources
                        </p>
                        {m.sources.map((s, i) => (
                          <div key={i} className="rounded-lg bg-white/60 px-2.5 py-1.5 text-xs text-slate-600">
                            <span className="font-medium">{s.lessonTitle ?? s.documentTitle}</span> · similarity {s.similarity}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {askMutation.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3">
                    <Spinner className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-slate-100 p-4">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask a question about this course..."
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus-ring focus-visible:border-brand-500"
              />
              <Button onClick={handleSend} isLoading={askMutation.isPending} icon={<Send className="h-4 w-4" />}>
                Send
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
