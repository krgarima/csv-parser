# ADR 04 — 50,000-row behaviour

**Decision:** Stream-parse, batch-insert, hard-cap at 50k rows or 10MB.

## Context

What does the system do with a 50k-row CSV? The brief asks; the answer
shapes how we read, store, and aggregate.

## How it works today

1. **Streaming parse** via `csv-parse` — never holds the full file as a
   parsed object in memory. The parser is fed straight off the request body.
2. **Two-pass type inference** — first pass collects raw column values to
   infer types (number / date / text); second pass casts cells per the
   inferred type and records any failures into `Dataset.parseErrors` (capped
   at 100 entries to avoid bloat).
3. **Batched insert** — rows are bulk-inserted in batches of 1,000 via
   parameterized SQL (`prisma.datasetRow.createMany`). Avoids round-trips and
   keeps memory bounded.
4. **Hard cap** — the parser destroys the stream if more than 50,000 rows
   are seen, returning a clear "exceeds maximum" error. The HTTP layer also
   enforces a 10 MB body cap via Multer.

## Behaviour at the cap

- 50,000 rows: succeeds, ~1-3 seconds end-to-end on Neon free tier.
- 50,001 rows: rejected with `PAYLOAD_TOO_LARGE`, no partial state.
- 10 MB exceeded: rejected at the HTTP layer.
- High-cardinality groupings on chart endpoints: top-N (1000 max) returned;
  beyond that we'd add an "Other" bucket (not implemented; flagged in
  roadmap).

## Trade-offs

- We don't pretend to handle 200 MB or 1 M rows. The honest answer is "use a
  background worker + columnar store" — out of scope for this build, called
  out in the roadmap.
- The 100-row parse-error cap loses some information for very dirty inputs.
  Worth it to avoid storing megabytes of error blobs.

## Future expansion

Move uploads to a job queue (BullMQ + Redis) so HTTP doesn't hold the
connection open during parse. Dataset gets a `processing` status the UI
polls. The interface (`csvService`) stays the same; only the route layer
changes.
