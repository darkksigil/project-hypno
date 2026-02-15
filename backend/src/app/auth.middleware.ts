import { Request, Response, NextFunction } from 'express';

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if ((req.session as any).authenticated) {
    next();
  } else {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
}

module.exports = { requireAuth };