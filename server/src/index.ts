import { createApp } from './app';
import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { logger } from './lib/logger';

async function main() {
  await connectDb(config.mongoUri);
  const server = createApp().listen(config.port, () => logger.info(`API listening on :${config.port}`));
  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
