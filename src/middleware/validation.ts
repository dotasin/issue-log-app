import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import { ValidationError } from '../utils/errorTypes';

//Creates a custom Joi extension 'objectId' that validates MongoDB ObjectId format - based on string type, uses mongoose.Types.ObjectId.isValid() 
//to check validity, and returns custom error message 'Invalid ObjectId format' if value is not a valid ObjectId
const customJoi = Joi.extend({
  type: 'objectId',
  base: Joi.string(),
  messages: {
    'objectId.invalid': 'Invalid ObjectId format'
  },
  validate(value, helpers) {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return { value, errors: helpers.error('objectId.invalid') };
    }
    return { value };
  }
});

//Validation schemas
//Defines Joi validation schemas for user registration/login, issue management (create/update/status), 
//and comment operations with custom error messages, field length limits, and MongoDB ObjectId validation using the custom extension
export const schemas = {
  // User schemas
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
    firstName: Joi.string().trim().max(50).required().messages({
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().trim().max(50).required().messages({
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  //Issue schemas
  createIssue: Joi.object({
    title: Joi.string().trim().max(200).required().messages({
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
    description: Joi.string().trim().max(2000).required().messages({
      'string.max': 'Description cannot exceed 2000 characters',
      'any.required': 'Description is required'
    }),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    assignedTo: customJoi.objectId().optional()
  }),

  updateIssue: Joi.object({
    title: Joi.string().trim().max(200).optional(),
    description: Joi.string().trim().max(2000).optional(),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    assignedTo: customJoi.objectId().optional().allow(null)
  }),

  updateIssueStatus: Joi.object({
    status: Joi.string().valid('pending', 'complete').required()
  }),

  //Comment schemas
  createComment: Joi.object({
    content: Joi.string().trim().min(1).max(1000).required().messages({
      'string.min': 'Comment cannot be empty',
      'string.max': 'Comment cannot exceed 1000 characters',
      'any.required': 'Comment content is required'
    })
  }),

  updateComment: Joi.object({
    content: Joi.string().trim().min(1).max(1000).required()
  }),

  //Query parameters
  issueQuery: Joi.object({
    status: Joi.string().valid('pending', 'complete').optional(),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    assignedTo: customJoi.objectId().optional(),
    createdBy: customJoi.objectId().optional(),
    search: Joi.string().trim().max(100).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  commentQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }),

  //Parameter validation
  objectIdParam: Joi.object({
    id: customJoi.objectId().required()
  }),

  issueIdParam: Joi.object({
    issueId: customJoi.objectId().required()
  })
};

//Validation middleware factory
//Creates a validation middleware factory that validates Express request data (body/query/params) against Joi schemas, 
//strips unknown fields, collects all validation errors,
//and passes a ValidationError to next() if validation fails, only replacing req.body with sanitized values while leaving query/params unchanged
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join('. ');
      
      next(new ValidationError(errorMessage));
      return;
    }

    // Only replace body since query and params are read-only in Express
    if (property === 'body') {
      req[property] = value;
    }
    // For query and params, we just validate but don't replace
    // The validated values are already parsed correctly by Express
    
    next();
  };
};

//Specific validation middleware
export const validateRegister = validate(schemas.register);
export const validateLogin = validate(schemas.login);
export const validateCreateIssue = validate(schemas.createIssue);
export const validateUpdateIssue = validate(schemas.updateIssue);
export const validateUpdateIssueStatus = validate(schemas.updateIssueStatus);
export const validateCreateComment = validate(schemas.createComment);
export const validateUpdateComment = validate(schemas.updateComment);
export const validateIssueQuery = validate(schemas.issueQuery, 'query');
export const validateCommentQuery = validate(schemas.commentQuery, 'query');
export const validateObjectIdParam = validate(schemas.objectIdParam, 'params');
export const validateIssueIdParam = validate(schemas.issueIdParam, 'params');

//Combined validation for routes with multiple validations
export const validateIssueRouteParams = [
  validate(schemas.issueIdParam, 'params'),
  validate(schemas.commentQuery, 'query')
];