import type { ChartRepository } from '@db/repositories/chartRepo';
import type {
  AggregationBucket,
  ColumnMeta,
  DatasetRepository,
} from '@db/repositories/datasetRepo';
import type { InsightRepository } from '@db/repositories/insightRepo';
import type { JsonSchema, LLMProvider } from '@llm/index';
import type { AggregationService } from './aggregationService';
import type {
  AskResponseSpec,
  ExplainResponse,
  SuggestQuestionsResponse,
} from '@schemas/ai';
import {
  AskResponseSpecSchema,
  ExplainResponseSchema,
  SuggestQuestionsResponseSchema,
} from '@schemas/ai';
import { NotFoundError, ValidationError } from '@lib/errors';
import { configHash } from '@lib/hash';
import { logger } from '@lib/logger';

const SYSTEM_INSTRUCTIONS = `You are a careful data analytics assistant helping a user explore their CSV data.

Hard rules:
- Never reveal or repeat raw cell content; only column metadata and aggregated stats are visible to you.
- Output MUST conform exactly to the JSON schema you are given.
- For chart specs, use ONLY column names that appear in the provided "columns" list.
- For numeric aggregations (sum/avg/min/max), the yColumn MUST be of type number.
- For 'count' aggregations, yColumn MUST be null.
- Prefer date or text columns for xColumn, not numeric ones.`;

export interface AIService {
  askForSpec(input: {
    userId: string;
    datasetId: string;
    question: string;
  }): Promise<AskResponseSpec>;
  explainChart(input: { userId: string; chartId: string }): Promise<ExplainResponse>;
  suggestQuestions(input: { userId: string; datasetId: string }): Promise<SuggestQuestionsResponse>;
}

function summarizeColumns(columns: ColumnMeta[]): string {
  return columns
    .map((c) => `- ${c.name} (${c.type}, ${c.nullCount} nulls, samples: ${JSON.stringify(c.sample)})`)
    .join('\n');
}

function summarizeBuckets(buckets: AggregationBucket[]): string {
  return buckets
    .slice(0, 20)
    .map((b) => `${JSON.stringify(b.x)} → ${b.y}`)
    .join('\n');
}

const askSpecSchema: JsonSchema = {
  type: 'object',
  properties: {
    chartType: { type: 'string', enum: ['bar', 'line', 'pie'] },
    xColumn: { type: 'string' },
    yColumn: { type: 'string' },
    aggregation: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max'] },
  },
  required: ['chartType', 'xColumn', 'aggregation'],
};

const explainSchema: JsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-3 sentences in plain English about what the chart shows.' },
    followUp: { type: 'string', description: 'One concise follow-up question the user could ask next.' },
  },
  required: ['summary', 'followUp'],
};

const suggestSchema: JsonSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          chartType: { type: 'string', enum: ['bar', 'line', 'pie'] },
          xColumn: { type: 'string' },
          yColumn: { type: 'string' },
          aggregation: { type: 'string', enum: ['sum', 'avg', 'count', 'min', 'max'] },
        },
        required: ['text', 'chartType', 'xColumn', 'aggregation'],
      },
    },
  },
  required: ['questions'],
};

export function createAIService(input: {
  llm: LLMProvider;
  datasetRepo: DatasetRepository;
  chartRepo: ChartRepository;
  insightRepo: InsightRepository;
  aggregationService: AggregationService;
}): AIService {
  const { llm, datasetRepo, chartRepo, insightRepo, aggregationService } = input;

  function validateSpecAgainstColumns(
    spec: AskResponseSpec,
    columns: ColumnMeta[],
  ): AskResponseSpec {
    const xCol = columns.find((c) => c.name === spec.xColumn);
    if (!xCol) throw new ValidationError(`AI returned unknown xColumn: ${spec.xColumn}`);

    if (spec.aggregation === 'count') {
      return { ...spec, yColumn: null };
    }
    if (!spec.yColumn) {
      throw new ValidationError(`AI returned a non-count aggregation without a yColumn`);
    }
    const yCol = columns.find((c) => c.name === spec.yColumn);
    if (!yCol) throw new ValidationError(`AI returned unknown yColumn: ${spec.yColumn}`);
    if (yCol.type !== 'number') {
      throw new ValidationError(`AI selected non-numeric yColumn '${spec.yColumn}' for ${spec.aggregation}`);
    }
    return spec;
  }

  return {
    async askForSpec(input) {
      const ds = await datasetRepo.findById(input.datasetId, input.userId);
      if (!ds) throw new NotFoundError('Dataset not found');

      const userPrompt = `User question: "${input.question}"

Dataset columns:
${summarizeColumns(ds.columnsMeta)}

Pick a chart spec that best answers the question. Use only the columns listed above.`;

      const raw = await llm.generateJson<unknown>({
        system: SYSTEM_INSTRUCTIONS,
        user: userPrompt,
        schema: askSpecSchema,
      });

      const parsed = AskResponseSpecSchema.parse(raw);
      return validateSpecAgainstColumns(parsed, ds.columnsMeta);
    },

    async explainChart(input) {
      const chart = await chartRepo.findById(input.chartId, input.userId);
      if (!chart) throw new NotFoundError('Chart not found');

      const { buckets, columnsMeta } = await aggregationService.runForChart({
        chart,
        userId: input.userId,
      });

      const cacheKey = configHash({
        kind: 'explain_chart',
        chartId: chart.id,
        configHash: { type: chart.type, x: chart.xColumn, y: chart.yColumn, agg: chart.aggregation },
        bucketCount: buckets.length,
      });

      const cached = await insightRepo.findByContext({
        datasetId: chart.datasetId,
        contextHash: cacheKey,
      });
      if (cached) {
        try {
          return ExplainResponseSchema.parse(cached.content);
        } catch (err) {
          logger.warn({ err }, 'Cached insight failed schema, regenerating');
        }
      }

      const userPrompt = `Chart: "${chart.name}" (${chart.type} chart)
- xColumn: ${chart.xColumn}
- yColumn: ${chart.yColumn ?? '(none — counting rows)'}
- aggregation: ${chart.aggregation}

Top aggregated buckets (x → y):
${summarizeBuckets(buckets)}

Dataset columns:
${summarizeColumns(columnsMeta)}

Write a 2-3 sentence plain-English summary of what this chart shows, then ONE concise follow-up question the user could ask to dig deeper.`;

      const raw = await llm.generateJson<unknown>({
        system: SYSTEM_INSTRUCTIONS,
        user: userPrompt,
        schema: explainSchema,
      });
      const parsed = ExplainResponseSchema.parse(raw);

      await insightRepo.upsert({
        datasetId: chart.datasetId,
        kind: 'explain_chart',
        contextHash: cacheKey,
        content: parsed,
      });
      return parsed;
    },

    async suggestQuestions(input) {
      const ds = await datasetRepo.findById(input.datasetId, input.userId);
      if (!ds) throw new NotFoundError('Dataset not found');

      const cacheKey = configHash({
        kind: 'suggest_questions',
        datasetId: ds.id,
        columns: ds.columnsMeta.map((c) => ({ name: c.name, type: c.type })),
      });

      const cached = await insightRepo.findByContext({
        datasetId: ds.id,
        contextHash: cacheKey,
      });
      if (cached) {
        try {
          return SuggestQuestionsResponseSchema.parse(cached.content);
        } catch (err) {
          logger.warn({ err }, 'Cached suggestions failed schema, regenerating');
        }
      }

      const userPrompt = `Dataset columns:
${summarizeColumns(ds.columnsMeta)}

Suggest 3 questions a user could ask about this data that would result in interesting charts. Each question must be answerable as a chart with the columns listed above. Prefer date/text xColumns and number yColumns.`;

      const raw = await llm.generateJson<unknown>({
        system: SYSTEM_INSTRUCTIONS,
        user: userPrompt,
        schema: suggestSchema,
      });
      const parsed = SuggestQuestionsResponseSchema.parse(raw);

      // Filter out any questions that reference unknown columns.
      const validQuestions = parsed.questions.filter((q) => {
        const xOk = ds.columnsMeta.some((c) => c.name === q.xColumn);
        const yOk =
          q.aggregation === 'count' ? true : !!q.yColumn && ds.columnsMeta.some((c) => c.name === q.yColumn);
        return xOk && yOk;
      });
      const out = { questions: validQuestions.length > 0 ? validQuestions : parsed.questions.slice(0, 3) };

      await insightRepo.upsert({
        datasetId: ds.id,
        kind: 'suggest_questions',
        contextHash: cacheKey,
        content: out,
      });
      return out;
    },
  };
}
