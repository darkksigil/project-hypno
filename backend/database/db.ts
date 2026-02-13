const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

/** @type {import('sqlite').Database<sqlite3.Database, sqlite3.Statement>} */
let dbInstance;

const dbPath = path.resolve(__dirname, 'mydb.sqlite');

async function initDb(): Promise<void> {
  if (fs.existsSync(dbPath)) {
    try {
      const tempDb = await open({ filename: dbPath, driver: sqlite3.Database });
      await tempDb.get('SELECT 1');
      await tempDb.close();
    } catch (err) {
      console.error('❌ DB corrupted, recreating...', err);
      fs.unlinkSync(dbPath);
    }
  }

  dbInstance = await open({ filename: dbPath, driver: sqlite3.Database });

  await dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

  const count = await dbInstance.get('SELECT COUNT(*) as cnt FROM users');
  if (!count?.cnt) {
    await dbInstance.run(`INSERT INTO users (name) VALUES ('Alice'), ('John')`);
  }

  console.log('✅ Database initialized at', dbPath);
}

function getDb() {
  if (!dbInstance) throw new Error('Database not initialized. Call initDb() first.');
  return dbInstance;
}

module.exports = { initDb, getDb };