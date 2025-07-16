# Issue Log API

A comprehensive RESTful API for issue tracking and management, built with Node.js, TypeScript, Express.js, and MongoDB. This API provides complete CRUD operations for issues, comments, file attachments, and user management with JWT-based authentication.

## Features

### Core Functionality
- **Issue Management**: Create, read, update, delete issues with status tracking
- **Comment System**: Thread-based commenting on issues
- **File Management**: Upload, download, and manage file attachments
- **User Authentication**: JWT-based authentication with refresh tokens
- **Real-time Search**: Full-text search across issue titles and descriptions

### Advanced Features
- **Pagination**: All list endpoints support pagination
- **Filtering**: Filter issues by status, priority, assignee, creator
- **File Validation**: Multiple file type support with size restrictions
- **Data Integrity**: Automatic cleanup of orphaned records
- **Comprehensive Logging**: Winston-based logging system
- **Error Handling**: Centralized error handling with detailed responses

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS, bcrypt

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB Atlas account (or local MongoDB instance)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd issue-log-api
```

### 2. Install Dependencies
```bash
# Core dependencies
npm install express mongoose jsonwebtoken multer joi winston helmet cors bcrypt dotenv

# TypeScript dependencies
npm install -D typescript ts-node @types/node @types/express @types/jsonwebtoken @types/multer @types/joi @types/cors @types/bcrypt nodemon


# Validation & Utilities
npm install joi winston express-rate-limit
npm install -D @types/joi

# Testing
npm install tslib
npm install --save-dev jest @types/jest supertest @types/supertest ts-jest mongodb-memory-server


```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://ivantasin:mpLIXTuVpkKR44SS@issuelogdb.omjzvn3.mongodb.net/?retryWrites=true&w=majority&appName=issueLogDB
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
```

### 4. TypeScript Configuration
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}

### 5. Package.json Scripts
Update your `package.json`:
```json
{
  "scripts": {
    "start": "node dist/app.js",
    "dev": "nodemon --exec ts-node src/app.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false",
    "test:auth": "jest auth.test.ts",
    "test:issues": "jest issues.test.ts",
    "test:comments": "jest comments.test.ts",
    "test:files": "jest files.test.ts"
  }
}
```

### 5. jest.config.json 
Update your `package.json`:
```json
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app.ts', // exclude entry point
    '!src/__tests__/**', // exclude test files from coverage
  ],
  coverageDirectory: 'coverage',
  testTimeout: 30000,
  detectOpenHandles: true,
  verbose: true,
};


## Running the Application

### Development Mode
```bash
npm run dev

# run the tests
npx jest
```

### Production Mode
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000`

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login user |
| GET | `/auth/profile` | Get user profile |
| PUT | `/auth/profile` | Update user profile |
| POST | `/auth/change-password` | Change password |
| POST | `/auth/refresh-token` | Refresh JWT tokens |
| POST | `/auth/logout` | Logout user |
| GET | `/auth/verify-token` | Verify token |

### Issue Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/issues` | Get all issues (with pagination/filtering) |
| GET | `/issues/my-assigned` | Get issues assigned to current user |
| GET | `/issues/my-created` | Get issues created by current user |
| GET | `/issues/:id` | Get specific issue |
| POST | `/issues` | Create new issue |
| PUT | `/issues/:id` | Update issue |
| PATCH | `/issues/:id/status` | Update issue status |
| DELETE | `/issues/:id` | Delete issue |

### Comment Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/comments/issue/:issueId` | Get comments for issue |
| POST | `/comments/issue/:issueId` | Add comment to issue |
| GET | `/comments/:id` | Get specific comment |
| PUT | `/comments/:id` | Update comment |
| DELETE | `/comments/:id` | Delete comment |
| GET | `/comments/my-comments` | Get current user's comments |
| GET | `/comments/recent` | Get recent comments |

### File Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/files/issue/:issueId/upload` | Upload files to issue |
| GET | `/files/issue/:issueId` | Get files for issue |
| GET | `/files/:id` | Get file metadata |
| GET | `/files/:id/download` | Download file |
| DELETE | `/files/:id` | Delete file |
| GET | `/files/my-files` | Get current user's files |
| GET | `/files/stats` | Get file statistics |

## Authentication

The API uses JWT-based authentication with access and refresh tokens:

1. **Register/Login** to receive tokens
2. **Include access token** in Authorization header: `Bearer <token>`
3. **Refresh tokens** when access token expires
4. **All protected endpoints** require valid access token

### Example Authentication Flow
```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","firstName":"John","lastName":"Doe"}'

# 2. Use the returned access token in subsequent requests
curl -X GET http://localhost:3000/api/issues \
  -H "Authorization: Bearer <access-token>"
```

## Data Models

### User
```typescript
{
  email: string;
  password: string; // hashed
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Issue
```typescript
{
  title: string;
  description: string;
  status: 'pending' | 'complete';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: ObjectId; // User reference
  createdBy: ObjectId; // User reference
  comments: ObjectId[]; // Comment references
  files: ObjectId[]; // File references
  createdAt: Date;
  updatedAt: Date;
}
```

### Comment
```typescript
{
  content: string;
  issueId: ObjectId; // Issue reference
  userId: ObjectId; // User reference
  createdAt: Date;
  updatedAt: Date;
}
```

### File
```typescript
{
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  issueId: ObjectId; // Issue reference
  uploadedBy: ObjectId; // User reference
  uploadedAt: Date;
}
```

## Query Parameters

### Issues
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status (`pending`, `complete`)
- `priority` - Filter by priority (`low`, `medium`, `high`)
- `assignedTo` - Filter by assigned user ID
- `createdBy` - Filter by creator user ID
- `search` - Search in title and description

### Comments & Files
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Security**: Access and refresh token pattern
- **Input Validation**: Joi schema validation
- **File Upload Security**: File type and size restrictions
- **Rate Limiting**: Authentication endpoint protection
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security headers

## Project Structure

```
src/
├── __tests__/       # tests
│   ├── utils/
│   ├	├── testHelpers.ts
│   ├── auth.test.ts
│   ├── comment.test.ts
│   ├── file.test.ts
│   ├── issue.test.ts
│   ├── setup.ts
├── controllers/     # Business logic handlers
│   ├── authController.ts
│   ├── issueController.ts
│   ├── commentController.ts
│   └── fileController.ts
├── models/          # MongoDB schemas
│   ├── User.ts
│   ├── Issue.ts
│   ├── Comment.ts
│   └── File.ts
├── routes/          # Express route definitions
│   ├── auth.ts
│   ├── issues.ts
│   ├── comments.ts
│   └── files.ts
├── middleware/      # Custom middleware
│   ├── auth.ts
│   ├── validation.ts
│   ├── upload.ts
│   └── errorHandler.ts
├── utils/           # Utility functions
│   ├── database.ts
│   ├── logger.ts
│   ├── errorTypes.ts
│   ├── jwt.ts
│   └── fileUtils.ts
├── types/           # TypeScript type definitions
│   └── index.ts
└── app.ts           # Main application file
```

## Testing with Postman

A complete Postman collection is provided with:
- Environment variables for easy configuration
- Automatic token management
- All CRUD operations
- File upload examples
- Error scenario testing

Import the collection and set the `baseUrl` to `http://localhost:3000`.

## Error Handling

The API provides comprehensive error handling with:
- Consistent error response format
- Detailed error messages in development
- Secure error messages in production
- HTTP status codes following REST conventions
- Request validation errors
- Database operation errors

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  }
}
```

## Logging

The application uses Winston for comprehensive logging:
- **Console logging** for development
- **File logging** for production
- **Error tracking** with stack traces
- **Request logging** with Morgan
- **Log rotation** and management

Log files are stored in the `logs/` directory:
- `error.log` - Error level logs
- `combined.log` - All logs
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

## Data Integrity

The API maintains data integrity through:
- **Cascade Deletes**: Automatic cleanup of related data
- **Reference Validation**: Ensures valid ObjectId references
- **File Cleanup**: Removes orphaned files from disk
- **Transaction Safety**: Atomic operations where needed

## Production Deployment

For production deployment:

1. **Environment Variables**: Set secure JWT secrets and production MongoDB URI
2. **Build Application**: Run `npm run build`
3. **Process Management**: Use PM2 or similar for process management
4. **Reverse Proxy**: Configure nginx or similar for SSL and load balancing
5. **Monitoring**: Set up application monitoring and health checks


## Useful Endpoints

- **Health Check**: `GET /health`
- **API Documentation**: `GET /api`

**Built with using Node.js, TypeScript, and MongoDB**