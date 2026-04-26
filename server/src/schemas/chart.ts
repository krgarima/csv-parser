import { z } from 'zod';

export const ChartTypeEnum = z.enum(['bar', 'line', 'pie']);
export type ChartType = z.infer<typeof ChartTypeEnum>;

export const AggregationEnum = z.enum(['sum', 'avg', 'count', 'min', 'max']);
export type AggregationFn = z.infer<typeof AggregationEnum>;

export const ChartCreateSchema = z
  .object({
    datasetId: z.string().min(1),
    name: z.string().min(1).max(120),
    type: ChartTypeEnum,
    xColumn: z.string().min(1).max(200),
    yColumn: z.string().min(1).max(200).nullable(),
    aggregation: AggregationEnum,
  })
  .refine((d) => d.aggregation === 'count' || d.yColumn !== null, {
    message: 'yColumn is required when aggregation is not count',
    path: ['yColumn'],
  });
export type ChartCreateInput = z.infer<typeof ChartCreateSchema>;

export const ChartUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: ChartTypeEnum.optional(),
  xColumn: z.string().min(1).max(200).optional(),
  yColumn: z.string().min(1).max(200).nullable().optional(),
  aggregation: AggregationEnum.optional(),
  position: z.number().int().min(0).optional(),
});
export type ChartUpdateInput = z.infer<typeof ChartUpdateSchema>;
