import { Router } from 'express';
import { uploadFiles, getFilesForIssue, downloadFile, getFileById, deleteFile, getMyFiles, getFileStats, validateFileIntegrity } from  '../controllers/fileController';
import { authenticate } from '../middleware/auth';
import { uploadMultiple, handleUploadError, cleanupOnError } from '../middleware/upload';
import { validateObjectIdParam, validateIssueIdParam, validateCommentQuery } from  '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// File management routes
router.get('/my-files', validateCommentQuery, getMyFiles);
router.get('/stats', getFileStats);

// Issue-specific file routes
router.get('/issue/:issueId', validateIssueIdParam, getFilesForIssue);
router.post('/issue/:issueId/upload', 
  validateIssueIdParam,
  uploadMultiple('files', 5),
  handleUploadError,
  cleanupOnError,
  uploadFiles
);
router.get('/issue/:issueId/validate', validateIssueIdParam, validateFileIntegrity);

// Individual file routes
router.get('/:id', validateObjectIdParam, getFileById);
router.get('/:id/download', validateObjectIdParam, downloadFile);
router.delete('/:id', validateObjectIdParam, deleteFile);

export default router;