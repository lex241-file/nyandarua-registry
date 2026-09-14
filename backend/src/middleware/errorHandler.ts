import { NextFunction, Request, Response } from 'express';
import { Result, ValidationError, validationResult } from 'express-validator';

/** Run after express-validator checks; returns 400 with details if any failed. */
export function handleValidation(req: Request, res: Response, next: NextFunction) {
  const result: Result<ValidationError> = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: result.array() });
  }
  next();
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
