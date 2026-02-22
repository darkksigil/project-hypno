import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if ((req.session as any).authenticated) {
    next();
    return;
  }
  res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required.' });
}
