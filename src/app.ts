import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

//Import utilities
import { database } from './utils/database';
import { logger, morganStream } from './utils/logger';
import {
  errorHandler,
  notFoundHandler,
  developmentErrorHandler,
  productionErrorHandler
} from './middleware/errorHandler';

//Import routes
import authRoutes from './routes/auth';
import issueRoutes from './routes/issues';
import commentRoutes from './routes/comments';
import fileRoutes from './routes/files';

// Load environment variables
dotenv.config();
// Initialize Express app
const app = express();
// Set up application-level middleware
let server: ReturnType<typeof app.listen>;

// Trust first proxy for secure connections (if behind a reverse proxy)
app.set('trust proxy', 1);

//Adds security-related HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
// Allows requests from specified origins and enables credentials
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

//Parses incoming JSON requests with a body size limit
app.use(express.json({ limit: '10mb' }));
//Parses incoming requests with urlencoded payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
//Logging HTTP requests
app.use(morgan('combined', { stream: morganStream }));
//Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Basic health & test routes
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

// Test route to verify server is working
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Test working' });
});

// API Documentation route
app.get('/api', (req, res) => {
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
        'GET /api/issues': 'Get all issues',
        'GET /api/issues/:id': 'Get issue',
        'POST /api/issues': 'Create issue',
        'PUT /api/issues/:id': 'Update issue',
        'DELETE /api/issues/:id': 'Delete issue'
      },
      comments: {
        'GET /api/comments/my-comments': 'Get my comments',
        'GET /api/comments/recent': 'Get recent comments',
        'POST /api/comments/issue/:issueId': 'Add comment to issue'
      },
      files: {
        'GET /api/files/my-files': 'Get my files',
        'POST /api/files/issue/:issueId/upload': 'Upload files',
        'GET /api/files/:id/download': 'Download file'
      }
    }
  });
});

// Route registration with logging
logger.info('Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
logger.info('Routes registered successfully');

// 404 & Error handling
app.use(notFoundHandler);
if (process.env.NODE_ENV === 'development') {
  app.use(developmentErrorHandler);
} else {
  app.use(productionErrorHandler);
}

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});


/**
 * Starts the Express server and connects to the database.
 *
 * Attempts to establish a connection to the database, then starts
 * the HTTP server on the specified port (default: 3000).
 * Logs the server's URL when successfully started.
 * On startup failure, logs the error and exits the process.
 */
const startServer = async () => {
  try {
    await database.connect();
    const port = process.env.PORT || 3000;
    server = app.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
};


/**
 * Gracefully shut down the server.
 *
 * Disconnects from the database and then closes the HTTP server.
 * If the server is not running, it simply exits the process.
 */
const shutdown = async () => {
  logger.info('Gracefully shutting down...');
  await database.disconnect();
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

// Handle process termination signals for graceful shutdown
process.on('SIGINT', shutdown);
// Handle process termination signals for graceful shutdown
process.on('SIGTERM', shutdown);
// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});
// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
