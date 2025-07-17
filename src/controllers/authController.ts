import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { JWTUtils } from '../utils/jwt';
import { AuthRequest } from '../types';
import { ValidationError, AuthenticationError, ConflictError } from '../utils/errorTypes';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';

//Register a new user
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password, firstName, lastName } = req.body;
  console.log('Registering user:', email);
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Create new user
  const user = new User({
    email,
    password,
    firstName,
    lastName
  });

  await user.save();

  // Generate tokens
  const tokens = JWTUtils.generateTokens({
    userId: user._id,
    email: user.email
  });

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        createdAt: user.createdAt
      }
    }
  });
});

//Login user
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const tokens = JWTUtils.generateTokens({
    userId: user._id,
    email: user.email
  });

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        createdAt: user.createdAt
      }
    }
  });
});

//Get current user profile
export const getProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        fullName: `${req.user.firstName} ${req.user.lastName}`,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    }
  });
});

//Update user profile
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const { firstName, lastName } = req.body;
  const updateData: any = {};

  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new AuthenticationError('User not found');
  }

  logger.info(`User profile updated: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        fullName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        updatedAt: updatedUser.updatedAt
      }
    }
  });
});

//Change password
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

//Refresh access token
export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Verify refresh token
  const payload = JWTUtils.verifyRefreshToken(refreshToken);

  // Find user
  const user = await User.findById(payload.userId);
  if (!user) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Generate new tokens
  const newTokens = JWTUtils.generateTokens({
    userId: user._id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Tokens refreshed successfully',
    data: {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken
    }
  });
});

//Logout user (client-side token removal)
export const logout = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  // In a stateless JWT system, logout is typically handled client-side
  // by removing the tokens from storage. However, we can log the action.
  
  if (req.user) {
    logger.info(`User logged out: ${req.user.email}`);
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Verify token endpoint
export const verifyToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthenticationError('Invalid token');
  }

  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }
    }
  });
});