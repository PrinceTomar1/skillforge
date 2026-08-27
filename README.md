# SkillForge

An AI-powered learning platform I built during my internship at Celebal
Technologies. Students can browse courses, watch lessons, take quizzes and
track their progress; instructors can build courses and see how their
students are doing. The main thing I wanted to get right was the **AI Tutor**
— it's a real Retrieval-Augmented Generation (RAG) setup, not just a chatbot
with the course name in the prompt.

**Live demo:** https://skillforge-topaz-mu.vercel.app

> The API is on Render's free tier and sleeps after 15 min of inactivity, so
> the first request can take ~30s to wake up. It's fast after that.

Demo logins:

| Role | Email | Password |
|---|---|---|
| Student | `student@skillforge.dev` | `Student123!` |
| Instructor | `instructor@skillforge.dev` | `Instructor123!` |

---

## What it does

**Students**
- Search / filter the course catalog, enroll, watch video lessons + read notes
- Per-lesson progress that persists and rolls up into course completion
- Multiple-choice quizzes with real scoring, answer review and attempt history
- Ask the AI Tutor questions about the course they're in — answers are grounded
  in that course's material, cite their sources, and stream in as they generate
- Generate study resources (summaries, flashcards, practice questions) from the
  course content
- Dashboard with real stats: completion, quiz averages, streak, weak topics

**Instructors**
- Create / edit / publish / delete courses, manage modules and lessons
- Upload PDFs / notes that get chunked + embedded into the same RAG index
- Write quizzes by hand or generate a draft with AI and edit it
- Per-course analytics: enrollments, completion, quiz performance by topic

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind, TanStack Query, Recharts
- **Backend:** Node + Express + TypeScript, Prisma
- **Database:** PostgreSQL + `pgvector` (same DB for relational data and vectors)
- **Auth:** JWT in an httpOnly cookie, bcrypt for passwords
- **AI:** pluggable LLM provider (Anthropic or Gemini), OpenAI embeddings with a
  local fallback so it runs with no API keys
- **Tests:** Vitest + Supertest (backend), Vitest + Testing Library (frontend)

## The RAG pipeline

Code is in [`backend/src/services/ai`](backend/src/services/ai). Roughly:

1. **Ingestion** – lesson text and uploaded documents become `Document` rows.
   Editing a lesson re-ingests it.
2. **Chunking** – text is cleaned and split into ~220-word overlapping windows.
3. **Embedding** – each chunk is embedded and stored as a `vector(1536)` column
   with an HNSW index.
4. **Retrieval** – the question is embedded and matched by cosine distance,
   **scoped to the current course only**. There's a test that asks a Kubernetes
   question against a watercolour-painting course and checks it gets nothing back.
5. **Generation** – the retrieved chunks go into the system prompt with
   instructions to answer only from that context and to say "I couldn't find
   this in the course material" instead of guessing. The answer streams back
   over Server-Sent Events.

If no `OPENAI_API_KEY` is set, embeddings fall back to a deterministic
hashing-trick vector — it's lexical not semantic, but the whole
ingest → embed → retrieve path still runs for real. If no LLM key is set, the
tutor still retrieves and shows sources, and tells you generation isn't
configured rather than faking an answer.

## Running locally

You need Node 20+ and Postgres with `pgvector` (or just use Docker).

```bash
git clone https://github.com/PrinceTomar1/skillforge
cd skillforge

# backend
cd backend
npm install
cp .env.example .env          # set DATABASE_URL and a JWT_SECRET
createdb skillforge
psql -d skillforge -c "CREATE EXTENSION IF NOT EXISTS vector;"
npx prisma migrate deploy
npm run seed
npm run dev                    # :4000

# frontend (second terminal)
cd ../frontend
npm install
npm run dev                    # :5173
```

Then open http://localhost:5173.

To use the real AI Tutor, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY=...`
(free key from https://aistudio.google.com/apikey) in `backend/.env`. I used
Gemini for this. `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` also works.

### Docker

```bash
docker compose up --build
```

Starts Postgres, runs migrations + seed, and brings up both apps. Pass AI keys
through a root `.env` file or the shell.

## Tests

```bash
# backend – needs a test DB
createdb skillforge_test && psql -d skillforge_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
cp .env.example .env.test      # point DATABASE_URL at skillforge_test
DATABASE_URL=...skillforge_test npx prisma migrate deploy
npm test                       # 45 tests

# frontend
cd ../frontend && npm test     # 15 tests
```

Covers auth, course ownership checks, quiz scoring, RAG course-scoping, the
streaming endpoint, and the no-key fallback.

## Notes / things I'd still do

- The local embedding fallback is lexical, not semantic — fine for a demo, not
  for a real product. Would swap in a small local sentence-embedding model.
- Progress/dashboard updates happen on refetch after an action, not via
  websockets. The AI Tutor is the only thing that streams.
- Free-tier Gemini keys have a low daily request cap. When it's hit the app
  detects the 429 and says so instead of erroring weirdly — retrieval keeps
  working.
- Quizzes are multiple-choice only.
- Uploaded files are stored as extracted text, not the original PDF.

## Structure

```
backend/
  prisma/        schema, migrations, seed data + lesson content
  src/
    routes/      one file per resource
    services/    ai/ (chunking, embeddings, retrieval, tutor, generation) + the rest
    middleware/   auth, validation, errors
frontend/
  src/
    pages/       student/ and instructor/ routes
    components/   ui primitives, layout
    context/     AuthContext
    lib/api.ts   typed axios client
```
