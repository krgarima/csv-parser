# Lightweight Data Analytics SaaS

A stripped-down Mixpanel/Amplitude. Sign up, upload a CSV, build charts,
save up to three to a dashboard, and ask AI questions about your data.

> **Live URL note:** the API runs on Render's free tier with a UptimeRobot
> keep-alive every 10 minutes. If the keep-alive ever lapses, the first
> request after 15+ minutes idle takes ~30 seconds to wake the dyno; the UI
> shows a "waking up" banner. Subsequent requests are fast.

---

## Quickstart (fresh machine in <5 minutes)

Prereqs: Node 20+, Docker (for local Postgres), npm.

```bash
git clone <repo-url> && cd csv

# 1. Local Postgres
docker compose up -d

# 2. Server
cd server
cp .env.example .env
# Generate token secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # use as ACCESS_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # use as REFRESH_TOKEN_SECRET
# For LLM_API_KEY get a free Gemini key: https://aistudio.google.com/apikey
# (or set LLM_PROVIDER=mock to skip AI and run offline)
npm install
npx prisma migrate dev --name init
npm run dev

# 3. Client (separate terminal)
cd ../client
cp .env.example .env   # leave VITE_API_URL empty for dev (vite proxy handles it)
npm install
npm run dev

# Open http://localhost:5173
```

To verify: sign up, upload `test-csvs/sample-sales.csv`, build a "sum of
revenue by region" bar chart, save it, log out, log back in — the chart
should still be there.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Brief mandates React; Vite for fast HMR. |
| UI | Tailwind + shadcn/ui primitives | No design system to invent. |
| Charts | Recharts | Composable React-native API. |
| Server state | TanStack Query | Cache, retry, optimistic updates. |
| Forms | React Hook Form + Zod | Schemas shared client/server. |
| Backend | Node 20 + Express + TypeScript (strict) | Brief mandates Node. |
| ORM | Prisma | Type-safe queries, migrations as code. |
| DB | Postgres (Neon free tier) | JSONB row storage; aggregations push down. |
| CSV parser | `csv-parse` (streaming) | Battle-tested; handles BOM/quoted/embedded newlines. |
| Auth | JWT (access 15m + refresh 7d, rotation, theft detection) | Stateless verification scales to mobile/microservices later. |
| Hashing | bcrypt (cost 12) | Standard, predictable cost on free tier. |
| LLM | Google Gemini 2.5 Flash (default) | Real free tier; native `responseSchema` for safe JSON. |
| Validation | Zod | Single schema for client+server. |
| Logs | pino | Structured JSON, fast. |
| Deploy | Vercel (web) + Render free (api) + Neon free (db) | Zero-cost. |

---

## Architecture

```
Browser  ──▶  React SPA (Vercel, free)
                     │ httpOnly cookies + CSRF header
                     ▼
              Express API (Render free, kept warm by 10-min ping)
                ├──▶ Postgres (Neon free, JSONB row storage)
                └──▶ Google Gemini 2.5 Flash (aggregated stats only — never raw rows)
```

**Modular monolith with three swap-points:**

- **`LLMProvider`** — Gemini today; Anthropic/Groq/OpenAI by writing one
  new file. One env var to swap.
- **Repository interfaces** — `UserRepository`, `DatasetRepository`,
  `ChartRepository`, `InsightRepository`, `SessionRepository`. Prisma is
  hidden inside the implementations; services depend on the interface.
- **`MailProvider`** — interface seam reserved for future password reset,
  alerts, scheduled reports. No implementation yet — reserving the seam now
  is free; retrofitting later is expensive.

Everything else (HTTP routes, middleware, services, libs) is plain modules.
No composition root, no domain types separate from Prisma types. The full
file structure is in [docs/architecture.png](docs/architecture.png) (TODO:
add Excalidraw export).

---

## Data model

```
User ──< Dataset ──< DatasetRow      (row data in JSONB, cast at upload)
  │         │
  │         ├──< Chart                (max 3 per user; service-enforced)
  │         └──< Insight              (cached AI output keyed by contextHash)
  │
  └──< RefreshToken                   (sha256-hashed; revocation + rotation)
```

**Type-cast at upload time.** Numbers / dates / text are cast and stored
typed inside JSONB. Cells that fail to cast become `null` and are recorded
in `Dataset.parseErrors` (capped at 100) so the UI can surface them.
Aggregations then use `(data->>'col')::numeric` safely with no runtime cast
errors.

See [server/prisma/schema.prisma](server/prisma/schema.prisma).

---

## Five open-ended decisions (ADRs)

The brief calls these out as the things to defend. Linked ADRs explain the
alternatives considered and the rationale.

1. **CSV storage shape** — JSONB rows with cast-at-upload. ([ADR 01](docs/decisions/01-csv-storage.md))
2. **Aggregation location** — In Postgres via SQL behind a repository
   interface. ([ADR 02](docs/decisions/02-aggregations.md))
3. **Second upload** — Each upload is a new dataset; explicit "Replace data"
   action keeps charts pointing at the same dataset id. ([ADR 03](docs/decisions/03-second-upload.md))
4. **50k-row behaviour** — Stream-parse, batch-insert, hard-cap. ([ADR 04](docs/decisions/04-fifty-thousand-rows.md))
5. **AI feature** — Hybrid: explain + ask + suggest, sharing one
   `LLMProvider` with constrained NL→spec defending against prompt and SQL
   injection. ([ADR 05](docs/decisions/05-ai-feature.md))

---

## AI integration — short version

Three touchpoints share one `LLMProvider`. Detail in [ADR 05](docs/decisions/05-ai-feature.md).

- **Ask a question** — NL → strict JSON chart spec (`responseSchema` at
  Gemini layer + Zod re-validation + column allowlist + parameterized SQL).
  The LLM never writes SQL.
- **Explain this chart** — sends chart spec + aggregated buckets, returns a
  2-3 sentence explanation. Cached.
- **Suggested questions** — on upload, three starter questions that prefill
  the chart builder.

**Raw CSV cell content is never sent to the LLM.** Only column metadata and
aggregated stats. The fixture `test-csvs/prompt-injection.csv` exercises
this.

---

## Edge cases handled

(Each has a fixture under `test-csvs/`.)

- UTF-8 BOM at file start.
- Quoted fields with embedded commas and newlines.
- Duplicate column headers — disambiguated (`name`, `name_2`).
- Empty column headers — auto-named `column_N`.
- Mixed types in a column — bad cells become null, recorded in
  `parseErrors`, upload doesn't fail.
- Date detection: ISO-8601, `YYYY-MM-DD`, `MM/DD/YYYY`. Anything else falls
  through to text. We don't pretend to be smart about ambiguous formats.
- NaN/Infinity in numeric columns → null (JSON serialisation breaks
  otherwise).
- Empty CSV / no headers / no data rows — clear errors.
- File >10MB or >50,000 rows — rejected with `PAYLOAD_TOO_LARGE`.
- IDOR — repository signatures require `userId` on every dataset/chart
  read. There is no "find by id" without scope.
- SQL injection via column name — column names are bound as parameters to
  `data->>$1`, AND validated against `columnsMeta` allowlist beforehand.
- Login brute-force — 5/min/IP rate limit + slow bcrypt.
- Refresh-token reuse — if a revoked token is presented, the user's entire
  active token chain is revoked.
- Concurrent uploads from one user — independent datasets, no interleave.
- Chart with empty result set — empty state, no Recharts crash.
- Prompt injection from CSV cells — aggregated stats only, never raw cells.

---

## Future expansion

The architecture has these seams reserved:

- **Mobile / third-party API** — JWT verification is stateless. A mobile
  app can use the access token as a `Authorization: Bearer` header instead
  of a cookie; the same `requireAuth` middleware works.
- **Scheduled reports / alerts** — `MailProvider` interface is in place
  with no implementation. Add an SES/Postmark/SMTP adapter and a worker job;
  services don't change.
- **Background jobs** — large uploads can be moved off the HTTP path to a
  BullMQ queue without changing `csvService`'s public API.
- **Sharing / teams** — the data model adds a `Workspace` aggregate; existing
  scope checks become `workspaceId`-aware. No service rewrites.
- **Embeddings / semantic search** — `LLMProvider` interface adds a
  `generateEmbedding` method; new pgvector index. AI flows compound.
- **Different DB engine** — repository implementations are the swap point.
  Prisma supports many engines; for non-Prisma the interface is small.

---

## What I'd do differently with more time

Specific, not generic:

- **Per-dataset typed tables** at >1M rows — JSONB casts are fast enough
  for 50k but not for millions. Migration is a one-line SELECT INTO.
- **Fly.io free allowance** instead of Render free + ping — no sleep, no
  kludge, but requires a credit card. Reviewer-UX-vs-zero-CC trade-off.
- **Background job queue** (BullMQ + Redis) so HTTP doesn't hold open
  during 50k-row ingestion. Dataset gets a `processing` status the UI polls.
- **Stricter date detection** with `chrono-node` — current 3-format whitelist
  is honest but limited.
- **Per-user AI usage tracking + spend caps** — important if this graduates
  to a public product.
- **Real `MailProvider` impl** for password reset + login email verification.
- **High-cardinality "Other" bucket** in chart aggregations — top 25 plus a
  catch-all for the long tail.
- **Excalidraw architecture diagram** committed to `docs/architecture.png`
  (placeholder today).

---

## Roadmap

### What I'd build next (3-5 features)

1. **Shareable dashboards** — copy a public read-only link for a single
   chart or dashboard. Solves "I made this, let my team see it."
2. **Scheduled email reports** — weekly snapshot of saved charts to your
   inbox. Solves "I have to remember to log in to see whether numbers
   moved."
3. **Anomaly alerts** — get an email or Slack when a chart's metric breaks
   a threshold (e.g., revenue drops 20% week-over-week). Solves "by the
   time I check the dashboard, the issue is days old."
4. **Joins across datasets** — pick a key column, merge two CSVs in a
   chart. Solves "I have leads.csv and revenue.csv but they're not glued
   together."
5. **Chart-to-CSV export** — download the aggregated buckets as a CSV.
   Solves "I want to drop these numbers into a slide / Slack / Notion."

### Architectural changes those would require

- **Sharing** — a public-link table with a random opaque id, scoped read
  middleware that bypasses `requireAuth` only for the chart endpoint when a
  valid share id is presented.
- **Scheduled reports** — a job runner (BullMQ + Redis), the existing
  `MailProvider` seam, and a `ScheduledReport` aggregate. Charts get
  rendered server-side as PNG (puppeteer or @vercel/og).
- **Anomaly alerts** — same job runner, plus an `Alert` aggregate with
  threshold rules. Re-uses the aggregation engine — alerts are just
  "compare this aggregation now to its previous value."
- **Joins** — a query planner that can wire two `AggregationSpec`s through
  a join clause. The LLM's NL→spec output gains a `joins` field.
- **Export** — a streaming SQL → CSV writer at the route layer. Aggregation
  service unchanged.

### What would make users pay

Three things that turn a tool into a product worth a credit card:

- **Time-to-insight** — the right chart in the first 60 seconds after
  upload. Suggested questions + NL→spec are the start of this; honestly the
  bar is much higher (autodetect important columns, suggest 10 questions
  not 3, render them all in a single dashboard).
- **Low-friction sharing** — colleagues see your work without signups.
  Share links + scheduled reports do this.
- **Alerts that earn their keep** — ones that fire when something breaks,
  not when something arbitrary changes. Mostly a quality-of-detection
  problem, but the architecture has to be there first.

Features alone don't sell — these are the value vectors. Mixpanel/Amplitude
sell the same things at the high end; the differentiator is "you bring your
own CSV, no event-tracking SDK, no contract."

---

## Trade-offs knowingly accepted

- **Render free tier sleeps** without the keep-alive. Documented above.
  Mitigated by UptimeRobot ping + UI banner. Not hidden.
- **No mobile-responsive polish.** Works on phones, doesn't sing on them.
- **Files capped at 10 MB / 50k rows.** We don't pretend to handle 200 MB.
- **No password reset.** Mail seam reserved; impl deferred.
- **No multi-tenant org/team accounts.** Data model can grow into it; UI
  can't yet.
- **No realtime / streaming sources.** CSV-only.
- **Three chart types.** Bar, line, pie. Recharts can do more; the brief
  asked for these.

---

## Project layout

```
csv/
├── client/                     # React SPA
├── server/                     # Express API
├── test-csvs/                  # Edge-case fixtures
├── docs/decisions/             # ADRs
├── docker-compose.yml          # Local Postgres
├── render.yaml                 # One-click deploy
└── README.md
```

See [server/src/](server/src/) for the layered structure (config / db /
llm / mail / services / routes / middleware / lib / schemas).

---

## Submission

- **Repo:** (insert GitHub link)
- **Live URL:** (insert deployed URL)
- **Loom:** (insert link, 5-10 min)

The Loom walks: live demo of the working app → architecture and key
decisions (this README) → roadmap → one thing I'd do completely
differently.
