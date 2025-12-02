import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { config } from '../config/index.js';

// Extended error type for body-parser errors
interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  expose?: boolean;
  type?: string;
}

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle AppError (our custom errors)
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // Handle body-parser errors (JSON parse errors, etc.)
  if (err.type === 'entity.parse.failed' || err.expose) {
    const statusCode = err.status || err.statusCode || 400;
    sendError(res, err.message, statusCode);
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  const message = config.nodeEnv === 'production' 
    ? 'Internal server error' 
    : err.message;

  sendError(res, message, 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}

