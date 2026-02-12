import express from 'express';
import cors from 'cors';
import { getDb } from '../../database/db';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/users', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO users (name) VALUES (?)',
      name
    );

    res.status(201).json({ id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/users', async (_req, res) => {
  const db = await getDb();
  const users = await db.all('SELECT * FROM users');
  res.json(users);
});

export default app;