import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AIService } from '@services/aiService';
import type { AggregationService } from '@services/aggregationService';
import { AskQuestionSchema, ExplainChartSchema, SuggestQuestionsSchema } from '@schemas/ai';
import { aiLimiter } from '@middleware/rateLimit';

export function createAIRouter(input: {
  aiService: AIService;
  aggregationService: AggregationService;
  requireAuth: RequestHandler;
}): Router {
  const { aiService, aggregationService, requireAuth } = input;
  const router = Router();
  router.use(requireAuth);
  router.use(aiLimiter);

  router.post('/ask', async (req, res, next) => {
    try {
      const body = AskQuestionSchema.parse(req.body);
      const spec = await aiService.askForSpec({
        userId: req.userId!,
        datasetId: body.datasetId,
        question: body.question,
      });
      // Run the aggregation right away so the client gets data + spec in one response.
      const buckets = await aggregationService.runSpec({
        userId: req.userId!,
        spec: {
          datasetId: body.datasetId,
          xColumn: spec.xColumn,
          yColumn: spec.yColumn,
          aggregation: spec.aggregation,
          limit: 25,
        },
      });
      res.json({ spec, buckets });
    } catch (err) {
      next(err);
    }
  });

  router.post('/explain', async (req, res, next) => {
    try {
      const body = ExplainChartSchema.parse(req.body);
      const explanation = await aiService.explainChart({
        userId: req.userId!,
        chartId: body.chartId,
      });
      res.json({ explanation });
    } catch (err) {
      next(err);
    }
  });

  router.post('/suggest', async (req, res, next) => {
    try {
      const body = SuggestQuestionsSchema.parse(req.body);
      const result = await aiService.suggestQuestions({
        userId: req.userId!,
        datasetId: body.datasetId,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
