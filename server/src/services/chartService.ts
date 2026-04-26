import type { Chart } from '@prisma/client';
import type { Config } from '@config/env';
import type {
  ChartCreateInput,
  ChartRepository,
  ChartUpdateInput,
} from '@db/repositories/chartRepo';
import type { DatasetRepository } from '@db/repositories/datasetRepo';
import { ConflictError, NotFoundError, ValidationError } from '@lib/errors';

export interface ChartService {
  create(input: { userId: string; data: Omit<ChartCreateInput, 'userId' | 'position'> }): Promise<Chart>;
  list(userId: string): Promise<Chart[]>;
  get(id: string, userId: string): Promise<Chart>;
  update(id: string, userId: string, patch: ChartUpdateInput): Promise<Chart>;
  delete(id: string, userId: string): Promise<void>;
}

export function createChartService(input: {
  config: Config;
  chartRepo: ChartRepository;
  datasetRepo: DatasetRepository;
}): ChartService {
  const { config, chartRepo, datasetRepo } = input;

  async function validateChartConfig(input: {
    userId: string;
    datasetId: string;
    xColumn: string;
    yColumn: string | null;
    aggregation: string;
  }): Promise<void> {
    const ds = await datasetRepo.findById(input.datasetId, input.userId);
    if (!ds) throw new ValidationError('Dataset not found');

    const xCol = ds.columnsMeta.find((c) => c.name === input.xColumn);
    if (!xCol) throw new ValidationError(`xColumn '${input.xColumn}' is not in this dataset`);

    if (input.aggregation === 'count') {
      // y not required
      return;
    }
    if (!input.yColumn) {
      throw new ValidationError(`yColumn is required for aggregation '${input.aggregation}'`);
    }
    const yCol = ds.columnsMeta.find((c) => c.name === input.yColumn);
    if (!yCol) throw new ValidationError(`yColumn '${input.yColumn}' is not in this dataset`);
    if (yCol.type !== 'number') {
      throw new ValidationError(`yColumn '${input.yColumn}' must be numeric for ${input.aggregation}`);
    }
  }

  return {
    async create(input) {
      const count = await chartRepo.countByUser(input.userId);
      if (count >= config.CHART_CAP_PER_USER) {
        throw new ConflictError(
          `Chart limit reached (${config.CHART_CAP_PER_USER}). Delete a chart to add another.`,
        );
      }
      await validateChartConfig({
        userId: input.userId,
        datasetId: input.data.datasetId,
        xColumn: input.data.xColumn,
        yColumn: input.data.yColumn,
        aggregation: input.data.aggregation,
      });
      return chartRepo.create({
        userId: input.userId,
        datasetId: input.data.datasetId,
        name: input.data.name,
        type: input.data.type,
        xColumn: input.data.xColumn,
        yColumn: input.data.yColumn,
        aggregation: input.data.aggregation,
        position: count,
      });
    },

    list(userId) {
      return chartRepo.listByUser(userId);
    },

    async get(id, userId) {
      const chart = await chartRepo.findById(id, userId);
      if (!chart) throw new NotFoundError('Chart not found');
      return chart;
    },

    async update(id, userId, patch) {
      const existing = await chartRepo.findById(id, userId);
      if (!existing) throw new NotFoundError('Chart not found');

      const next = {
        datasetId: existing.datasetId,
        xColumn: patch.xColumn ?? existing.xColumn,
        yColumn: patch.yColumn !== undefined ? patch.yColumn : existing.yColumn,
        aggregation: patch.aggregation ?? existing.aggregation,
      };
      await validateChartConfig({ userId, ...next });
      const updated = await chartRepo.update(id, userId, patch);
      if (!updated) throw new NotFoundError('Chart not found');
      return updated;
    },

    async delete(id, userId) {
      await chartRepo.delete(id, userId);
    },
  };
}
