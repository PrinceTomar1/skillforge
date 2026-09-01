import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, Brain, GraduationCap, MessagesSquare, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: BookOpen,
    title: "Structured course discovery",
    description: "Browse, search, and filter real courses organized into modules and lessons, with video, written material, and progress tracking built in.",
  },
  {
    icon: Sparkles,
    title: "AI Tutor grounded in your course",
    description: "Ask questions and get answers retrieved from the actual course material via a real Retrieval-Augmented Generation pipeline — not generic chatbot guesses.",
  },
  {
    icon: Brain,
    title: "AI-generated study resources",
    description: "Generate flashcards, summaries, key concepts, and practice questions on demand, grounded in the lesson you're studying.",
  },
  {
    icon: Target,
    title: "Real quiz engine",
    description: "Multiple-choice quizzes with automatic scoring, attempt history, and weak-topic detection driven by your actual answers.",
  },
  {
    icon: BarChart3,
    title: "Analytics that mean something",
    description: "Student progress, quiz performance, and instructor-side enrollment and completion analytics — all computed from real activity.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description: "Hashed passwords, httpOnly session cookies, role-based authorization, and per-resource ownership checks throughout the API.",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const primaryCta = user ? (user.role === "INSTRUCTOR" ? "/instructor" : "/dashboard") : "/signup";

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> AI Tutor powered by real Retrieval-Augmented Generation
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Learn faster with courses, quizzes, and an AI Tutor that actually knows your material.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              SkillForge combines structured course content, a real quiz engine, and an AI Tutor grounded in your
              course's own lessons — so answers are retrieved from real material, not invented.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                to={primaryCta}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                {user ? "Go to your dashboard" : "Start learning free"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Browse courses
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything a modern learning platform needs</h2>
          <p className="mt-3 text-slate-600">From course discovery to grounded AI answers to instructor analytics — built as a real product, not a demo.</p>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-6 transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">How the AI Tutor actually works</h2>
            <p className="mt-3 text-slate-600">A real RAG pipeline, end to end — not a hardcoded response.</p>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { step: "1. Ingest & embed", detail: "Lesson content and uploaded documents are chunked, embedded, and stored in a vector index scoped to each course." },
              { step: "2. Retrieve", detail: "Your question is embedded and matched against the course's chunks via nearest-neighbor vector search." },
              { step: "3. Generate, grounded", detail: "Retrieved passages are placed in the prompt so the LLM answers from real material — and says so honestly when it can't find an answer." },
            ].map((s, i) => (
              <div key={s.step} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <MessagesSquare className="h-5 w-5 text-brand-600" />
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{s.step}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.detail}</p>
                {i < 2 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-300 sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-slate-900 px-8 py-14 text-center sm:flex-row sm:text-left">
          <div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white sm:mx-0">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">Ready to see it in action?</h2>
            <p className="mt-2 text-slate-300">Create a free account as a student or instructor — no credit card required.</p>
          </div>
          <Link
            to="/signup"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        SkillForge — built as a demonstration full-stack AI learning platform.
      </footer>
    </div>
  );
}
