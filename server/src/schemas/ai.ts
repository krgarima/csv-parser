import { z } from 'zod';
import { AggregationEnum, ChartTypeEnum } from './chart';

export const AskQuestionSchema = z.object({
  datasetId: z.string().min(1),
  question: z.string().min(1).max(500),
});
export type AskQuestionInput = z.infer<typeof AskQuestionSchema>;

export const AskResponseSpecSchema = z.object({
  chartType: ChartTypeEnum,
  xColumn: z.string().min(1),
  yColumn: z.string().min(1).nullable(),
  aggregation: AggregationEnum,
});
export type AskResponseSpec = z.infer<typeof AskResponseSpecSchema>;

export const ExplainChartSchema = z.object({
  chartId: z.string().min(1),
});
export type ExplainChartInput = z.infer<typeof ExplainChartSchema>;

export const ExplainResponseSchema = z.object({
  summary: z.string().min(1),
  followUp: z.string().min(1),
});
export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;

export const SuggestQuestionsSchema = z.object({
  datasetId: z.string().min(1),
});
export type SuggestQuestionsInput = z.infer<typeof SuggestQuestionsSchema>;

export const SuggestedQuestionSchema = z.object({
  text: z.string().min(1),
  chartType: ChartTypeEnum,
  xColumn: z.string().min(1),
  yColumn: z.string().min(1).nullable(),
  aggregation: AggregationEnum,
});
export const SuggestQuestionsResponseSchema = z.object({
  questions: z.array(SuggestedQuestionSchema).min(1).max(5),
});
export type SuggestedQuestion = z.infer<typeof SuggestedQuestionSchema>;
export type SuggestQuestionsResponse = z.infer<typeof SuggestQuestionsResponseSchema>;
