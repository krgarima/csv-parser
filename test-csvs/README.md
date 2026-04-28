# Test CSVs

Edge-case fixtures used to verify the CSV ingestion pipeline. Each file is paired
with a one-line note describing the expected behaviour.

| File | Tests |
|---|---|
| `bom.csv` | UTF-8 BOM at file start should be stripped silently. |
| `quoted-newlines.csv` | Quoted fields with embedded commas and newlines. |
| `mixed-types.csv` | Numeric column with one bad row: bad cell becomes null + parseError. |
| `dupe-headers.csv` | Two columns named `value` → second is renamed to `value_2`. |
| `empty-headers.csv` | Header with empty cells → renamed to `column_N`. |
| `empty.csv` | Zero bytes → upload rejected with a clear error. |
| `no-data.csv` | Headers but no data rows → upload rejected. |
| `dates.csv` | Mix of date formats: ISO 8601 + `YYYY-MM-DD` + `MM/DD/YYYY`. |
| `prompt-injection.csv` | Cell content tries to "escape" the AI prompt; the AI must not leak it. |

To use: drag any of these into the upload card on the dashboard while logged in.
