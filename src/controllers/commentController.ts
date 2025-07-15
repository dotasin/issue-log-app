// src/controllers/commentController.ts

import { Request, Response, NextFunction } from 'express';
import { Comment } from '../models/Comment';
import { Issue } from '../models/Issue';
import { AuthRequest, PaginatedResponse } from '../types';
import { 
  NotFoundError, 
  ValidationError, 
  AuthorizationError 
} from '../utils/errorTypes';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Get comments for a specific issue
 */
export const getCommentsForIssue = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { issueId } = req.params;
  const { page = '1', limit = '20' } = req.query as any;

  // Check if issue exists
  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  // Get paginated comments
  const [comments, total] = await (Comment as any).getCommentsForIssue(
    issueId,
    pageNum,
    limitNum
  );

  const totalPages = Math.ceil(total / limitNum);

  const response: PaginatedResponse<any> = {
    data: comments,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    }
  };

  res.json({
    success: true,
    message: 'Comments retrieved successfully',
    ...response
  });
});

/**
 * Create a new comment for an issue
 */
export const createComment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { issueId } = req.params;
  const { content } = req.body;

  // Check if issue exists
  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  // Create comment
  const comment = new Comment({
    content,
    issueId,
    userId: req.user._id
  });

  await comment.save();

  // Populate the created comment
  await comment.populate('userId', 'firstName lastName email');

  logger.info(`New comment created for issue ${issueId} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Comment created successfully',
    data: { comment }
  });
});

/**
 * Get a specific comment by ID
 */
export const getCommentById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const comment = await Comment.findById(id)
    .populate('userId', 'firstName lastName email')
    .populate('issueId', 'title');

  if (!comment) {
    throw new NotFoundError('Comment');
  }

  res.json({
    success: true,
    message: 'Comment retrieved successfully',
    data: { comment }
  });
});

/**
 * Update a comment
 */
export const updateComment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { id } = req.params;
  const { content } = req.body;

  const comment = await Comment.findById(id);
  if (!comment) {
    throw new NotFoundError('Comment');
  }

  // Check if user owns the comment
  if (comment.userId.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only edit your own comments');
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    id,
    { content },
    { new: true, runValidators: true }
  ).populate('userId', 'firstName lastName email');

  logger.info(`Comment updated: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Comment updated successfully',
    data: { comment: updatedComment }
  });
});

/**
 * Delete a comment
 */
export const deleteComment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { id } = req.params;

  const comment = await Comment.findById(id);
  if (!comment) {
    throw new NotFoundError('Comment');
  }

  // Check if user owns the comment or owns the issue
  const issue = await Issue.findById(comment.issueId);
  const canDelete = comment.userId.toString() === req.user._id.toString() ||
                    (issue && issue.createdBy.toString() === req.user._id.toString());

  if (!canDelete) {
    throw new AuthorizationError('You can only delete your own comments or comments on your issues');
  }

  await Comment.findByIdAndDelete(id);

  logger.info(`Comment deleted: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Comment deleted successfully'
  });
});

/**
 * Get comments by current user
 */
export const getMyComments = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { page = '1', limit = '20' } = req.query as any;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const [comments, total] = await Promise.all([
    Comment.find({ userId: req.user._id })
      .populate('issueId', 'title status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Comment.countDocuments({ userId: req.user._id })
  ]);

  const totalPages = Math.ceil(total / limitNum);

  const response: PaginatedResponse<any> = {
    data: comments,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    }
  };

  res.json({
    success: true,
    message: 'Your comments retrieved successfully',
    ...response
  });
});

/**
 * Get recent comments for dashboard
 */
export const getRecentComments = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { limit = 10 } = req.query;

  const comments = await Comment.find()
    .populate('userId', 'firstName lastName email')
    .populate('issueId', 'title')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit.toString()))
    .lean();

  res.json({
    success: true,
    message: 'Recent comments retrieved successfully',
    data: { comments }
  });
});