import dotenv from 'dotenv';
dotenv.config();

// ─── Env Validation — fail fast before anything else starts ──
const REQUIRED_ENV = ['SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASS'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

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