import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),

  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  COOKIE_DOMAIN: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  LLM_PROVIDER: z.enum(['gemini', 'mock']).default('mock'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().optional().default(''),

  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
  MAX_ROWS: z.coerce.number().int().positive().default(50_000),
  CHART_CAP_PER_USER: z.coerce.number().int().positive().default(3),
});

export type Config = z.infer<typeof EnvSchema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.LLM_PROVIDER === 'gemini' && !parsed.data.LLM_API_KEY) {
    throw new Error('LLM_PROVIDER=gemini requires LLM_API_KEY to be set');
  }
  cached = parsed.data;
  return cached;
}
