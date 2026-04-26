import type {
  ColumnMeta,
  DatasetRepository,
  DatasetSummary,
  TypedRow,
} from '@db/repositories/datasetRepo';
import type { CsvService } from './csvService';
import { NotFoundError } from '@lib/errors';

export interface DatasetService {
  ingestUpload(input: {
    userId: string;
    name: string;
    originalFilename: string;
    fileBuffer: Buffer;
  }): Promise<DatasetSummary>;
  list(userId: string): Promise<DatasetSummary[]>;
  get(id: string, userId: string): Promise<DatasetSummary>;
  delete(id: string, userId: string): Promise<void>;
  getRowsPage(input: {
    datasetId: string;
    userId: string;
    page: number;
    pageSize: number;
  }): Promise<{ rows: TypedRow[]; total: number; columnsMeta: ColumnMeta[] }>;
  replaceData(input: {
    datasetId: string;
    userId: string;
    fileBuffer: Buffer;
    originalFilename: string;
  }): Promise<{ dataset: DatasetSummary; schemaChanged: boolean }>;
}

export function createDatasetService(input: {
  datasetRepo: DatasetRepository;
  csvService: CsvService;
}): DatasetService {
  const { datasetRepo, csvService } = input;

  function schemaChanged(oldCols: ColumnMeta[], newCols: ColumnMeta[]): boolean {
    if (oldCols.length !== newCols.length) return true;
    for (let i = 0; i < oldCols.length; i++) {
      if (oldCols[i]!.name !== newCols[i]!.name) return true;
      if (oldCols[i]!.type !== newCols[i]!.type) return true;
    }
    return false;
  }

  return {
    async ingestUpload(input) {
      const parsed = await csvService.parseBuffer(input.fileBuffer);
      const dataset = await datasetRepo.create({
        userId: input.userId,
        name: input.name,
        originalFilename: input.originalFilename,
        rowCount: parsed.rowCount,
        columnsMeta: parsed.columnsMeta,
        parseErrors: parsed.parseErrors,
      });
      await datasetRepo.bulkInsertRows(dataset.id, parsed.rows);
      const summary = await datasetRepo.findById(dataset.id, input.userId);
      if (!summary) throw new NotFoundError('Dataset disappeared after creation');
      return summary;
    },

    async list(userId) {
      return datasetRepo.listByUser(userId);
    },

    async get(id, userId) {
      const ds = await datasetRepo.findById(id, userId);
      if (!ds) throw new NotFoundError('Dataset not found');
      return ds;
    },

    async delete(id, userId) {
      await datasetRepo.deleteById(id, userId);
    },

    async getRowsPage(input) {
      const ds = await datasetRepo.findById(input.datasetId, input.userId);
      if (!ds) throw new NotFoundError('Dataset not found');
      const offset = (input.page - 1) * input.pageSize;
      const result = await datasetRepo.getRowsPage({
        datasetId: input.datasetId,
        userId: input.userId,
        offset,
        limit: input.pageSize,
      });
      return { rows: result.rows, total: result.total, columnsMeta: ds.columnsMeta };
    },

    async replaceData(input) {
      const existing = await datasetRepo.findById(input.datasetId, input.userId);
      if (!existing) throw new NotFoundError('Dataset not found');
      const parsed = await csvService.parseBuffer(input.fileBuffer);
      const changed = schemaChanged(existing.columnsMeta, parsed.columnsMeta);
      const updated = await datasetRepo.replaceRows({
        datasetId: input.datasetId,
        userId: input.userId,
        newRows: parsed.rows,
        newColumnsMeta: parsed.columnsMeta,
        newRowCount: parsed.rowCount,
        newParseErrors: parsed.parseErrors,
      });
      return { dataset: updated, schemaChanged: changed };
    },
  };
}
