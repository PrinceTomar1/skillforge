# SkillForge — AI-Powered Learning Platform

**Live demo:** [skillforge-topaz-mu.vercel.app](https://skillforge-topaz-mu.vercel.app)
(frontend on Vercel, API on Render, Postgres+pgvector on Neon — see
[Deployment](#deployment) for the full setup and demo credentials below).
The API is on Render's free tier, which sleeps after 15 minutes idle — the
first request after a while can take 30–50s to wake it up; it's fast after
that.

A full-stack learning platform with course discovery, a real quiz engine,
instructor/student dashboards, and an **AI Tutor built on a genuine
Retrieval-Augmented Generation (RAG) pipeline** — course material is
chunked, embedded, stored in a vector index, and retrieved per-question
before an LLM ever sees it.

I built this as a solo project to actually implement the parts most
"AI-powered" student demos skip: a vector index scoped correctly per course,
retrieval that's honest enough to say "I don't know" instead of
hallucinating, streamed LLM responses instead of one blocking request, auth
that hashes passwords properly, and a quiz engine that grades real answers
instead of a hardcoded score. This is not a prototype — every button
performs a real action against a real Postgres database through a typed
REST API. No hardcoded quiz scores, no fake AI responses, no "coming soon"
screens.

If you're reviewing this as a portfolio piece: the [RAG pipeline](#rag-pipeline)
and [Known limitations](#known-limitations) sections are the ones I'd point
you to first — they're where the actual engineering decisions (and honest
trade-offs) are.

---

## Table of contents

- [Key features](#key-features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [RAG pipeline](#rag-pipeline)
- [Authentication & authorization](#authentication--authorization)
- [Database schema](#database-schema)
- [Folder structure](#folder-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running with Docker](#running-with-docker)
- [Testing](#testing)
- [Demo credentials](#demo-credentials)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Key features

**Students**
- Browse, search, and filter a real course catalog
- Enroll, watch video lessons, read written material, track per-lesson progress
- Take multiple-choice quizzes with real-time scoring, review, and attempt history
- Ask an AI Tutor questions grounded in the *current course's* material, with cited sources — answers stream in live, token by token, and the tutor talks like a helpful human, not a formal citation-heavy report
- Generate flashcards, summaries, key concepts, study plans, revision notes, and practice questions on demand
- A dashboard that computes real stats: completion, quiz averages, streaks, weak topics, recommendations

**Instructors**
- Create, edit, publish/unpublish, and delete courses
- Manage modules and lessons (including reordering)
- Upload supporting documents (PDF/TXT/MD) that get ingested into the same RAG pipeline
- Author quizzes by hand, or generate a first draft with AI (grounded in the lesson's material, reviewed before publishing)
- Per-course analytics: enrollment, completion rate, quiz performance, topic-level accuracy across all students

## Architecture

```
┌──────────────┐        HTTPS/JSON         ┌───────────────┐
│   React SPA   │ ───────────────────────▶ │  Express API   │
│ (Vite + TS)   │ ◀─────────────────────── │   (Node + TS)  │
└──────────────┘      httpOnly JWT cookie   └──────┬────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                      │                     │
                        ┌─────▼─────┐         ┌──────▼──────┐      ┌───────▼────────┐
                        │ PostgreSQL │         │ Embedding    │      │  LLM Provider   │
                        │ + pgvector │         │ Provider     │      │ (Anthropic or   │
                        │ (Prisma)   │         │ (OpenAI or   │      │  Gemini) or     │
                        └───────────┘         │  local hash) │      │  "none" (honest │
                                               └─────────────┘      │  fallback)      │
                                                                     └────────────────┘
```

- **Frontend and backend are separate apps** communicating over a typed JSON REST API — no server-rendered coupling, easy to deploy independently.
- **Auth is stateless** (signed JWT in an httpOnly cookie), so the API scales horizontally without a session store.
- **The vector store is just Postgres** (via the `pgvector` extension) — one database, one connection pool, no extra infrastructure to run locally or operate in production.
- **AI providers are behind interfaces** (`LLMProvider`, `EmbeddingProvider`) — the app ships with both Anthropic and Gemini implementations of `LLMProvider` (selected via `AI_PROVIDER`), and swapping in another LLM or a different embedding model is a one-file change — see [`src/services/ai`](backend/src/services/ai).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Fast dev loop, strong typing, no framework lock-in |
| Styling | Tailwind CSS | Consistent design tokens without a component-library dependency |
| Data fetching | TanStack Query | Caching, invalidation, loading/error states without hand-rolled state |
| Charts | Recharts | Lightweight, composable, good enough for dashboard analytics |
| Backend | Node.js + Express + TypeScript | Simple, explicit, easy to reason about middleware/auth |
| ORM | Prisma | Type-safe queries, real migrations, good Postgres extension support |
| Database | PostgreSQL 16 + `pgvector` | One database for relational *and* vector data — no separate vector DB to run |
| Auth | JWT in an httpOnly cookie + bcrypt | Stateless, XSS-resistant cookie storage, industry-standard password hashing |
| LLM | Anthropic Claude or Google Gemini (pluggable) | Both are strong at instruction-following for grounded, citation-aware answers; the app supports either via `AI_PROVIDER` |
| Embeddings | OpenAI `text-embedding-3-small` (pluggable), with a local fallback | Real semantic embeddings when a key is present; a deterministic hashing fallback keeps the *entire* pipeline runnable with zero external credentials |
| Testing | Vitest + Supertest (backend), Vitest + Testing Library (frontend) | Fast, native ESM/TS support |

## RAG pipeline

This is the core technical demonstration of the project. The pipeline has
five explicitly separated stages (see [`backend/src/services/ai`](backend/src/services/ai)):

1. **Ingestion** ([`ingestion.ts`](backend/src/services/ai/ingestion.ts)) — every lesson's written material, and any instructor-uploaded PDF/TXT/MD, becomes a `Document` row. Lesson content is automatically re-ingested whenever an instructor edits it.
2. **Cleaning & chunking** ([`chunking.ts`](backend/src/services/ai/chunking.ts)) — text is normalized and split into ~220-word overlapping windows (40-word overlap), balancing retrieval specificity against lost context at chunk boundaries.
3. **Embedding & storage** ([`embeddingProvider.ts`](backend/src/services/ai/embeddingProvider.ts)) — each chunk is embedded and stored as a `vector(1536)` column via `pgvector`, indexed with HNSW for fast approximate nearest-neighbor search.
4. **Retrieval** ([`retrieval.ts`](backend/src/services/ai/retrieval.ts)) — a query is embedded and matched via cosine distance (`<=>`), **scoped to the current course only** — verified directly in [`tests/api/rag.test.ts`](backend/tests/api/rag.test.ts), which asserts a Kubernetes question against a watercolor-painting course never returns Kubernetes content.
5. **Prompt construction & generation** ([`tutorService.ts`](backend/src/services/ai/tutorService.ts)) — retrieved chunks are placed in the system prompt with instructions to answer *only* from the provided context in a warm, conversational voice (not a formal report), and to say so plainly when the context doesn't cover the question, rather than guessing. The answer is streamed back to the browser over Server-Sent Events as it's generated (`POST /api/ai/tutor/ask/stream`), so the student sees it appear live rather than waiting on one long blocking request.

**Embeddings without an API key.** If `OPENAI_API_KEY` isn't set, the app
doesn't disable RAG — it falls back to a deterministic signed
feature-hashing embedding (a classic "hashing trick" bag-of-words vector).
It's lexical rather than semantic (it rewards shared vocabulary, not shared
meaning), but it's real math over real vectors, so ingestion → embedding →
storage → cosine-similarity retrieval all genuinely run end to end with zero
external credentials. This is clearly labeled everywhere it's surfaced
(`GET /api/ai/status`, the AI Tutor UI) — the app never pretends a fallback
is the real thing.

**LLM without an API key.** If neither `ANTHROPIC_API_KEY` nor `GEMINI_API_KEY`
is set for the selected `AI_PROVIDER`, the AI Tutor and study-resource
generation return a clear, honest message explaining what's missing and how
to enable it — retrieval and its cited sources still work, only the
natural-language generation step is unavailable. Nothing is faked.

**Two LLM providers, verified — including the failure path.**
`AI_PROVIDER=anthropic` and `AI_PROVIDER=gemini` are both implemented behind
the same `LLMProvider` interface ([`llmProvider.ts`](backend/src/services/ai/llmProvider.ts)),
and both were exercised end to end against the real API during development —
grounded, cited, streamed AI Tutor answers, AI-generated flashcards, and
AI-generated quiz questions all verified working through Gemini specifically.
Development also hit Gemini's free-tier daily quota (as low as 20
requests/day for a given model) partway through testing, which turned out to
be a useful forcing function: it's what the honest, quota-aware fallback
message described in [Known limitations](#known-limitations) was built
against and verified with, rather than being a hypothetical error path that
was never actually triggered.

## Authentication & authorization

- Passwords are hashed with **bcrypt** (cost factor 12) — never stored or logged in plain text.
- Sessions are a **JWT signed with `JWT_SECRET`**, stored in an **httpOnly, `SameSite=Lax` cookie** (inaccessible to JavaScript, so an XSS payload can't exfiltrate it).
- Every protected route runs through `authenticate` middleware; role-gated routes additionally run `requireRole("STUDENT" | "INSTRUCTOR")`.
- **Ownership is checked, not just role** — an instructor can only edit/delete/publish courses they created (`assertOwnsCourse`), verified in [`tests/api/courses.test.ts`](backend/tests/api/courses.test.ts).
- Lesson *content* is gated behind enrollment: the public course-detail endpoint deliberately excludes lesson `content`/`videoUrl`, and `GET /api/lessons/:id` checks the caller is enrolled (or owns the course) before returning material — also covered by a test.
- Rate limiting is applied globally, more strictly on `/api/auth/*`, and separately on `/api/ai/*` (LLM calls are the most expensive path to abuse).
- `helmet` sets standard security headers; CORS is locked to `CORS_ORIGIN`.

## Database schema

Postgres, managed by Prisma migrations ([`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)). Highlights:

- `User` (role: `STUDENT` | `INSTRUCTOR`) → `Course` (owned by an instructor) → `Module` → `Lesson`
- `Enrollment` (unique per user+course) → `LessonProgress` (unique per user+lesson) drives all progress/completion math
- `Quiz` → `Question` → `QuizAttempt` → `QuizAnswer` — scores are computed from `QuizAnswer.isCorrect`, never stored redundantly as a guess
- `Document` → `DocumentChunk` (with a `vector(1536)` embedding column + HNSW index) is the RAG knowledge base
- `AIConversation` → `AIMessage` (with a `sources` JSON column for citations) is the AI Tutor's chat history
- `StudyResource` stores AI-generated flashcards/summaries/etc. as structured JSON
- `ActivityEvent` is an append-only log that drives "recent activity" and the learning-streak calculation

## Folder structure

```
SkillForge/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # data model
│   │   ├── migrations/          # versioned SQL migrations
│   │   ├── seed.ts              # demo data (courses, users, quizzes, ingestion)
│   │   └── seedContent.ts       # the actual lesson text used for seeding + RAG
│   ├── src/
│   │   ├── config/env.ts        # typed environment access
│   │   ├── middleware/          # auth, validation, error handling
│   │   ├── routes/              # one file per resource
│   │   ├── services/
│   │   │   ├── ai/              # embeddingProvider, llmProvider, chunking,
│   │   │   │                    # ingestion, retrieval, tutorService, generation
│   │   │   ├── authService.ts, courseService.ts, quizService.ts, ...
│   │   └── app.ts / server.ts
│   └── tests/                   # Vitest + Supertest, incl. RAG scoping tests
└── frontend/
    └── src/
        ├── pages/                # one file per route (student/, instructor/)
        ├── components/           # ui.tsx primitives, layout/, Modal, ConfirmDialog
        ├── context/AuthContext.tsx
        └── lib/api.ts            # typed axios client
```

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ with the [`pgvector`](https://github.com/pgvector/pgvector) extension available (or use Docker — see below)

### 1. Clone and install

```bash
git clone <your-fork-url> skillforge
cd skillforge
cd backend && npm install
cd ../frontend && npm install
```

### 2. Database setup

Create a database and enable `pgvector` (skip this if using Docker Compose, which does it automatically):

```bash
createdb skillforge
psql -d skillforge -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` — at minimum, set `DATABASE_URL` to your Postgres connection string and generate a real `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The app **runs fully without any AI provider keys** — see [Environment variables](#environment-variables).

```bash
cd ../frontend
cp .env.example .env   # not required for local dev; Vite proxies /api to :4000
```

### 4. Run migrations and seed demo data

```bash
cd backend
npx prisma migrate deploy
npm run seed
```

This creates 2 instructors, 4 students, 4 full courses (with modules, lessons, quizzes, and RAG-ready material), realistic enrollments/progress/quiz attempts, and a couple of sample AI conversations/study resources. See [Demo credentials](#demo-credentials).

### 5. Run the app

```bash
# Terminal 1
cd backend && npm run dev      # http://localhost:4000

# Terminal 2
cd frontend && npm run dev     # http://localhost:5173
```

Open **http://localhost:5173** and log in with one of the [demo accounts](#demo-credentials).

## Environment variables

### Backend (`backend/.env`, see [`backend/.env.example`](backend/.env.example))

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string (must have `pgvector` enabled) |
| `JWT_SECRET` | ✅ | Long random string used to sign session tokens |
| `JWT_EXPIRES_IN` | | Session lifetime (default `7d`) |
| `PORT` | | API port (default `4000`) |
| `CORS_ORIGIN` | | Allowed frontend origin (default `http://localhost:5173`) |
| `AI_PROVIDER` | | `anthropic`, `gemini`, or `none` (default `none`) |
| `ANTHROPIC_API_KEY` | If `AI_PROVIDER=anthropic` | Anthropic Console API key (starts `sk-ant-`) |
| `ANTHROPIC_MODEL` | | Defaults to `claude-sonnet-5-20250929` |
| `GEMINI_API_KEY` | If `AI_PROVIDER=gemini` | Google AI Studio / Gemini API key |
| `GEMINI_MODEL` | | Defaults to `gemini-3.6-flash` |
| `EMBEDDING_PROVIDER` | | `openai` or `local` (default `local`) |
| `OPENAI_API_KEY` | For real semantic embeddings | OpenAI API key |
| `EMBEDDING_DIMENSIONS` | | Must stay `1536` unless you also edit the Prisma `vector(1536)` column and re-migrate |
| `MAX_UPLOAD_MB` | | Document upload size limit (default `10`) |

**You must provide:** a `DATABASE_URL` and a `JWT_SECRET` to run the app at all. **Optionally provide** an LLM key (`ANTHROPIC_API_KEY` with `AI_PROVIDER=anthropic`, or `GEMINI_API_KEY` with `AI_PROVIDER=gemini`) for real AI Tutor / study-resource generation, and `OPENAI_API_KEY` for real semantic embeddings instead of the local lexical fallback — the app is fully functional, honestly, without any of them.

### Frontend (`frontend/.env`, see [`frontend/.env.example`](frontend/.env.example))

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | | Only needed if the frontend is deployed separately from the backend; local dev proxies `/api` via Vite |

No secrets are ever exposed to the frontend — the browser only ever talks to `/api`.

## Running with Docker

```bash
docker compose up --build
```

This starts Postgres (with `pgvector` pre-installed), runs migrations, seeds
demo data, and starts both the API (`:4000`) and the frontend (`:5173`).
Pass through AI keys via a `.env` file at the repo root (read by `docker compose`) or your shell environment:

```bash
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... OPENAI_API_KEY=sk-... docker compose up --build
# or, using Gemini instead:
AI_PROVIDER=gemini GEMINI_API_KEY=... docker compose up --build
```

## Testing

```bash
# Backend: unit tests (chunking, slugify, embedding math) + API/integration
# tests (auth, course ownership, quiz scoring, RAG course-scoping, the
# honest "AI not configured" fallback) against a real Postgres test database.
cd backend
createdb skillforge_test && psql -d skillforge_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
cp .env.example .env.test   # then point DATABASE_URL at skillforge_test
npx prisma migrate deploy   # with DATABASE_URL pointed at the test DB
npm test

# Frontend: component + utility unit tests
cd frontend
npm test
```

Also run before considering any change complete:

```bash
npm run typecheck && npm run lint && npm run build   # in both backend/ and frontend/
```

All of the above pass in this repository as committed — see the final status in the project summary.

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Instructor | `instructor@skillforge.dev` | `Instructor123!` |
| Instructor (alt) | `david.kim@skillforge.dev` | `Instructor123!` |
| Student | `student@skillforge.dev` | `Student123!` |

The primary student (`Alex Rivera`) is seeded with realistic, varied
progress: one fully completed course, one half-finished, one just started,
and one enrolled-but-untouched — so the dashboard's stats, "continue
learning," weak-topic detection, and recommendations all have real signal
to compute from immediately.

## Deployment

This is a three-service deployment, and it's what's actually running at the
[live demo](#skillforge--ai-powered-learning-platform) link above:

1. **Database — [Neon](https://neon.tech)**: serverless Postgres with native `pgvector` support, free tier. Created via `neonctl`, with `CREATE EXTENSION vector;` run once, then `npx prisma migrate deploy` and `npm run seed` pointed at its connection string.
2. **Backend — [Render](https://render.com)**: a Docker-based Web Service (free tier) built from [`backend/Dockerfile`](backend/Dockerfile), deployed straight from this public GitHub repo (`rootDir: backend`) — see [`render.yaml`](render.yaml) for the service shape. [`docker-entrypoint.sh`](backend/docker-entrypoint.sh) runs `prisma migrate deploy` before starting the server on every boot, so schema changes ship automatically with each deploy.
3. **Frontend — [Vercel](https://vercel.com)**: a static Vite build connected to the same repo, with `VITE_API_URL` set at build time to the Render service's public URL. [`frontend/vercel.json`](frontend/vercel.json) adds the SPA rewrite (`/* → /index.html`) that client-side routing needs — without it, a direct link to e.g. `/dashboard` 404s.

**The one thing that will bite you in this split-origin setup**: the
frontend and backend live on different domains (a Vercel domain calling a
Render domain), which is genuinely cross-site, not just cross-port like
local dev's Vite proxy. The session cookie has to be `SameSite=None;
Secure` for the browser to attach it to cross-site API calls at all — `Lax`
(fine for same-origin local dev) silently drops the cookie on every request
after login, which looks exactly like "login doesn't work" with no server-side
error to point at. See the `cookieOptions` comment in
[`auth.routes.ts`](backend/src/routes/auth.routes.ts).

Set `NODE_ENV=production` on the backend so cookies get both `Secure` and
`SameSite=None`, and set `CORS_ORIGIN` to your exact frontend origin
(`credentials: true` CORS requires an exact origin match, not `*`).

## Known limitations

- **Local embedding fallback is lexical, not semantic.** Without `OPENAI_API_KEY`, retrieval rewards shared vocabulary rather than shared meaning — good enough to demonstrate a working end-to-end pipeline, not a substitute for a trained embedding model in a real product.
- **No real-time push for progress/dashboards.** Those update via query invalidation/refetch after an action (the simplest reliable mechanism for this scope), not a WebSocket. The AI Tutor is the exception — it streams its answer token-by-token over Server-Sent Events (`POST /api/ai/tutor/ask/stream`), the same way a real chat product does, rather than blocking on one large response.
- **Free-tier LLM API keys have real, low rate/quota limits.** Google's Gemini free tier, for example, can cap a given model at as few as 20 requests/day per project. When a configured provider's quota is exhausted, the AI Tutor and study-resource generation detect the 429 response specifically and say so honestly ("the provider's quota is used up, not a bug in the app") rather than showing a generic error or, worse, silently falling back to a fake answer. Retrieval and citations keep working regardless — only the generation step is affected. A paid/billed API key (or a key with more headroom) resolves this immediately.
- **Single quiz question type.** Multiple-choice only; no free-text or code-execution questions.
- **The live demo's backend sleeps when idle.** Render's free Web Service tier spins the container down after 15 minutes with no traffic; the first request after that takes 30–50s to cold-start while later requests are fast. A paid Render plan (or any always-on host) removes this — it's a free-tier tradeoff, not an architectural limitation.
- **AI-generated quizzes/resources are not fact-checked automatically** beyond being grounded in retrieved course text — an instructor is expected to review AI-generated quiz questions before publishing (the UI labels them accordingly).
- **File uploads are stored as extracted text only** (not the original binary) — sufficient for RAG ingestion, not for serving the original PDF back to students.

## Future improvements

- Swap the local hashing embedding for a small local sentence-embedding model (e.g., via `@xenova/transformers`) so the zero-key fallback is semantic, not just lexical.
- Streaming AI Tutor responses (SSE) instead of a single request/response round-trip.
- Drag-and-drop module/lesson reordering in the instructor UI (the API already supports arbitrary reordering; the UI currently doesn't expose drag handles).
- Additional question types (multi-select, short answer) and per-question time limits.
- Server-sent progress events so a second open tab reflects completion without a manual refetch.
