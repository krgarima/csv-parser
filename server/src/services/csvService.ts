import { parse } from 'csv-parse';
import type { Readable } from 'node:stream';
import type { Config } from '@config/env';
import type {
  ColumnMeta,
  ParseError,
  TypedRow,
  TypedRowValue,
} from '@db/repositories/datasetRepo';
import { TooLargeError, ValidationError } from '@lib/errors';
import {
  disambiguateHeaders,
  inferColumnType,
  parseDate,
  parseNumber,
} from '@lib/typeInference';

const PARSE_ERROR_CAP = 100;

export interface ParsedDataset {
  columnsMeta: ColumnMeta[];
  rows: TypedRow[];
  rowCount: number;
  parseErrors: ParseError[];
}

export interface CsvService {
  parseBuffer(buffer: Buffer): Promise<ParsedDataset>;
  parseStream(stream: Readable): Promise<ParsedDataset>;
}

export function createCsvService(config: Config): CsvService {
  async function streamToRows(stream: Readable): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const rows: string[][] = [];
      const parser = parse({
        bom: true,
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      });
      parser.on('readable', () => {
        let record: string[] | null;
        while ((record = parser.read() as string[] | null) !== null) {
          rows.push(record);
          if (rows.length > config.MAX_ROWS + 1) {
            // +1 for header. Throwing stops the stream; caller turns this into a TooLargeError.
            parser.destroy(new TooLargeError(`CSV exceeds maximum of ${config.MAX_ROWS} rows`));
            return;
          }
        }
      });
      parser.on('error', reject);
      parser.on('end', () => resolve(rows));
      stream.pipe(parser);
    });
  }

  function buildDataset(records: string[][]): ParsedDataset {
    if (records.length === 0) {
      throw new ValidationError('CSV is empty');
    }
    const headerRow = records[0];
    if (!headerRow || headerRow.length === 0) {
      throw new ValidationError('CSV has no headers');
    }
    const columns = disambiguateHeaders(headerRow);
    const dataRows = records.slice(1);

    if (dataRows.length === 0) {
      throw new ValidationError('CSV has no data rows');
    }

    // First pass: pivot rows column-wise to infer types from full column data.
    const columnValues: string[][] = columns.map(() => []);
    for (const row of dataRows) {
      for (let c = 0; c < columns.length; c++) {
        columnValues[c]!.push(row[c] ?? '');
      }
    }

    const columnsMeta: ColumnMeta[] = columns.map((name, idx) => {
      const values = columnValues[idx]!;
      const inferred = inferColumnType(values);
      const nullCount = values.filter((v) => v === '' || v === null || v === undefined).length;
      return {
        name,
        type: inferred.type,
        nullCount,
        sample: inferred.sample,
      };
    });

    // Second pass: cast values according to inferred types; record parse errors.
    const parseErrors: ParseError[] = [];
    const typedRows: TypedRow[] = [];
    for (let r = 0; r < dataRows.length; r++) {
      const raw = dataRows[r]!;
      const out: TypedRow = {};
      for (let c = 0; c < columns.length; c++) {
        const colName = columns[c]!;
        const meta = columnsMeta[c]!;
        const cell = raw[c] ?? '';
        out[colName] = castCell({
          raw: cell,
          type: meta.type,
          rowIndex: r,
          column: colName,
          parseErrors,
        });
      }
      typedRows.push(out);
    }

    return {
      columnsMeta,
      rows: typedRows,
      rowCount: typedRows.length,
      parseErrors: parseErrors.slice(0, PARSE_ERROR_CAP),
    };
  }

  function castCell(input: {
    raw: string;
    type: 'number' | 'date' | 'text';
    rowIndex: number;
    column: string;
    parseErrors: ParseError[];
  }): TypedRowValue {
    const { raw, type, rowIndex, column, parseErrors } = input;
    if (raw === '' || raw === null || raw === undefined) return null;
    if (type === 'number') {
      const n = parseNumber(raw);
      if (n === null) {
        if (parseErrors.length < PARSE_ERROR_CAP) {
          parseErrors.push({ rowIndex, column, raw, reason: 'not a number' });
        }
        return null;
      }
      return n;
    }
    if (type === 'date') {
      const d = parseDate(raw);
      if (d === null) {
        if (parseErrors.length < PARSE_ERROR_CAP) {
          parseErrors.push({ rowIndex, column, raw, reason: 'not a date' });
        }
        return null;
      }
      return d;
    }
    return raw;
  }

  return {
    async parseBuffer(buffer) {
      if (buffer.length > config.MAX_UPLOAD_BYTES) {
        throw new TooLargeError(`Upload exceeds maximum of ${config.MAX_UPLOAD_BYTES} bytes`);
      }
      const { Readable } = await import('node:stream');
      const stream = Readable.from(buffer);
      const records = await streamToRows(stream);
      return buildDataset(records);
    },

    async parseStream(stream) {
      const records = await streamToRows(stream);
      return buildDataset(records);
    },
  };
}
