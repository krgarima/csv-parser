import type { ColumnType } from '@db/repositories/datasetRepo';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASH_MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const SLASH_DMY = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

export function parseNumber(raw: string): number | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  // Strip thousands separators, currency symbols, percent signs
  const cleaned = raw.replace(/[,_$€£¥]/g, '').replace(/%$/, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseDate(raw: string): string | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (ISO_DATE.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  let m = trimmed.match(SLASH_MDY);
  if (m) {
    const [, mm, dd, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  m = trimmed.match(SLASH_DMY);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export interface TypeInferenceResult {
  type: ColumnType;
  sample: unknown[];
}

export function inferColumnType(values: string[]): TypeInferenceResult {
  const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return { type: 'text', sample: [] };

  const sample = nonEmpty.slice(0, 5);

  let allNumbers = true;
  let allDates = true;
  for (const v of nonEmpty) {
    if (allNumbers && parseNumber(v) === null) allNumbers = false;
    if (allDates && parseDate(v) === null) allDates = false;
    if (!allNumbers && !allDates) break;
  }

  if (allNumbers) return { type: 'number', sample };
  if (allDates) return { type: 'date', sample };
  return { type: 'text', sample };
}

export function disambiguateHeaders(raw: string[]): string[] {
  const used = new Map<string, number>();
  return raw.map((h, idx) => {
    let name = h.trim();
    if (name === '') name = `column_${idx + 1}`;
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    return seen === 0 ? name : `${name}_${seen + 1}`;
  });
}
