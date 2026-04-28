# ADR 01 — CSV storage shape

**Decision:** Store parsed rows as JSONB in a single `DatasetRow` table, with
values cast to their inferred type at upload time.

## Context

The brief asks how uploaded CSV data should be persisted: raw file, parsed
rows, aggregated results, or some combination. The right answer depends on
query patterns and scale.

## Options considered

1. **Raw file (S3/disk)** — every chart re-parses the CSV. Cheap to write,
   expensive on every read. Prevents push-down of aggregations to the DB.
2. **Pre-aggregated results** — fastest queries, but locks the user into the
   exact aggregations the developer pre-computed. Doesn't support an
   ad-hoc chart builder.
3. **Per-dataset dynamic table** (the "real Mixpanel" approach) — generate a
   table per upload with proper typed columns and indexes. Best long-term
   query performance, but DDL on every upload pollutes the catalog,
   per-tenant safety needs careful handling, and migration tooling for a
   4-day build is overkill.
4. **Three typed columns** (`numeric`, `text`, `date`) on a single row table
   — gets you typed storage but query syntax stays awkward and you lose
   JSONB's flexibility. Worst of both worlds.
5. **JSONB rows + cast at upload** (chosen) — single table, flexible schema,
   typed values inside the JSON, aggregations via `(data->>'col')::numeric`.

## Why JSONB at this scale

- 50k-row cap means GROUP BY in Postgres is <100ms even with JSONB casts.
- One table means one set of indexes, one backup story, standard ORM tooling.
- Values are cast at upload, so query-time casts can't blow up on bad data —
  bad values are stored as `null` and recorded in `Dataset.parseErrors` for UI
  transparency.
- Schema changes (replace-data flow) are trivial — JSONB doesn't care.

## Migration path if scale demands

If a dataset ever exceeds ~1M rows or we add cross-dataset analytics:
- Move that dataset to a per-dataset typed table generated from `columnsMeta`.
- One-line migration: `INSERT INTO dataset_<id> SELECT ... FROM DatasetRow`.
- Or embed DuckDB for columnar OLAP on the same JSON.

The chosen design doesn't paint us into a corner — it picks the simpler tool
while the cost is low and keeps the door open.
