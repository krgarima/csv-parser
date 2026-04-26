import { loadConfig } from '@config/env';
import { createApp } from './app';
import { disconnectPrisma } from '@db/client';
import { logger } from '@lib/logger';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = createApp(config);

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      logger.info('HTTP server closed');
    });
    await disconnectPrisma();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
