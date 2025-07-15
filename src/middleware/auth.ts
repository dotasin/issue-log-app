// src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from  '../utils/jwt';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import { AuthenticationError, NotFoundError } from '../utils/errorTypes';
import { logger } from  '../utils/logger';
/**
 * Middleware to authenticate user using JWT token
 */
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

/**
 * Optional authentication middleware - doesn't throw error if no token
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = JWTUtils.verifyAccessToken(token);
      const user = await User.findById(payload.userId);
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Log error but continue without authentication
    logger.warn('Optional authentication failed:', error);
    next();
  }
};

/**
 * Middleware to check if user owns the resource
 */
export const checkOwnership = (resourceModel: any, resourceIdParam: string = 'id') => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        throw new NotFoundError('Resource');
      }

      // Check if user owns the resource (assumes resource has createdBy field)
      if (resource.createdBy.toString() !== req.user._id.toString()) {
        throw new AuthenticationError('Access denied - you can only access your own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to refresh expired tokens
 */
export const refreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token is required');
    }

    // Verify refresh token
    const payload = JWTUtils.verifyRefreshToken(refreshToken);

    // Find user
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate new tokens
    const newTokens = JWTUtils.generateTokens({
      userId: user._id,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
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