# App Walkthrough — Interview Prep Reference

A self-contained guide to the codebase from two perspectives. Read top-to-bottom or jump to a section.

## Contents

- [A. Reset commands (run before walkthrough)](#a-reset-commands)
- [B. Non-tech walkthrough — what the app does](#b-non-tech-walkthrough)
  - [The one-line pitch](#the-one-line-pitch)
  - [Mental model: "Excel meets ChatGPT"](#mental-model-excel-meets-chatgpt)
  - [The user journey, step by step](#the-user-journey-step-by-step)
  - [What makes it useful](#what-makes-it-useful)
  - [Who'd actually use this?](#whod-actually-use-this)
- [C. Tech walkthrough — how it actually works](#c-tech-walkthrough)
  - [High-level architecture](#high-level-architecture)
  - [The three swap-points](#the-three-swap-points)
  - [Code structure](#code-structure)
  - [Data flow #1: CSV upload](#data-flow-1-csv-upload)
  - [Data flow #2: chart save + render](#data-flow-2-chart-save--render)
  - [Data flow #3: AI "Ask a question"](#data-flow-3-ai-ask-a-question)
  - [Auth flow (JWT + refresh rotation)](#auth-flow-jwt--refresh-rotation)
- [D. Bugs / gaps found during walkthrough](#d-bugs--gaps-found-during-walkthrough)
- [E. Recommended fixes (priority order)](#e-recommended-fixes-priority-order)

---

## A. Reset commands

Stop both dev servers (`Ctrl+C` in their terminals). Then in a fresh terminal:

```powershell
cd D:\WebDevelopment\csv\server

# 1) Create the user.name migration
npx prisma migrate dev --name add_user_name

# 2) Reset DB to empty (drops all data, replays all migrations)
npx prisma migrate reset --force

# 3) Restart server
npm run dev
```

Other terminal:

```powershell
cd D:\WebDevelopment\csv\client
npm run dev
```

Open `http://localhost:5173` in **incognito** so we walk through truly fresh (no leftover cookies).

---

## B. Non-Tech Walkthrough

### The one-line pitch

> A free, AI-assisted way to turn any spreadsheet into charts you can save and ask questions about — without learning Excel formulas, SQL, or signing up for Tableau.

### Mental model: "Excel meets ChatGPT"

```
   Your CSV file              The app                  What you get
  ┌─────────────┐         ┌──────────────┐         ┌──────────────────┐
  │ sales.csv   │   ─►    │ Reads & sorts │   ─►    │ • Charts         │
  │ leads.csv   │         │ the data      │         │ • AI insights    │
  │ orders.csv  │         │ Suggests      │         │ • Saved          │
  └─────────────┘         │ questions     │         │   dashboard      │
                          └──────────────┘         └──────────────────┘
```

### The user journey, step by step

```
 ① Sign up        ②  Upload CSV     ③  Open dataset    ④  Build chart
 ┌──────────┐    ┌────────────┐    ┌─────────────┐    ┌──────────────┐
 │ Name     │    │ Click      │    │ App detects │    │ Pick X axis, │
 │ Email    │ ─► │ "Choose    │ ─► │ columns &   │ ─► │ Y axis, type │
 │ Password │    │ CSV"       │    │ types       │    │ → see chart  │
 └──────────┘    └────────────┘    └─────────────┘    └──────────────┘
                                          │
                                          ▼
 ⑦  Log out       ⑥  Save charts    ⑤  Ask AI / use suggestions
 ┌──────────┐    ┌────────────┐    ┌─────────────────────────┐
 │ Comes    │    │ Up to 3 on │    │ "revenue by month?"     │
 │ back     │ ◄─ │ your dash  │ ◄─ │ "explain this chart"    │
 │ later  ✓ │    │ board      │    │ "try these 3 questions" │
 └──────────┘    └────────────┘    └─────────────────────────┘
```

### What makes it useful

- **Bring data you already have** — no need to install tracking SDKs (unlike Mixpanel)
- **AI does the boring part** — suggests interesting questions, explains charts in plain English
- **30 seconds to first chart**, vs hours setting up Looker or Tableau
- **Free** to try, dashboards persist, you can come back later

### Who'd actually use this?

| Persona | Why they care |
|---|---|
| Small business owner | Has sales/inventory CSVs from accounting software, wants quick visuals |
| Marketer | Has leads CSV from HubSpot/Mailchimp, wants conversion rates by source |
| Indie hacker | Has Stripe transactions CSV, wants MRR / churn charts without paid tools |
| Analyst at a small co. | Wants a "pretty dashboard" for a board deck without IT involvement |

---

## C. Tech Walkthrough

### High-level architecture

```
                  ┌──────────────────────────────────────┐
                  │            User's browser            │
                  │   React SPA on Vercel (or :5173)     │
                  └────────────────┬─────────────────────┘
                                   │ httpOnly cookies + CSRF header
                                   │ (axios with 401-refresh interceptor)
                                   ▼
                  ┌──────────────────────────────────────┐
                  │       Express API on Render          │
                  │                                      │
                  │   ┌────────────────────────────┐    │
                  │   │  routes/  (thin HTTP shell) │    │
                  │   ├────────────────────────────┤    │
                  │   │  middleware/  (auth/csrf)   │    │
                  │   ├────────────────────────────┤    │
                  │   │  services/  (business)      │    │
                  │   ├────────────────────────────┤    │
                  │   │  ports/  (interfaces)       │    │
                  │   ├──┬──────────┬──────────────┤    │
                  │   │  │ db/repos │ llm/         │    │
                  │   └──┴────┬─────┴──────┬───────┘    │
                  └──────────┼────────────┼──────────────┘
                             │            │
              ┌──────────────▼──┐    ┌────▼────────────────────┐
              │ Postgres (Neon) │    │ Google Gemini 2.5 Flash │
              │ JSONB rows      │    │ (or mock for dev)       │
              └─────────────────┘    └─────────────────────────┘
```

### The three swap-points

```
  Today                  Tomorrow                   Story
  ─────────              ─────────                  ─────
  GeminiProvider    ─►   AnthropicProvider          1 file, change LLM_PROVIDER env var
  GroqProvider
  OpenAIProvider

  Prisma+Postgres   ─►   Drizzle / DuckDB           Implement 5 repository interfaces
                    ─►   Read-replica routing       Swap one adapter file

  MailProvider      ─►   SES / Postmark / SMTP      Interface seam already there;
  (interface only)       worker job for scheduled    add an impl + worker, services unchanged
                         reports + alerts
```

### Code structure

```
csv/
├─ server/src/
│  ├─ config/env.ts         ◄── Zod-validated env loader
│  ├─ db/
│  │  ├─ client.ts          ◄── Prisma client singleton
│  │  └─ repositories/      ◄── ⚡ swap-point #1: interface + Prisma impl
│  │     ├─ userRepo.ts
│  │     ├─ sessionRepo.ts
│  │     ├─ datasetRepo.ts  ◄── owns aggregation SQL with column allowlist
│  │     ├─ chartRepo.ts
│  │     └─ insightRepo.ts
│  ├─ llm/                  ◄── ⚡ swap-point #2
│  │  ├─ index.ts           ◄── LLMProvider interface
│  │  ├─ gemini.ts          ◄── default
│  │  └─ mock.ts            ◄── for dev without API key
│  ├─ mail/index.ts         ◄── ⚡ swap-point #3 (no impl, seam reserved)
│  ├─ services/             ◄── business logic, depends on interfaces
│  │  ├─ authService.ts     ◄── JWT pair + refresh rotation
│  │  ├─ csvService.ts      ◄── streaming parse + type infer + batch insert
│  │  ├─ datasetService.ts
│  │  ├─ chartService.ts    ◄── 3-cap enforced here
│  │  ├─ aggregationService.ts
│  │  └─ aiService.ts       ◄── ⚡ prompt-injection defenses live here
│  ├─ routes/               ◄── HTTP endpoints (thin shell)
│  ├─ middleware/           ◄── requireAuth, csrf, rate limit, error handler
│  ├─ schemas/              ◄── Zod input validators (auth, chart, ai)
│  ├─ lib/                  ◄── typeInference, errors, logger, hash
│  ├─ app.ts                ◄── wires everything together
│  └─ index.ts              ◄── process entry
│
└─ client/src/
   ├─ api/                  ◄── axios + endpoint modules + 401-refresh interceptor
   ├─ components/ui/        ◄── shadcn primitives (button, input, card, ...)
   ├─ features/
   │  ├─ auth/              ◄── login, signup, useAuth
   │  ├─ datasets/          ◄── upload, list, preview, replace, detail page
   │  ├─ charts/            ◄── chart card, renderer (Recharts)
   │  ├─ chart-builder/     ◄── live preview + save
   │  ├─ dashboard/         ◄── header, page
   │  └─ ai/                ◄── ask, explain, suggest
   ├─ routes/ProtectedRoute.tsx
   ├─ App.tsx + main.tsx
   └─ styles/globals.css
```

### Data flow #1: CSV upload

```
 Browser       │  client/src/features/datasets/UploadCard.tsx
   ┌──┐        │  • multipart/form-data POST
   │  │ ──────►│  X-CSRF-Token header
   └──┘        │
               │ ┌─────────────────────────────────────────────┐
               │ │ POST /api/datasets                          │
               │ │ ┌─────────────────────────────────────────┐ │
               │ │ │ multer → memory buffer (≤10 MB)         │ │
               │ │ │ requireAuth → req.userId set            │ │
               │ │ │ csrf check                              │ │
               │ │ │           │                             │ │
               │ │ │           ▼                             │ │
               │ │ │ datasetService.ingestUpload             │ │
               │ │ │   ├── csvService.parseBuffer            │ │
               │ │ │   │   ├── checkLikelyWrongDelimiter ✓   │ │
               │ │ │   │   ├── streaming csv-parse           │ │
               │ │ │   │   ├── pivot rows by column          │ │
               │ │ │   │   ├── inferColumnType per col       │ │
               │ │ │   │   └── castCell → typed JSONB rows   │ │
               │ │ │   ├── datasetRepo.create                │ │
               │ │ │   └── datasetRepo.bulkInsertRows (1k batch)│
               │ │ └─────────────────────────────────────────┘ │
               │ └─────────────────────────────────────────────┘
               │
   ┌──┐        │ Response: dataset summary with columnsMeta + parseErrors
   │  │ ◄──────│
   └──┘        │
```

### Data flow #2: chart save + render

```
 Save click         /api/charts (POST)        Render (later)
 ┌────────┐         ┌─────────────────┐       ┌─────────────────┐
 │ spec   │         │ chartService    │       │ /api/charts/    │
 │ {x,y,  │ ──────► │  .create        │ ──┐   │  :id/data       │
 │  type, │         │  ├─ count cap   │   │   │  ┌────────────┐ │
 │  agg}  │         │  ├─ allowlist   │   │   │  │ aggSvc     │ │
 └────────┘         │  └─ chartRepo   │   │   │  │ .runForChart│ │
                    │     .create     │   │   │  │  │          │ │
                    └─────────────────┘   │   │  │  ▼          │ │
                                          │   │  │ datasetRepo │ │
                                          │   │  │ .aggregate  │ │
                                          │   │  │  │          │ │
                                          │   │  │  ▼ paramSQL │ │
                                          │   │  │ Postgres    │ │
                                          │   │  │ JSONB ->>   │ │
                                          │   │  │ + GROUP BY  │ │
                                          │   │  │  │          │ │
                                          │   │  │  ▼ buckets  │ │
                                          │   │  │ Number()    │ │
                                          │   │  │ (BigInt fix)│ │
                                          │   │  └────────────┘ │
                                          │   │  ▼              │
                                          │   │ buckets[] →     │
                                          │   │ Recharts render │
                                          │   └─────────────────┘
```

### Data flow #3: AI "Ask a question"

The safety story — five layers between user input and SQL:

```
 User types           Server sends             Gemini returns        Validation gauntlet
 "revenue              {columnsMeta,            JSON spec only        ─────────────────
  by month"            JSON schema}                                   ▼ Layer 1: responseSchema
                                                                       (constrained at decode)
 ─────►   POST /api/ai/ask    ──►   Gemini 2.5 Flash    ──►          ▼ Layer 2: Zod
                                                                       (schema strict)
                                                                     ▼ Layer 3: column allowlist
                                                                       (must match dataset)
                                                                     ▼ Layer 4: parameterized SQL
                                                                       (data->>$1)
                                                                     ▼ Layer 5: user scope
                                                                       (WHERE userId = ...)

                                                                     [SAFE TO RUN]
                                                                          ▼
                                                                     aggregationService
                                                                     → buckets → render
```

> **Important:** raw CSV cell content NEVER reaches Gemini. Only column metadata + aggregated stats. (`test-csvs/prompt-injection.csv` exercises this defensively.)

### Auth flow (JWT + refresh rotation)

```
 ┌─ Sign up / Log in
 │   • bcrypt hash password
 │   • mint access token (JWT, 15min, in httpOnly cookie at /)
 │   • mint refresh token (random 48 bytes, sha256-hashed in DB,
 │                          httpOnly cookie at /api/auth)
 │
 ├─ Every API request
 │   • access cookie auto-attached
 │   • requireAuth middleware verifies JWT signature + expiry → no DB hit
 │
 ├─ Access token expires (15 min)
 │   • client gets 401
 │   • axios interceptor calls POST /api/auth/refresh
 │   • server validates refresh token (DB lookup), rotates it,
 │     issues new access + new refresh
 │   • original failed request retries automatically
 │
 ├─ Token theft detection
 │   • if a REVOKED refresh token is presented → reuse signal
 │   • all of the user's active refresh tokens revoked → forced re-login
 │
 └─ Logout
     • delete refresh token row + clear cookies
     • access token expires on its own within 15 min (no DB needed)
```

---

## D. Bugs / Gaps Found During Walkthrough

| # | Issue | Severity | Where |
|---|---|---|---|
| 1 | **Cookies won't work cross-origin in prod** — `SameSite=Lax` blocks cookies from Vercel client → Render API. Need `SameSite=None` when secure (prod). | 🔴 deploy-blocking | `routes/auth.ts` `setAuthCookies`, `middleware/csrf.ts` |
| 2 | **No rate limit on `/api/auth/refresh`** — can be brute-forced for token guessing | 🟡 prod hardening | `routes/auth.ts` |
| 3 | **No rate limit on `/api/charts/preview`** — burns Postgres compute if hammered | 🟡 prod hardening | `routes/charts.ts` |
| 4 | **`cookies.txt` and `datasetId.txt` not gitignored** — testing artifacts pollute the repo | 🟢 hygiene | `.gitignore` |
| 5 | **`render.yaml`, `test-csvs/`, `docs/`, `README.md` still untracked** — Phase 8 not committed yet | 🟢 untracked | repo root |
| 6 | **CSV parse errors in `csvService.parseStream` aren't wrapped** — only `parseBuffer` runs `checkLikelyWrongDelimiter`. Stream path (currently unused) skips the check. | 🟢 future-proof | `services/csvService.ts` |
| 7 | **Replace-data flow doesn't auto-update charts** — if a user replaces with new schema, old charts referencing missing columns just show "Couldn't render". We warn at upload but don't proactively prompt. | 🟡 UX | `features/datasets/ReplaceDataModal.tsx` |
| 8 | **`/api/auth/me` always reads from DB** — could be cached via JWT payload, but optimization not bug | 🟢 perf | `routes/auth.ts` |
| 9 | **Suggested questions cache is keyed by columns only** — if dataset rows change (replace-data) but columns stay, stale suggestions show. They're still valid spec-wise. | 🟢 staleness | `services/aiService.ts` |
| 10 | **No client-side error boundary** — a render crash takes down the whole app. React 18 `<ErrorBoundary>` patterns we don't use. | 🟡 robustness | client root |

---

## E. Recommended Fixes (priority order)

### Critical (must fix before deploy)
1. **Cookies cross-origin**: `SameSite: secure ? 'none' : 'lax'` in both `routes/auth.ts` and `csrf.ts`. Add to README that prod requires HTTPS for SameSite=None.
2. **Add rate limiters** on `/auth/refresh`, `/ai/*`, `/charts/preview` — already have `aiLimiter` and `loginLimiter`; add `refreshLimiter` (e.g., 30/min/IP) and apply `aiLimiter` to preview too.

### Hygiene (clean up before push to GitHub)
3. **`.gitignore`** add `cookies.txt`, `datasetId.txt`, `*.cookies`, `*.tmp`. Remove the existing files.
4. **Commit the rest of Phase 8**: `render.yaml`, `test-csvs/`, `docs/`, `README.md` — three commits.

### Nice-to-have (post-deploy, into roadmap)
5. Error boundary at app root
6. Auto-flag broken charts after replace-data
7. Stream-path delimiter check parity

---

## Glossary (for the non-tech reader)

| Term | Plain meaning |
|---|---|
| **JWT** | A signed sticker that proves who you are without the server having to look you up every time |
| **Refresh token** | A spare key kept in the database that lets you get a new sticker when your current one expires |
| **CSRF** | Stops a malicious website from making your browser do things on this app behind your back |
| **JSONB** | Postgres's way of storing flexible/structured data inside a single column |
| **Aggregation** | "sum / avg / count" — math over many rows grouped by a category |
| **Allowlist** | Only specific column names allowed; anything else rejected |
| **Modular monolith** | One server program organized into clean folders, instead of many tiny services |
| **Adapter / Port** | A swappable plug — write a new one to change a vendor without touching business logic |
