import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// ─── AppError ─────────────────────────────────────────────────
// All intentional HTTP errors should throw this.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── asyncHandler ─────────────────────────────────────────────
// Wraps async route handlers so errors propagate to errorHandler.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ─── notFoundHandler ──────────────────────────────────────────
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    code:    'NOT_FOUND',
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
}

// ─── errorHandler ─────────────────────────────────────────────
// Must be last middleware registered in app.ts (4-arg signature required by Express).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status:  'error',
      code:    err.code ?? 'APP_ERROR',
      message: err.message,
    });
    return;
  }

  // Zod validation errors bubble up as plain Error with a specific name
  if (err.name === 'ZodError') {
    res.status(400).json({
      status:  'error',
      code:    'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: JSON.parse(err.message),
    });
    return;
  }

  // SQLite unique constraint
  if ((err as any)?.message?.includes('UNIQUE')) {
    res.status(409).json({
      status:  'error',
      code:    'CONFLICT',
      message: 'A record with that value already exists.',
    });
    return;
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({
    status:  'error',
    code:    'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  });
}
