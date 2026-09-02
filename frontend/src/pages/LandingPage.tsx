import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, BarChart3, BookOpen, Brain, Check, Copy, Github, MessagesSquare, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { useAuth } from "../context/AuthContext";

const features = [
  {
    icon: BookOpen,
    title: "Course discovery that actually works",
    description: "Browse, search, and filter real courses organized into modules and lessons, with video, written material, and progress tracking built in.",
  },
  {
    icon: Sparkles,
    title: "An AI Tutor that won't lie to you",
    description: "Answers are retrieved from the actual course material via a real RAG pipeline, streamed live — and it says \"I don't know\" instead of guessing.",
  },
  {
    icon: Brain,
    title: "AI study tools, grounded",
    description: "Flashcards, summaries, key concepts, practice questions — generated on demand from the lesson you're actually studying.",
  },
  {
    icon: Target,
    title: "A quiz engine, not a mock",
    description: "Multiple-choice quizzes with real server-side scoring, attempt history, and weak-topic detection driven by your actual answers.",
  },
  {
    icon: BarChart3,
    title: "Analytics computed, not decorated",
    description: "Progress, quiz performance, and instructor-side enrollment stats — every number here comes from a real query, not a placeholder.",
  },
  {
    icon: ShieldCheck,
    title: "Auth done properly",
    description: "Bcrypt-hashed passwords, httpOnly session cookies, role-based access, and per-resource ownership checks — not just a login form.",
  },
];

const techStack = [
  "React", "TypeScript", "Vite", "Tailwind CSS", "Node.js", "Express",
  "PostgreSQL", "pgvector", "Prisma", "Claude & Gemini", "Docker", "Vitest",
];

const demoAccounts = [
  { role: "Student", email: "student@skillforge.dev", password: "Student123!" },
  { role: "Instructor", email: "instructor@skillforge.dev", password: "Instructor123!" },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

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
              <Sparkles className="h-3.5 w-3.5" /> A solo-built RAG pipeline, not a chatbot wrapper
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
              Learn faster with courses, quizzes, and an AI Tutor that actually knows your material.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              SkillForge combines structured course content, a real quiz engine, and an AI Tutor grounded in your
              course's own lessons — so answers come from real material, not a model's best guess.
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

          {!user && (
            <div className="mx-auto mt-14 max-w-xl rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Evaluating this? Skip the signup form.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {demoAccounts.map((acc) => (
                  <div key={acc.role} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold text-brand-700">{acc.role} account</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <code className="truncate text-xs text-slate-700">{acc.email}</code>
                      <CopyButton value={acc.email} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="truncate text-xs text-slate-500">{acc.password}</code>
                      <CopyButton value={acc.password} />
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/login" className="mt-3 block text-center text-xs font-medium text-brand-600 hover:text-brand-700">
                Log in with one of these →
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Built with</p>
        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2.5">
          {techStack.map((tech) => (
            <span key={tech} className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-medium text-slate-600">
              {tech}
            </span>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Why this exists</p>
            <p className="mt-3 text-lg leading-8 text-slate-700">
              Most "AI-powered" student projects wire a chat box up to an LLM and call it a day. I wanted to build
              the parts that are actually hard: a vector index scoped correctly per course, retrieval that's honest
              enough to say "I don't know" instead of hallucinating, auth that hashes passwords properly, and a quiz
              engine that grades real answers instead of a hardcoded score.
            </p>
            <p className="mt-4 text-slate-600">
              This is that project — a full course platform with an AI Tutor I'd actually trust not to make things
              up. Everything here runs against a real Postgres database through a typed API; there's nothing behind
              the curtain.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">What's actually in here</h2>
          <p className="mt-3 text-slate-600">No "coming soon" screens — every one of these is a working feature.</p>
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
            <p className="mt-3 text-slate-600">The real pipeline — not marketing language for "we call an API."</p>
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

      <section className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">That's the pitch. The rest is just using it.</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/signup" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            Create a free account <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Github className="h-4 w-4" /> View source
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-slate-500">
              SkillForge is a solo portfolio project — not a real company or a live commercial product.
            </p>
            <p className="text-xs text-slate-400">
              Built to learn how production RAG pipelines, auth, and quiz engines actually get built, end to end.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
