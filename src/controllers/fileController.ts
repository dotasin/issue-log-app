// src/controllers/fileController.ts

import { Request, Response, NextFunction } from 'express';
import { File } from '../models/File';
import { Issue } from '../models/Issue';
import { AuthRequest } from '../types';
import { 
  NotFoundError, 
  ValidationError, 
  AuthorizationError,
  FileUploadError 
} from '../utils/errorTypes';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { getFileInfo, cleanupUploadedFile } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

/**
 * Upload file(s) to an issue
 */
export const uploadFiles = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { issueId } = req.params;

  // Check if issue exists
  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  // Check if user has permission to upload files to this issue
  const canUpload = issue.createdBy.toString() === req.user._id.toString() ||
                    (issue.assignedTo && issue.assignedTo.toString() === req.user._id.toString());

  if (!canUpload) {
    throw new AuthorizationError('You can only upload files to issues you created or are assigned to');
  }

  // Handle single or multiple files
  const files = req.files ? (Array.isArray(req.files) ? req.files : [req.file]) : [req.file];
  
  if (!files || files.length === 0 || !files[0]) {
    throw new FileUploadError('No files uploaded');
  }

  const uploadedFiles = [];

  try {
    for (const file of files) {
      if (!file) continue;

      const fileInfo = getFileInfo(file);
      
      const fileDoc = new File({
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        mimetype: fileInfo.mimetype,
        size: fileInfo.size,
        path: fileInfo.path,
        issueId,
        uploadedBy: req.user._id
      });

      await fileDoc.save();
      await fileDoc.populate('uploadedBy', 'firstName lastName email');
      
      uploadedFiles.push(fileDoc);
    }

    logger.info(`${uploadedFiles.length} file(s) uploaded to issue ${issueId} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: { files: uploadedFiles }
    });

  } catch (error) {
    // Clean up uploaded files on error
    for (const file of files) {
      if (file) {
        cleanupUploadedFile(file.path);
      }
    }
    throw error;
  }
});

/**
 * Get files for a specific issue
 */
export const getFilesForIssue = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { issueId } = req.params;

  // Check if issue exists
  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new NotFoundError('Issue');
  }

  const files = await (File as any).getFilesForIssue(issueId);

  res.json({
    success: true,
    message: 'Files retrieved successfully',
    data: { files }
  });
});

/**
 * Download a specific file
 */
export const downloadFile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const file = await File.findById(id);
  if (!file) {
    throw new NotFoundError('File');
  }

  // Check if file exists on disk
  if (!file.fileExists()) {
    throw new NotFoundError('File not found on disk');
  }

  const filePath = path.resolve(file.path);
  
  // Set appropriate headers
  res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
  res.setHeader('Content-Type', file.mimetype);
  res.setHeader('Content-Length', file.size.toString());

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  
  fileStream.on('error', (error) => {
    logger.error(`Error streaming file ${id}:`, error);
    throw new NotFoundError('File could not be read');
  });

  fileStream.pipe(res);

  logger.info(`File downloaded: ${file.originalName} (${id})`);
});

/**
 * Get file metadata by ID
 */
export const getFileById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const file = await File.findById(id)
    .populate('uploadedBy', 'firstName lastName email')
    .populate('issueId', 'title');

  if (!file) {
    throw new NotFoundError('File');
  }

  res.json({
    success: true,
    message: 'File information retrieved successfully',
    data: { file }
  });
});

/**
 * Delete a file
 */
export const deleteFile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { id } = req.params;

  const file = await File.findById(id);
  if (!file) {
    throw new NotFoundError('File');
  }

  // Check if user has permission to delete the file
  const issue = await Issue.findById(file.issueId);
  const canDelete = file.uploadedBy.toString() === req.user._id.toString() ||
                    (issue && issue.createdBy.toString() === req.user._id.toString());

  if (!canDelete) {
    throw new AuthorizationError('You can only delete files you uploaded or files from your issues');
  }

  // Delete file from database (middleware will handle disk cleanup)
  await File.findByIdAndDelete(id);

  logger.info(`File deleted: ${file.originalName} (${id}) by ${req.user.email}`);

  res.json({
    success: true,
    message: 'File deleted successfully'
  });
});

/**
 * Get files uploaded by current user
 */
export const getMyFiles = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ValidationError('User authentication required');
  }

  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());

  const [files, total] = await Promise.all([
    File.find({ uploadedBy: req.user._id })
      .populate('issueId', 'title status')
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit.toString()))
      .lean(),
    File.countDocuments({ uploadedBy: req.user._id })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit.toString()));

  res.json({
    success: true,
    message: 'Your files retrieved successfully',
    data: { files },
    pagination: {
      page: parseInt(page.toString()),
      limit: parseInt(limit.toString()),
      total,
      pages: totalPages,
      hasNext: parseInt(page.toString()) < totalPages,
      hasPrev: parseInt(page.toString()) > 1
    }
  });
});

/**
 * Get file statistics
 */
export const getFileStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const stats = await File.aggregate([
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$size' },
        avgSize: { $avg: '$size' }
      }
    }
  ]);

  const mimeTypeStats = await File.aggregate([
    {
      $group: {
        _id: '$mimetype',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    message: 'File statistics retrieved successfully',
    data: {
      overall: stats[0] || { totalFiles: 0, totalSize: 0, avgSize: 0 },
      byMimeType: mimeTypeStats
    }
  });
});

/**
 * Validate file integrity (check if files exist on disk)
 */
export const validateFileIntegrity = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { issueId } = req.params;

  const files = await File.find({ issueId });
  const results = [];

  for (const file of files) {
    const exists = file.fileExists();
    results.push({
      fileId: file._id,
      filename: file.originalName,
      exists,
      size: file.size,
      uploadedAt: file.uploadedAt
    });
  }

  const missingCount = results.filter(r => !r.exists).length;

  res.json({
    success: true,
    message: 'File integrity check completed',
    data: {
      totalFiles: results.length,
      existingFiles: results.length - missingCount,
      missingFiles: missingCount,
      files: results
    }
  });
});