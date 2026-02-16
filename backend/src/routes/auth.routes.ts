import { Router, Request, Response } from 'express';

const router = Router();

// ─── POST /auth/login ─────────────────────────────────────────
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  console.log('ENV USER:', process.env.ADMIN_USER);
  console.log('ENV PASS:', process.env.ADMIN_PASS);
  console.log('GOT:', username, password);
  // ... rest of code

  const validUser = process.env.ADMIN_USER;
  const validPass = process.env.ADMIN_PASS;

  if (username === validUser && password === validPass) {
    (req.session as any).authenticated = true;
    res.json({ status: 'ok', message: 'Login successful.' });
  } else {
    res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
  }
});

// ─── POST /auth/logout ────────────────────────────────────────
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ status: 'ok', message: 'Logged out.' });
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────
router.get('/me', (req: Request, res: Response) => {
  if ((req.session as any).authenticated) {
    res.json({ status: 'ok', authenticated: true });
  } else {
    res.status(401).json({ status: 'error', authenticated: false });
  }
});

module.exports = router;