import multer, { FileFilterCallback, MulterError } from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { FileUploadError } from  '../utils/errorTypes';
import { logger } from '../utils/logger';

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed'
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760');

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

// Ensure upload directory exists
const ensureUploadDir = (): void => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Created upload directory: ${UPLOAD_DIR}`);
  }
};

// Generate unique filename
const generateFilename = (originalName: string): string => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${name}_${timestamp}_${random}${ext}`;
};

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const filename = generateFilename(file.originalname);
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new FileUploadError(
      `File type ${file.mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    );
    cb(error);
    return;
  }

  // Check file size (additional check, multer also handles this)
  if (file.size && file.size > MAX_FILE_SIZE) {
    const error = new FileUploadError(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`
    );
    cb(error);
    return;
  }

  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Maximum 5 files per request
    fieldSize: 1024 * 1024 // 1MB field size limit
  }
});

// Single file upload middleware
export const uploadSingle = (fieldName: string = 'file') => {
  return upload.single(fieldName);
};

// Multiple files upload middleware
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 5) => {
  return upload.array(fieldName, maxCount);
};

// Upload error handler middleware
export const handleUploadError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof MulterError) {
    let message: string;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size allowed is ${MAX_FILE_SIZE} bytes`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 5 files allowed per request';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts';
        break;
      default:
        message = `Upload error: ${error.message}`;
    }
    
    next(new FileUploadError(message));
    return;
  }

  if (error instanceof FileUploadError) {
    next(error);
    return;
  }

  // Generic error
  next(new FileUploadError('File upload failed'));
};

// File validation middleware (for additional checks after upload)
export const validateUploadedFile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const file = req.file;
  
  if (!file) {
    next(new FileUploadError('No file uploaded'));
    return;
  }

  // Additional validation can be added here
  // For example, checking actual file content vs mimetype
  
  logger.info(`File uploaded successfully: ${file.originalname} (${file.size} bytes)`);
  next();
};

// Cleanup function to remove uploaded file on error
export const cleanupUploadedFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Cleaned up uploaded file: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Error cleaning up file ${filePath}:`, error);
  }
};

// Middleware to cleanup files on request error
export const cleanupOnError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Clean up uploaded files if request failed
  if (req.file) {
    cleanupUploadedFile(req.file.path);
  }
  
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach(file => {
      cleanupUploadedFile(file.path);
    });
  }
  
  next(error);
};

// Get file info helper
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path
  };
};