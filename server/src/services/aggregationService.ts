import type { Chart } from '@prisma/client';
import type {
  AggregationBucket,
  AggregationSpec,
  ColumnMeta,
  DatasetRepository,
} from '@db/repositories/datasetRepo';
import { ValidationError } from '@lib/errors';

export interface AggregationService {
  runForChart(input: { chart: Chart; userId: string }): Promise<{
    buckets: AggregationBucket[];
    columnsMeta: ColumnMeta[];
  }>;
  runSpec(input: { spec: AggregationSpec; userId: string }): Promise<AggregationBucket[]>;
}

const TOP_N_DEFAULT = 25;

function sortByXType(buckets: AggregationBucket[], xType: 'number' | 'date' | 'text'): AggregationBucket[] {
  if (xType === 'date' || xType === 'number') {
    // Sort ascending by x for time/numeric series so charts render naturally.
    return [...buckets].sort((a, b) => {
      const av = a.x ?? '';
      const bv = b.x ?? '';
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
  }
  return buckets; // text: keep order from query (DESC by y)
}

export function createAggregationService(input: {
  datasetRepo: DatasetRepository;
}): AggregationService {
  const { datasetRepo } = input;

  return {
    async runSpec(input) {
      const buckets = await datasetRepo.aggregate({ spec: input.spec, userId: input.userId });
      return buckets;
    },

    async runForChart(input) {
      const { chart, userId } = input;
      const ds = await datasetRepo.findById(chart.datasetId, userId);
      if (!ds) throw new ValidationError('Dataset not found');
      const xCol = ds.columnsMeta.find((c) => c.name === chart.xColumn);
      if (!xCol) throw new ValidationError(`xColumn '${chart.xColumn}' missing from dataset`);

      const spec: AggregationSpec = {
        datasetId: chart.datasetId,
        xColumn: chart.xColumn,
        yColumn: chart.yColumn,
        aggregation: chart.aggregation as AggregationSpec['aggregation'],
        limit: TOP_N_DEFAULT,
      };

      const raw = await datasetRepo.aggregate({ spec, userId });
      const buckets = sortByXType(raw, xCol.type);
      return { buckets, columnsMeta: ds.columnsMeta };
    },
  };
}
