# ADR 03 — Second upload behaviour

**Decision:** Each upload creates a new `Dataset`. To overwrite, the user
explicitly clicks "Replace data" on a dataset card.

## Context

What happens when a user uploads a second CSV? The brief calls this out as
an open decision. Three obvious options:

1. **Silent append** — add rows to the existing dataset. Risks schema drift
   (columns differ between uploads), introduces silent duplicates, and
   surprises the user.
2. **Silent replace** — overwrite the existing dataset. Destructive, loses
   history, equally surprising.
3. **Explicit, per-upload choice** (chosen) — each upload is a new dataset
   by default. A dataset can be replaced explicitly via a "Replace data"
   button on its card.

## Why this is the right answer

- Each upload getting its own dataset preserves history and avoids
  accidental destruction.
- Charts bind to a `datasetId`. The "Replace data" action keeps the same id,
  so existing charts continue to render against the new data automatically.
- If the column schema changes during a replace, the UI surfaces a warning so
  the user knows their charts may need updating.
- The user — not the developer — decides whether they want a new dataset or
  to update an existing one. The product gets out of the way.

## Trade-off accepted

Slightly more clicks vs. silent append/replace. Worth it for the safety.
