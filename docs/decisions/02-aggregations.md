# ADR 02 — Where aggregations run

**Decision:** Compute aggregations in Postgres via SQL, behind the
`DatasetRepository.aggregate(spec)` interface.

## Context

Charts need GROUP BY-style operations on the user's data. We can run them in
the application or in the database.

## Options considered

1. **App-side aggregation** — pull all rows, group in JS. Simple but burns
   memory and network for any non-trivial dataset. Effectively dead at 50k
   rows.
2. **DB-side via Prisma's typed query API** — limited expressiveness for
   JSONB `->>` casts; would force per-aggregation method bloat.
3. **DB-side via parameterized raw SQL** (chosen) — `(data->>'col')::numeric`
   + GROUP BY runs in <50ms on 50k rows in Neon free tier.

## How it stays safe

- The service builds an `AggregationSpec` (pure domain object).
- Column names are **validated against the dataset's `columnsMeta` allowlist**
  before SQL construction. Anything not in the list throws.
- Column names are passed as parameters to Postgres' `->>` operator (`data->>$1`),
  so injection through the column name is impossible at the SQL layer too.
- Every query joins on `userId`, enforced by repository method signatures.

## Caching

Aggregation results are pure functions of `(datasetId, configHash)`. We cache
in memory (LRU) and persist for AI insights via the `Insight` table. The
"Explain this chart" flow reads aggregated buckets from the same path, so
the cache hit rate compounds.

## Future-friendly

Same `AggregationSpec` could route to:
- A read-replica for heavy traffic.
- DuckDB for analytical workloads on huge datasets.
- A column store (Clickhouse) without changing service code.

The `DatasetRepository` interface is the swap point.
