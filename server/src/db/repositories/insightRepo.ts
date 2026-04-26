import type { PrismaClient, Insight, Prisma } from '@prisma/client';

export type InsightKind = 'explain_chart' | 'ask_spec' | 'suggest_questions';

export interface InsightRepository {
  findByContext(input: { datasetId: string; contextHash: string }): Promise<Insight | null>;
  upsert(input: {
    datasetId: string;
    kind: InsightKind;
    contextHash: string;
    content: unknown;
  }): Promise<Insight>;
}

export class PrismaInsightRepository implements InsightRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByContext(input: { datasetId: string; contextHash: string }): Promise<Insight | null> {
    return this.prisma.insight.findFirst({
      where: { datasetId: input.datasetId, contextHash: input.contextHash },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsert(input: {
    datasetId: string;
    kind: InsightKind;
    contextHash: string;
    content: unknown;
  }): Promise<Insight> {
    const existing = await this.findByContext({
      datasetId: input.datasetId,
      contextHash: input.contextHash,
    });
    if (existing) {
      return this.prisma.insight.update({
        where: { id: existing.id },
        data: { content: input.content as Prisma.InputJsonValue, kind: input.kind },
      });
    }
    return this.prisma.insight.create({
      data: {
        datasetId: input.datasetId,
        kind: input.kind,
        contextHash: input.contextHash,
        content: input.content as Prisma.InputJsonValue,
      },
    });
  }
}
