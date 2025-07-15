// src/routes/comments.ts

import { Router } from 'express';
import {
  getCommentsForIssue,
  createComment,
  getCommentById,
  updateComment,
  deleteComment,
  getMyComments,
  getRecentComments
} from  '../controllers/commentController';
import { authenticate } from '../middleware/auth';
import {
  validateCreateComment,
  validateUpdateComment,
  validateCommentQuery,
  validateObjectIdParam,
  validateIssueIdParam
} from  '../middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// General comment routes
router.get('/my-comments', validateCommentQuery, getMyComments);
router.get('/recent', getRecentComments);

// Issue-specific comment routes
router.get('/issue/:issueId', validateIssueIdParam, validateCommentQuery, getCommentsForIssue);
router.post('/issue/:issueId', validateIssueIdParam, validateCreateComment, createComment);

// Individual comment routes
router.get('/:id', validateObjectIdParam, getCommentById);
router.put('/:id', validateObjectIdParam, validateUpdateComment, updateComment);
router.delete('/:id', validateObjectIdParam, deleteComment);

export default router;