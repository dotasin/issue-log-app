// src/types/index.ts

import { Request } from 'express';
import { Document } from 'mongoose';
import mongoose from 'mongoose';

// User related types
export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual properties
  fullName: string;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Issue related types
export interface IIssue extends Document {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'complete';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  comments?: mongoose.Types.ObjectId[];
  files?: mongoose.Types.ObjectId[];
  
  // Instance methods
  addComment(commentId: mongoose.Types.ObjectId): Promise<IIssue>;
  removeComment(commentId: mongoose.Types.ObjectId): Promise<IIssue>;
  addFile(fileId: mongoose.Types.ObjectId): Promise<IIssue>;
  removeFile(fileId: mongoose.Types.ObjectId): Promise<IIssue>;
}

// Comment related types
export interface IComment extends Document {
  _id: string;
  content: string;
  issueId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// File related types
export interface IFile extends Document {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  issueId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
  
  // Instance methods
  fileExists(): boolean;
  deleteFromDisk(): boolean;
}

// Request types
export interface AuthRequest extends Request {
  user?: IUser;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Query types
export interface IssueQueryParams {
  status?: 'pending' | 'complete';
  priority?: 'low' | 'medium' | 'high';
  assignedTo?: string;
  createdBy?: string;
  search?: string;
  page?: string;
  limit?: string;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Error types
export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

// File upload types
export interface FileUploadOptions {
  maxSize: number;
  allowedMimeTypes: string[];
  uploadDir: string;
}