import type { PrismaClient, Dataset, Prisma } from '@prisma/client';
import { ValidationError } from '@lib/errors';

export type ColumnType = 'number' | 'date' | 'text';

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  nullCount: number;
  sample: unknown[];
}

export interface ParseError {
  rowIndex: number;
  column: string;
  raw: string;
  reason: string;
}

export type AggregationFn = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface AggregationSpec {
  datasetId: string;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
  limit?: number;
}

export interface AggregationBucket {
  x: string | number | null;
  y: number;
}

export interface DatasetSummary extends Omit<Dataset, 'columnsMeta' | 'parseErrors'> {
  columnsMeta: ColumnMeta[];
  parseErrors: ParseError[];
}

export type TypedRowValue = string | number | null;
export type TypedRow = Record<string, TypedRowValue>;

export interface DatasetRepository {
  create(input: {
    userId: string;
    name: string;
    originalFilename: string;
    rowCount: number;
    columnsMeta: ColumnMeta[];
    parseErrors: ParseError[];
  }): Promise<Dataset>;

  findById(id: string, userId: string): Promise<DatasetSummary | null>;
  listByUser(userId: string): Promise<DatasetSummary[]>;
  deleteById(id: string, userId: string): Promise<void>;

  bulkInsertRows(datasetId: string, rows: TypedRow[]): Promise<void>;
  replaceRows(input: {
    datasetId: string;
    userId: string;
    newRows: TypedRow[];
    newColumnsMeta: ColumnMeta[];
    newRowCount: number;
    newParseErrors: ParseError[];
  }): Promise<DatasetSummary>;

  getRowsPage(input: {
    datasetId: string;
    userId: string;
    offset: number;
    limit: number;
  }): Promise<{ rows: TypedRow[]; total: number }>;

  aggregate(input: { spec: AggregationSpec; userId: string }): Promise<AggregationBucket[]>;
}

export class PrismaDatasetRepository implements DatasetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    userId: string;
    name: string;
    originalFilename: string;
    rowCount: number;
    columnsMeta: ColumnMeta[];
    parseErrors: ParseError[];
  }): Promise<Dataset> {
    return this.prisma.dataset.create({
      data: {
        userId: input.userId,
        name: input.name,
        originalFilename: input.originalFilename,
        rowCount: input.rowCount,
        columnsMeta: input.columnsMeta as unknown as Prisma.InputJsonValue,
        parseErrors: input.parseErrors as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findById(id: string, userId: string): Promise<DatasetSummary | null> {
    const ds = await this.prisma.dataset.findFirst({ where: { id, userId } });
    return ds ? this.toSummary(ds) : null;
  }

  async listByUser(userId: string): Promise<DatasetSummary[]> {
    const list = await this.prisma.dataset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((d) => this.toSummary(d));
  }

  async deleteById(id: string, userId: string): Promise<void> {
    await this.prisma.dataset.deleteMany({ where: { id, userId } });
  }

  async bulkInsertRows(datasetId: string, rows: TypedRow[]): Promise<void> {
    if (rows.length === 0) return;
    const BATCH = 1000;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await this.prisma.datasetRow.createMany({
        data: slice.map((r) => ({
          datasetId,
          data: r as unknown as Prisma.InputJsonValue,
        })),
      });
    }
  }

  async replaceRows(input: {
    datasetId: string;
    userId: string;
    newRows: TypedRow[];
    newColumnsMeta: ColumnMeta[];
    newRowCount: number;
    newParseErrors: ParseError[];
  }): Promise<DatasetSummary> {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.dataset.findFirst({
        where: { id: input.datasetId, userId: input.userId },
        select: { id: true },
      });
      if (!owned) throw new ValidationError('Dataset not found');

      await tx.datasetRow.deleteMany({ where: { datasetId: input.datasetId } });

      const BATCH = 1000;
      for (let i = 0; i < input.newRows.length; i += BATCH) {
        const slice = input.newRows.slice(i, i + BATCH);
        await tx.datasetRow.createMany({
          data: slice.map((r) => ({
            datasetId: input.datasetId,
            data: r as unknown as Prisma.InputJsonValue,
          })),
        });
      }

      const updated = await tx.dataset.update({
        where: { id: input.datasetId },
        data: {
          columnsMeta: input.newColumnsMeta as unknown as Prisma.InputJsonValue,
          parseErrors: input.newParseErrors as unknown as Prisma.InputJsonValue,
          rowCount: input.newRowCount,
        },
      });
      return this.toSummary(updated);
    });
  }

  async getRowsPage(input: {
    datasetId: string;
    userId: string;
    offset: number;
    limit: number;
  }): Promise<{ rows: TypedRow[]; total: number }> {
    const ds = await this.prisma.dataset.findFirst({
      where: { id: input.datasetId, userId: input.userId },
      select: { id: true, rowCount: true },
    });
    if (!ds) return { rows: [], total: 0 };

    const rows = await this.prisma.datasetRow.findMany({
      where: { datasetId: input.datasetId },
      orderBy: { id: 'asc' },
      skip: input.offset,
      take: input.limit,
      select: { data: true },
    });
    return {
      rows: rows.map((r) => r.data as unknown as TypedRow),
      total: ds.rowCount,
    };
  }

  async aggregate(input: { spec: AggregationSpec; userId: string }): Promise<AggregationBucket[]> {
    const { spec, userId } = input;

    // Owner check + load columnsMeta for type detection
    const ds = await this.prisma.dataset.findFirst({
      where: { id: spec.datasetId, userId },
      select: { columnsMeta: true },
    });
    if (!ds) throw new ValidationError('Dataset not found');
    const columns = ds.columnsMeta as unknown as ColumnMeta[];

    // Allowlist check — column names MUST exist in columnsMeta
    const xCol = columns.find((c) => c.name === spec.xColumn);
    if (!xCol) throw new ValidationError(`Unknown xColumn: ${spec.xColumn}`);

    let yCol: ColumnMeta | undefined;
    if (spec.aggregation !== 'count') {
      if (!spec.yColumn) {
        throw new ValidationError(`yColumn is required for aggregation '${spec.aggregation}'`);
      }
      yCol = columns.find((c) => c.name === spec.yColumn);
      if (!yCol) throw new ValidationError(`Unknown yColumn: ${spec.yColumn}`);
      if (yCol.type !== 'number') {
        throw new ValidationError(`yColumn '${spec.yColumn}' must be numeric for ${spec.aggregation}`);
      }
    }

    const limit = Math.min(spec.limit ?? 1000, 1000);

    // Column names are bound as parameters to Postgres' JSONB `->>` operator,
    // so injection via column name is impossible at the SQL layer.
    // The allowlist check above (line ~ findIndex) is the upstream guard.
    const params: unknown[] = [spec.xColumn];
    let yExpr: string;
    if (spec.aggregation === 'count') {
      yExpr = 'COUNT(*)';
    } else {
      params.push(spec.yColumn);
      yExpr = `${spec.aggregation.toUpperCase()}((data->>$2)::numeric)`;
    }
    params.push(spec.datasetId);
    const datasetIdParam = `$${params.length}`;
    params.push(limit);
    const limitParam = `$${params.length}`;

    const sql = `
      SELECT data->>$1 AS x, ${yExpr} AS y
      FROM "DatasetRow"
      WHERE "datasetId" = ${datasetIdParam}
      GROUP BY x
      ORDER BY y DESC NULLS LAST
      LIMIT ${limitParam}
    `;

    type Row = { x: string | null; y: string | number | null };
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(sql, ...params);
    return rows.map((r) => ({
      x: r.x,
      y: r.y === null ? 0 : typeof r.y === 'string' ? Number(r.y) : r.y,
    }));
  }

  private toSummary(d: Dataset): DatasetSummary {
    return {
      ...d,
      columnsMeta: d.columnsMeta as unknown as ColumnMeta[],
      parseErrors: d.parseErrors as unknown as ParseError[],
    };
  }
}
