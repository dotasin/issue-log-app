// src/middleware/errorHandler.ts

import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  createErrorResponse, 
  handleMongoError, 
  handleJWTError 
} from  '../utils/errorTypes';
import { logger } from  '../utils/logger';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let processedError: AppError;

  // Log the error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Handle different types of errors
  if (error.name === 'ValidationError' || error.name === 'CastError' || (error as any).code === 11000) {
    processedError = handleMongoError(error);
  } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    processedError = handleJWTError(error);
  } else if (error instanceof AppError) {
    processedError = error;
  } else {
    // Generic error
    processedError = new AppError(
      process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
      500
    );
  }

  // Create error response
  const errorResponse = createErrorResponse(
    processedError,
    process.env.NODE_ENV === 'development'
  );

  // Send error response
  res.status(processedError.statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404
  );
  next(error);
};

/**
 * Async error wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Development error handler with detailed stack trace
 */
export const developmentErrorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = (error as AppError).statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: {
      message: error.message,
      statusCode,
      stack: error.stack,
      details: {
        url: req.url,
        method: req.method,
        params: req.params,
        query: req.query,
        body: req.body,
        headers: req.headers
      }
    }
  });
};

/**
 * Production error handler with minimal information
 */
export const productionErrorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = (error as AppError).statusCode || 500;
  const isOperational = (error as AppError).isOperational;

  // Only send error details for operational errors
  if (isOperational) {
    res.status(statusCode).json({
      success: false,
      error: {
        message: error.message,
        statusCode
      }
    });
  } else {
    // Log error but don't expose details to client
    logger.error('Non-operational error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Something went wrong',
        statusCode: 500
      }
    });
  }
};

/**
 * Validation error formatter
 */
export const formatValidationError = (error: any): string => {
  if (error.details) {
    return error.details.map((detail: any) => detail.message).join('. ');
  }
  return error.message;
};

/**
 * MongoDB duplicate key error formatter
 */
export const formatDuplicateKeyError = (error: any): string => {
  const field = Object.keys(error.keyValue)[0];
  const value = error.keyValue[field];
  return `${field} '${value}' already exists`;
};

/**
 * Rate limit error handler
 */
export const rateLimitHandler = (
  req: Request,
  res: Response
): void => {
  res.status(429).json({
    success: false,
    error: {
      message: 'Too many requests. Please try again later.',
      statusCode: 429,
      retryAfter: req.get('Retry-After')
    }
  });
};