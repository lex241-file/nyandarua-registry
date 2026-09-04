import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload, Role } from '../types';

const JWT_SECRET = process.env.JWT_SECRET as string;

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'],
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as AuthTokenPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}
