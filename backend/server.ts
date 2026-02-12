import app from './src/app/app';
import { initDb } from './database/initDb';

const PORT = 3000;

async function startServer() {
  try {
    await initDb(); // ⬅️ DB READY FIRST

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();