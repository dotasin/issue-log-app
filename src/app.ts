// src/app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Import utilities
import { database } from './utils/database';
import { logger, morganStream } from './utils/logger';
import { 
  errorHandler, 
  notFoundHandler,
  developmentErrorHandler,
  productionErrorHandler
} from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import issueRoutes from './routes/issues';
import commentRoutes from './routes/comments';
import fileRoutes from './routes/files';

// Load environment variables
dotenv.config();

// Create Express application
const app = express();
console.log('🚀 Express app created');
// Add this simple test route FIRST
app.get('/simple-test', (req, res) => {
  console.log('Simple test route hit!');
  res.json({ message: 'Simple test works!' });
});

console.log('✅ Simple test route registered');

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', { stream: morganStream }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Issue Log API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: database.isConnectionActive() ? 'connected' : 'disconnected'
  });
});

// Debug endpoint to test basic functionality
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint (MUST be before other /api routes)
app.get('/api', (req, res) => {
  logger.info('API documentation endpoint hit');
  res.json({
    success: true,
    message: 'Issue Log API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'POST /api/auth/change-password': 'Change password',
        'POST /api/auth/refresh-token': 'Refresh access token',
        'POST /api/auth/logout': 'Logout user',
        'GET /api/auth/verify-token': 'Verify token'
      },
      issues: {
        'GET /api/issues': 'Get all issues with pagination and filtering',
        'GET /api/issues/my-assigned': 'Get issues assigned to current user',
        'GET /api/issues/my-created': 'Get issues created by current user',
        'GET /api/issues/:id': 'Get specific issue',
        'POST /api/issues': 'Create new issue',
        'PUT /api/issues/:id': 'Update issue',
        'PATCH /api/issues/:id/status': 'Update issue status',
        'DELETE /api/issues/:id': 'Delete issue'
      },
      comments: {
        'GET /api/comments/my-comments': 'Get comments by current user',
        'GET /api/comments/recent': 'Get recent comments',
        'GET /api/comments/issue/:issueId': 'Get comments for issue',
        'POST /api/comments/issue/:issueId': 'Add comment to issue',
        'GET /api/comments/:id': 'Get specific comment',
        'PUT /api/comments/:id': 'Update comment',
        'DELETE /api/comments/:id': 'Delete comment'
      },
      files: {
        'GET /api/files/my-files': 'Get files uploaded by current user',
        'GET /api/files/stats': 'Get file statistics',
        'GET /api/files/issue/:issueId': 'Get files for issue',
        'POST /api/files/issue/:issueId/upload': 'Upload files to issue',
        'GET /api/files/issue/:issueId/validate': 'Validate file integrity',
        'GET /api/files/:id': 'Get file metadata',
        'GET /api/files/:id/download': 'Download file',
        'DELETE /api/files/:id': 'Delete file'
      }
    }
  });
});

// Debug: Log route registration
logger.info('Registering API routes...');

// API routes (MUST be after the /api documentation route)
app.use('/api/auth', (req, res, next) => {
  logger.info(`Auth route hit: ${req.method} ${req.url}`);
  next();
}, authRoutes);

app.use('/api/issues', (req, res, next) => {
  logger.info(`Issues route hit: ${req.method} ${req.url}`);
  next();
}, issueRoutes);

app.use('/api/comments', (req, res, next) => {
  logger.info(`Comments route hit: ${req.method} ${req.url}`);
  next();
}, commentRoutes);

app.use('/api/files', (req, res, next) => {
  logger.info(`Files route hit: ${req.method} ${req.url}`);
  next();
}, fileRoutes);

logger.info('API routes registered successfully');

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler
if (process.env.NODE_ENV === 'development') {
  app.use(developmentErrorHandler);
} else {
  app.use(productionErrorHandler);
}

// Server startup function
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await database.connect();
    
    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      logger.info(`🚀 Issue Log API server running on port ${port}`);
      logger.info(`📚 API Documentation: http://localhost:${port}/api`);
      logger.info(`❤️  Health Check: http://localhost:${port}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await database.disconnect();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

export default app;