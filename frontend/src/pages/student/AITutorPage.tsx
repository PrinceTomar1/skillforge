import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { AppLayout } from "../../components/layout/AppLayout";
import { Markdown } from "../../components/Markdown";
import { api, getErrorMessage } from "../../lib/api";
import { Button, Card, Select } from "../../components/ui";
import type { TutorConversation, TutorMessage } from "../../types";

type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; conversationId: string; sources: TutorMessage["sources"]; aiConfigured: boolean }
  | { type: "error"; message: string };

export default function AITutorPage() {
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingMessageId = useRef<string | null>(null);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");

    const userMessage: TutorMessage = { id: `local-user-${Date.now()}`, role: "USER", content: trimmed, createdAt: new Date().toISOString() };
    const assistantId = `local-assistant-${Date.now()}`;
    streamingMessageId.current = assistantId;
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "ASSISTANT", content: "", createdAt: new Date().toISOString() }]);
    setIsStreaming(true);

    await streamAsk(trimmed, assistantId);
  }

  async function streamAsk(message: string, assistantId: string) {
    try {
      const res = await fetch(`${api.defaults.baseURL}/ai/tutor/ask/stream`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, message, conversationId: conversationId ?? undefined }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition -- standard reader-loop pattern; exits via the `break` below
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event: StreamEvent = JSON.parse(line.slice("data: ".length));

          if (event.type === "chunk") {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)));
          } else if (event.type === "done") {
            setConversationId(event.conversationId);
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, sources: event.sources } : m)));
            queryClient.invalidateQueries({ queryKey: ["conversations", courseId] });
          } else if (event.type === "error") {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: event.message } : m)));
          }
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: "Something went wrong reaching the AI Tutor. Please try again." } : m)));
    } finally {
      setIsStreaming(false);
      streamingMessageId.current = null;
    }
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
              {messages.map((m) => {
                const isLiveStreamingBubble = isStreaming && m.id === streamingMessageId.current;
                return (
                  <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === "USER" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                      {m.content.length === 0 && isLiveStreamingBubble ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                        </span>
                      ) : (
                        <>
                          <Markdown text={m.content} />
                          {isLiveStreamingBubble && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-slate-400 align-text-bottom" />}
                        </>
                      )}
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
                );
              })}
            </div>
            <div className="flex items-center gap-3 border-t border-slate-100 p-4">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={isStreaming}
                placeholder="Ask a question about this course..."
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus-ring focus-visible:border-brand-500 disabled:bg-slate-50"
              />
              <Button onClick={handleSend} isLoading={isStreaming} icon={<Send className="h-4 w-4" />}>
                Send
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
