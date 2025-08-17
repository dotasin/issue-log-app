import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Import utilities and middleware
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

// Initialize Express app
const app = express();
let server: ReturnType<typeof app.listen>;

// Trust first proxy for secure connections (if behind a reverse proxy)
app.set('trust proxy', 1);

// Adds security-related HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration 
// Allows cross-origin requests from specified origins
// This is useful for APIs that need to be accessed from different domains
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Request parsers
// Parses incoming JSON requests and limits the body size to 10MB 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
// Uses morgan for logging HTTP requests in 'combined' format
app.use(morgan('combined', { stream: morganStream }));

// Serve static files 
// Serves static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
// Simple endpoint to check if the API is running
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

// Test route
app.get('/test', (req, res) => {
  res.json({ success: true, message: 'Test working' });
});

// API documentation
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

// Route registration
logger.info('Registering API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/files', fileRoutes);
logger.info('Routes registered successfully');

// Error handling
app.use(notFoundHandler);
if (process.env.NODE_ENV === 'development') {
  app.use(developmentErrorHandler);
} else {
  app.use(productionErrorHandler);
}


// Starts the Express server and connects to the database.
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

// Gracefully shut down the server.
const shutdown = async () => {
  logger.info('Gracefully shutting down...');
  await database.disconnect();

  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing server:', err);
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });
  }

  process.exit(0);
};

// Graceful shutdown on SIGINT and SIGTERM
process.on('SIGINT', () => {
  logger.info('SIGINT received');
  shutdown();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  shutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  shutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  shutdown();
});

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
