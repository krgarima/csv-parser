import type { PrismaClient, Chart } from '@prisma/client';
import type { AggregationFn } from './datasetRepo';

export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartCreateInput {
  userId: string;
  datasetId: string;
  name: string;
  type: ChartType;
  xColumn: string;
  yColumn: string | null;
  aggregation: AggregationFn;
  position: number;
}

export interface ChartUpdateInput {
  name?: string;
  type?: ChartType;
  xColumn?: string;
  yColumn?: string | null;
  aggregation?: AggregationFn;
  position?: number;
}

export interface ChartRepository {
  create(input: ChartCreateInput): Promise<Chart>;
  findById(id: string, userId: string): Promise<Chart | null>;
  listByUser(userId: string): Promise<Chart[]>;
  countByUser(userId: string): Promise<number>;
  update(id: string, userId: string, patch: ChartUpdateInput): Promise<Chart | null>;
  delete(id: string, userId: string): Promise<void>;
}

export class PrismaChartRepository implements ChartRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: ChartCreateInput): Promise<Chart> {
    return this.prisma.chart.create({ data: input });
  }

  findById(id: string, userId: string): Promise<Chart | null> {
    return this.prisma.chart.findFirst({ where: { id, userId } });
  }

  listByUser(userId: string): Promise<Chart[]> {
    return this.prisma.chart.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    });
  }

  countByUser(userId: string): Promise<number> {
    return this.prisma.chart.count({ where: { userId } });
  }

  async update(id: string, userId: string, patch: ChartUpdateInput): Promise<Chart | null> {
    const existing = await this.prisma.chart.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) return null;
    return this.prisma.chart.update({ where: { id }, data: patch });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.chart.deleteMany({ where: { id, userId } });
  }
}
