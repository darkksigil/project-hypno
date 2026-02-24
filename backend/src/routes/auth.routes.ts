import { Router, Request, Response } from 'express';
import { z }                         from 'zod';
import { timingSafeEqual, createHash } from 'crypto';
import { asyncHandler, AppError }    from '../middlewares/error.middleware';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// Hash both sides to equal-length buffers before comparing.
// timingSafeEqual requires identical buffer lengths — comparing raw
// strings would throw a RangeError whenever lengths differ.
function safeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

// POST /auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = loginSchema.parse(req.body);

  const validUser = process.env.ADMIN_USER ?? '';
  const validPass = process.env.ADMIN_PASS ?? '';

  const usernameMatch = safeCompare(username, validUser);
  const passwordMatch = safeCompare(password, validPass);

  if (usernameMatch && passwordMatch) {
    (req.session as any).authenticated = true;
    res.json({ status: 'ok', message: 'Login successful.' });
    return;
  }

  throw new AppError(401, 'Invalid credentials.', 'UNAUTHORIZED');
}));

// POST /auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ status: 'ok', message: 'Logged out.' });
  });
});

// GET /auth/me
router.get('/me', (req: Request, res: Response) => {
  if ((req.session as any).authenticated) {
    res.json({ status: 'ok', authenticated: true });
    return;
  }
  res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', authenticated: false });
});

export default router;