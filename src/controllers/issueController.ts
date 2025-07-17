import { Request, Response, NextFunction } from 'express';
import { Issue } from '../models/Issue';
import { User } from '../models/User';
import { AuthRequest, IssueQueryParams, PaginatedResponse } from '../types';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errorTypes';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

//Get all issues with pagination and filtering
export const getIssues = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const {
    status,
    priority,
    assignedTo,
    createdBy,
    search,
    page = '1',
    limit = '20'
  } = req.query as any;

  // Build filter object
  const filter: any = {};

  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (createdBy) filter.createdBy = createdBy;

  // Add search functionality
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Convert page and limit to numbers
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);

  // Get paginated results
  const [issues, total] = await (Issue as any).getPaginatedIssues(
    filter,
    pageNum,
    limitNum
  );

  const totalPages = Math.ceil(total / limitNum);

  const response: PaginatedResponse<any> = {
    data: issues,
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
    message: 'Issues retrieved successfully',
    ...response
  });
});

//Get single issue by ID
export const getIssueById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const issue = await Issue.findById(id)
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate({
      path: 'comments',
      populate: {
        path: 'userId',
        select: 'firstName lastName email'
      },
      options: { sort: { createdAt: -1 } }
    })
    .populate({
      path: 'files',
      populate: {
        path: 'uploadedBy',
        select: 'firstName lastName email'
      }
    });

  if (!issue) {
    throw new NotFoundError('Issue');
  }

  res.json({
    success: true,
    message: 'Issue retrieved successfully',
    data: { issue }
  });
});

//Create new issue
export const createIssue = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { title, description, priority, assignedTo } = req.body;

  // Validate assignedTo user if provided
  if (assignedTo) {
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      throw new ValidationError('Assigned user not found');
    }
  }

  const issue = new Issue({
    title,
    description,
    priority,
    assignedTo,
    createdBy: req.user._id
  });

  await issue.save();

  // Populate the created issue
  await issue.populate('createdBy', 'firstName lastName email');
  if (assignedTo) {
    await issue.populate('assignedTo', 'firstName lastName email');
  }

  logger.info(`New issue created: ${title} by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Issue created successfully',
    data: { issue }
  });
});

//Update issue
export const updateIssue = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { id } = req.params;
  const { title, description, priority, assignedTo } = req.body;

  const issue = await Issue.findById(id);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  // Check if user owns the issue or is assigned to it
  const canEdit = issue.createdBy.toString() === req.user._id.toString() ||
                  (issue.assignedTo && issue.assignedTo.toString() === req.user._id.toString());

  if (!canEdit) {
    throw new AuthorizationError('You can only edit issues you created or are assigned to');
  }

  // Validate assignedTo user if provided
  if (assignedTo) {
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser) {
      throw new ValidationError('Assigned user not found');
    }
  }

  // Update issue
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (priority !== undefined) updateData.priority = priority;
  if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

  const updatedIssue = await Issue.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');

  logger.info(`Issue updated: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Issue updated successfully',
    data: { issue: updatedIssue }
  });
});

//Update issue status
export const updateIssueStatus = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { id } = req.params;
  const { status } = req.body;

  const issue = await Issue.findById(id);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  // Check if user owns the issue or is assigned to it
  const canEdit = issue.createdBy.toString() === req.user._id.toString() ||
                  (issue.assignedTo && issue.assignedTo.toString() === req.user._id.toString());

  if (!canEdit) {
    throw new AuthorizationError('You can only update status of issues you created or are assigned to');
  }

  const updatedIssue = await Issue.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');

  logger.info(`Issue status updated: ${id} to ${status} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Issue status updated successfully',
    data: { issue: updatedIssue }
  });
});

//Delete issue
export const deleteIssue = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { id } = req.params;

  const issue = await Issue.findById(id);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  // Only the creator can delete the issue
  if (issue.createdBy.toString() !== req.user._id.toString()) {
    throw new AuthorizationError('You can only delete issues you created');
  }

  // Delete associated comments and files (this should be handled by middleware)
  await Issue.findByIdAndDelete(id);

  logger.info(`Issue deleted: ${id} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Issue deleted successfully'
  });
});

//Get issues assigned to current user
export const getMyAssignedIssues = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { page = 1, limit = 20, status } = req.query;

  const filter: any = { assignedTo: req.user._id };
  if (status) filter.status = status;

  const [issues, total] = await (Issue as any).getPaginatedIssues(
    filter,
    parseInt(page.toString()),
    parseInt(limit.toString())
  );

  const totalPages = Math.ceil(total / parseInt(limit.toString()));

  const response: PaginatedResponse<any> = {
    data: issues,
    pagination: {
      page: parseInt(page.toString()),
      limit: parseInt(limit.toString()),
      total,
      pages: totalPages,
      hasNext: parseInt(page.toString()) < totalPages,
      hasPrev: parseInt(page.toString()) > 1
    }
  };

  res.json({
    success: true,
    message: 'Assigned issues retrieved successfully',
    ...response
  });
});

//Get issues created by current user
export const getMyCreatedIssues = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { page = 1, limit = 20, status } = req.query;

  const filter: any = { createdBy: req.user._id };
  if (status) filter.status = status;

  const [issues, total] = await (Issue as any).getPaginatedIssues(
    filter,
    parseInt(page.toString()),
    parseInt(limit.toString())
  );

  const totalPages = Math.ceil(total / parseInt(limit.toString()));

  const response: PaginatedResponse<any> = {
    data: issues,
    pagination: {
      page: parseInt(page.toString()),
      limit: parseInt(limit.toString()),
      total,
      pages: totalPages,
      hasNext: parseInt(page.toString()) < totalPages,
      hasPrev: parseInt(page.toString()) > 1
    }
  };

  res.json({
    success: true,
    message: 'Created issues retrieved successfully',
    ...response
  });
});