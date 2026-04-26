import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Config } from '@config/env';
import type { DatasetService } from '@services/datasetService';
import type { RequestHandler } from 'express';
import { uploadLimiter } from '@middleware/rateLimit';
import { ValidationError } from '@lib/errors';

export function createDatasetsRouter(input: {
  config: Config;
  datasetService: DatasetService;
  requireAuth: RequestHandler;
}): Router {
  const { config, datasetService, requireAuth } = input;
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.MAX_UPLOAD_BYTES },
  });

  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const list = await datasetService.list(req.userId!);
      res.json({ datasets: list });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', uploadLimiter, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw new ValidationError('No file uploaded (expected field "file")');
      const name = (req.body?.name as string | undefined)?.trim() || req.file.originalname;
      const summary = await datasetService.ingestUpload({
        userId: req.userId!,
        name,
        originalFilename: req.file.originalname,
        fileBuffer: req.file.buffer,
      });
      res.status(201).json({ dataset: summary });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const ds = await datasetService.get(req.params.id!, req.userId!);
      res.json({ dataset: ds });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await datasetService.delete(req.params.id!, req.userId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  const RowsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  });

  router.get('/:id/rows', async (req, res, next) => {
    try {
      const { page, pageSize } = RowsQuerySchema.parse(req.query);
      const result = await datasetService.getRowsPage({
        datasetId: req.params.id!,
        userId: req.userId!,
        page,
        pageSize,
      });
      res.json({ ...result, page, pageSize });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id/data', uploadLimiter, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw new ValidationError('No file uploaded (expected field "file")');
      const result = await datasetService.replaceData({
        datasetId: req.params.id!,
        userId: req.userId!,
        fileBuffer: req.file.buffer,
        originalFilename: req.file.originalname,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
