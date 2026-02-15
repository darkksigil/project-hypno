// backend/server.ts
import app from './src/app/app';
const { initDb } = require('./database/db');

const PORT = process.env.PORT ?? 3000;

async function startServer() {
  try {
    await initDb(); // ensure DB is initialized first
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
