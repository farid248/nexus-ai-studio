<div align="center">

# 🧠 Nexus AI Studio

**A multimodal AI platform — six AI capabilities, one production-grade app.**

Chat with streaming LLM · Long-term agent memory · Image understanding ·
Text-to-image with async job queue · Speech-to-text · Text-to-speech

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-New_York-7C3AED)](https://ui.shadcn.com)
[![SQLite](https://img.shields.io/badge/SQLite-persistence-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)

[English](docs/DOCUMENTATION_EN.md) · [التوثيق العربي](docs/DOCUMENTATION_AR.md)

</div>

---

## ✨ What is this?

A full-stack AI platform demonstrating how to ship **real** multimodal AI features — including the unglamorous parts nobody demos: safety-filter false positives, proxy timeouts, rate limits, and models that don't speak your users' language. Every feature was verified end-to-end in a real browser with a **zero-console-error policy**.

| Module | Highlights |
|---|---|
| 💬 **AI Chat** | Real SSE token streaming, markdown + syntax-highlighted code blocks, persistent conversations, voice input |
| 🧠 **Agent Memory** | 3-layer long-term memory: semantic facts (auto-extracted + deduped), episodic rolling summaries, working window — with a full management UI |
| 👁️ **Vision Analysis** | VLM-powered image understanding with structured markdown output |
| 🎨 **Image Studio** | Text-to-image with an **async job queue**: instant acknowledgement, live gallery polling, Arabic→English prompt auto-translation, safety-filter auto-rewrite, 5 aspect ratios |
| 🎙️ **Speech Lab** | STT + TTS with rate-limit-aware retries and honest language-support UX |
| 📊 **Dashboard** | Live stats, architecture diagram, engineering highlights |

**Plus a cross-cutting Prompt Optimizer**: in every prompt field, one click asks the system to meta-prompt an improved version (mode-specific strategies, same-language output, applied-rate analytics).

---

## 📸 Screenshots

| Dashboard | Vision Analysis |
|:---:|:---:|
| ![Dashboard — hero, live usage stats and the six AI modules](docs/screenshots/dashboard.png) | ![Vision Analysis — uploaded image with VLM answer](docs/screenshots/vision-analysis.png) |

---

## 🤖 AI Models and Selection Rationale

| Task | Model / Engine | Why it was chosen |
|---|---|---|
| Chat | **GLM-4.6** (instruction-tuned LLM) | Fast time-to-first-token — critical for SSE streaming UX; per-call parameter control |
| Vision | **GLM VLM Turbo** (vision-language) | Interactive latency; base64 image input → structured markdown output |
| Images | **Diffusion model** | 5 aspect ratios up to 1440px in a single call |
| Speech | **ASR + TTS engines** | 7 voices with adjustable speed; honest language-support UX |

Models are consumed as managed API services through one server-side SDK singleton — a deliberate trade for predictable latency and zero GPU operations, which puts the quality engineering at the prompt and orchestration layer: [**how output quality is engineered**](docs/DOCUMENTATION_EN.md#4-how-output-quality-is-engineered).

---

## 🧰 Skills This Build Exercises

TypeScript strict contracts · SSE streaming · async job queues · Prisma schema design · TanStack Query conditional polling · Zustand · prompt engineering · root-cause debugging · browser-level E2E verification — [each skill mapped to where it serves in the project](docs/DOCUMENTATION_EN.md#5-skills-needed-and-what-each-one-serves).

---

## 🏗️ Architecture

One user-visible route (`/`) with client-side view switching; all model calls happen server-side behind API routes — credentials never reach the client.

```mermaid
flowchart LR
    UI[Browser<br/>single route / · Zustand] --> API[Next.js API routes]
    API --> SDK[z-ai-web-dev-sdk<br/>LLM · VLM · Diffusion · ASR · TTS]
    API --> DB[(SQLite via Prisma<br/>6 models)]
    API --> FS[(public/generated<br/>PNG assets)]
```

```mermaid
flowchart TD
    subgraph JobQueue["Image Studio — async generation pipeline"]
    A[POST /api/images] -->|&lt;1s| B[processing row]
    B --> C[Detached background job<br/>180s timeout]
    C -->|safety filter 1301| D[LLM rewrite + retry]
    C --> E[done + url / failed + reason]
    E --> F[Gallery polls every 3s]
    end
```

---

## 🚀 Getting started

**Prerequisites:** [Bun](https://bun.sh) ≥ 1.3 (or Node.js ≥ 20) and Git.

```bash
git clone https://github.com/farid248/nexus-ai-studio.git
cd nexus-ai-studio
bun install                      # or: npm install
cp .env.example .env             # SQLite database location
bun run db:push                  # create the 6-table schema
bun run dev                      # → http://localhost:3000
```

### AI credentials

The six AI capabilities (chat, vision, image generation, STT, TTS) call GLM-family models through `z-ai-web-dev-sdk`, which reads its credentials from a JSON config file. Create **`.z-ai-config`** in the project root (or `~/.z-ai-config`):

```json
{
  "baseUrl": "https://YOUR_ZAI_API_BASE/v1",
  "apiKey": "YOUR_API_KEY",
  "token": "YOUR_ACCESS_TOKEN",
  "chatId": "OPTIONAL_CHAT_ID",
  "userId": "OPTIONAL_USER_ID"
}
```

Without this file the app still boots — the UI, dashboard, SQLite persistence and conversation history all work — but every model call returns an error. All AI access is funneled through one server-side singleton (`src/lib/zai.ts`), which re-reads this file on every call: rotate the token and the next request picks it up without a restart. Swapping in a different provider means editing that single integration point.

---

## 🛠️ Engineering highlights

These are real debugging stories, each verified end-to-end — details in [the docs](docs/DOCUMENTATION_EN.md#11-engineering-war-stories):

- **"Every generation fails" was a proxy-timeout illusion** — the edge proxy returned an HTML 504 page mid-generation while the server happily finished and saved every image (the same user prompt appeared 3× in the DB within 3 minutes). Fixed with the async job-queue architecture: no HTTP request can outlive any timeout.
- **Arabic prompts were false-flagged by the image safety filter** — the diffusion model can't parse Arabic script, so innocent prompts failed. Fixed with a Stage-0 LLM translation pass + an always-English safety rewriter.
- **A forensic ASR investigation** (5 probe scripts) proved the STT engine fundamentally lacks Arabic support — instead of pretending otherwise, the app ships script detection, amber accuracy warnings, and rate-limit-aware retries.
- **3-layer agent memory** with auto-extraction, unique-constraint dedupe, importance scoring, pinning, and rolling summaries — verified with cross-session recall tests.

---

## 📚 Documentation

- 📄 **[Complete English documentation](docs/DOCUMENTATION_EN.md)** — every module, endpoint, data model, and engineering decision
- 📄 **[التوثيق العربي الكامل](docs/DOCUMENTATION_AR.md)** — نفس المحتوى بالعربية

## 🛠️ Scripts

| Command | Description |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run lint` | ESLint (ships clean) |
| `bun run db:push` | Sync Prisma schema to SQLite |

---

<div align="center">

**Built by [farid248](https://github.com/farid248)**

*Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui · Prisma · SQLite · TanStack Query · Zustand · Framer Motion*

</div>
