import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from  '../utils/jwt';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { AuthenticationError, NotFoundError } from '../utils/errorTypes';
import { logger } from  '../utils/logger';

// Middleware to authenticate user using JWT token
// This middleware checks for a valid JWT token in the Authorization header
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    // Verify token
    const payload = JWTUtils.verifyAccessToken(token);

    // Find user
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    next(error);
  }
};

//Rate limiting middleware for authentication endpoints
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = attempts.get(key);

    if (!record || now > record.resetTime) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxAttempts) {
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many authentication attempts. Please try again later.',
          statusCode: 429
        }
      });
      return;
    }

    record.count++;
    next();
  };
};