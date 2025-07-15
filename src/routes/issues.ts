// src/routes/issues.ts

import { Router } from 'express';
import {
  getIssues,
  getIssueById,
  createIssue,
  updateIssue,
  updateIssueStatus,
  deleteIssue,
  getMyAssignedIssues,
  getMyCreatedIssues
} from '../controllers/issueController';
import { authenticate } from '../middleware/auth';
import {
  validateCreateIssue,
  validateUpdateIssue,
  validateUpdateIssueStatus,
  validateIssueQuery,
  validateObjectIdParam
} from '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Public issue routes (authenticated users can view all issues)
router.get('/', validateIssueQuery, getIssues);
router.get('/my-assigned', validateIssueQuery, getMyAssignedIssues);
router.get('/my-created', validateIssueQuery, getMyCreatedIssues);

// Issue CRUD operations
router.post('/', validateCreateIssue, createIssue);

// Routes with issue ID parameter
router.get('/:id', validateObjectIdParam, getIssueById);
router.put('/:id', validateObjectIdParam, validateUpdateIssue, updateIssue);
router.patch('/:id/status', validateObjectIdParam, validateUpdateIssueStatus, updateIssueStatus);
router.delete('/:id', validateObjectIdParam, deleteIssue);

export default router;