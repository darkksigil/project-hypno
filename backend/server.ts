import dotenv from 'dotenv';
dotenv.config();

import app from './src/app';
import { initDb } from './database/db';
import logger from './src/utils/logger';

const PORT = process.env.PORT ?? 3000;

async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => logger.info(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
