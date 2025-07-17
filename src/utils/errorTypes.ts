//Base error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

//Validation error for input validation failures
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

//Authentication error for invalid credentials
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
  }
}

//Authorization error for access control
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

//Not found error
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

//Conflict error for duplicate entries
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

//Database error
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500);
  }
}

// File upload error
export class FileUploadError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

//Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    stack?: string;
    details?: any;
  };
}

//Helper function to create error response
export const createErrorResponse = (
  error: AppError | Error,
  includeStack: boolean = false
): ErrorResponse => {
  const statusCode = (error as AppError).statusCode || 500;
  
  return {
    success: false,
    error: {
      message: error.message,
      statusCode,
      ...(includeStack && { stack: error.stack }),
    }
  };
};

//MongoDB error handler
export const handleMongoError = (error: any): AppError => {
  if (error.code === 11000) {
    // Duplicate key error
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return new ConflictError(`${field} '${value}' already exists`);
  }

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return new ValidationError(messages.join('. '));
  }

  if (error.name === 'CastError') {
    return new ValidationError(`Invalid ${error.path}: ${error.value}`);
  }

  return new DatabaseError(error.message);
};

//JWT error handler
export const handleJWTError = (error: any): AppError => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }

  return new AuthenticationError('Token verification failed');
};