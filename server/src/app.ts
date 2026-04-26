import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Config } from '@config/env';
import { getPrisma } from '@db/client';
import { PrismaUserRepository } from '@db/repositories/userRepo';
import { PrismaSessionRepository } from '@db/repositories/sessionRepo';
import { PrismaDatasetRepository } from '@db/repositories/datasetRepo';
import { PrismaChartRepository } from '@db/repositories/chartRepo';
import { PrismaInsightRepository } from '@db/repositories/insightRepo';
import { createLLMProvider } from '@llm/index';
import { createAuthService } from '@services/authService';
import { createCsvService } from '@services/csvService';
import { createDatasetService } from '@services/datasetService';
import { createAggregationService } from '@services/aggregationService';
import { createChartService } from '@services/chartService';
import { createAIService } from '@services/aiService';
import { createAuthRouter } from '@routes/auth';
import { createDatasetsRouter } from '@routes/datasets';
import { createChartsRouter } from '@routes/charts';
import { createAIRouter } from '@routes/ai';
import { createHealthRouter } from '@routes/health';
import { createRequireAuth } from '@middleware/requireAuth';
import { csrfMiddleware } from '@middleware/csrf';
import { errorHandler } from '@middleware/errorHandler';
import { logger } from '@lib/logger';

export function createApp(config: Config): express.Express {
  const prisma = getPrisma();

  // Repositories
  const userRepo = new PrismaUserRepository(prisma);
  const sessionRepo = new PrismaSessionRepository(prisma);
  const datasetRepo = new PrismaDatasetRepository(prisma);
  const chartRepo = new PrismaChartRepository(prisma);
  const insightRepo = new PrismaInsightRepository(prisma);

  // Adapters
  const llm = createLLMProvider(config);

  // Services
  const authService = createAuthService({ config, userRepo, sessionRepo });
  const csvService = createCsvService(config);
  const datasetService = createDatasetService({ datasetRepo, csvService });
  const aggregationService = createAggregationService({ datasetRepo });
  const chartService = createChartService({ config, chartRepo, datasetRepo });
  const aiService = createAIService({
    llm,
    datasetRepo,
    chartRepo,
    insightRepo,
    aggregationService,
  });

  // Middleware setup
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  const requireAuth = createRequireAuth(authService);
  const csrf = csrfMiddleware({
    cookieDomain: config.COOKIE_DOMAIN,
    secure: config.NODE_ENV === 'production',
  });

  // Routes
  app.use('/api', createHealthRouter());

  // Auth routes — login/signup/refresh: csrf is enforced via SameSite=Lax on the cookies
  // and the double-submit middleware applies to all mutating requests below.
  app.use('/api/auth', csrf, createAuthRouter({ config, authService, userRepo, requireAuth }));
  app.use('/api/datasets', csrf, createDatasetsRouter({ config, datasetService, requireAuth }));
  app.use('/api/charts', csrf, createChartsRouter({ chartService, aggregationService, requireAuth }));
  app.use('/api/ai', csrf, createAIRouter({ aiService, aggregationService, requireAuth }));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(errorHandler);

  logger.info({ provider: config.LLM_PROVIDER, env: config.NODE_ENV }, 'App ready');
  return app;
}
