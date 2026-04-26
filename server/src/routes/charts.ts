import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { ChartService } from '@services/chartService';
import type { AggregationService } from '@services/aggregationService';
import { ChartCreateSchema, ChartUpdateSchema, AggregationEnum, ChartTypeEnum } from '@schemas/chart';

export function createChartsRouter(input: {
  chartService: ChartService;
  aggregationService: AggregationService;
  requireAuth: RequestHandler;
}): Router {
  const { chartService, aggregationService, requireAuth } = input;
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res, next) => {
    try {
      const charts = await chartService.list(req.userId!);
      res.json({ charts });
    } catch (err) {
      next(err);
    }
  });

  const PreviewSchema = z.object({
    datasetId: z.string().min(1),
    type: ChartTypeEnum,
    xColumn: z.string().min(1),
    yColumn: z.string().min(1).nullable(),
    aggregation: AggregationEnum,
  });

  router.post('/preview', async (req, res, next) => {
    try {
      const body = PreviewSchema.parse(req.body);
      const buckets = await aggregationService.runSpec({
        userId: req.userId!,
        spec: {
          datasetId: body.datasetId,
          xColumn: body.xColumn,
          yColumn: body.yColumn,
          aggregation: body.aggregation,
          limit: 25,
        },
      });
      res.json({ buckets, type: body.type });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = ChartCreateSchema.parse(req.body);
      const chart = await chartService.create({ userId: req.userId!, data: body });
      res.status(201).json({ chart });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const chart = await chartService.get(req.params.id!, req.userId!);
      res.json({ chart });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const patch = ChartUpdateSchema.parse(req.body);
      const chart = await chartService.update(req.params.id!, req.userId!, patch);
      res.json({ chart });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await chartService.delete(req.params.id!, req.userId!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/data', async (req, res, next) => {
    try {
      const chart = await chartService.get(req.params.id!, req.userId!);
      const result = await aggregationService.runForChart({ chart, userId: req.userId! });
      res.json({ chart, ...result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
