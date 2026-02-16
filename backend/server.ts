import dotenv from 'dotenv';
dotenv.config();

import app from './src/app/app';
const { initDb } = require('./database/db');

const PORT = process.env.PORT ?? 3000;

async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();