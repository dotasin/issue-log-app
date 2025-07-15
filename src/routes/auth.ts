// src/routes/auth.ts

import { Router } from 'express';
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken,
  logout,
  verifyToken
} from '../controllers/authController';
import { authenticate, authRateLimit } from '../middleware/auth';
import {
  validateRegister,
  validateLogin,
  validate,
  schemas
} from '../middleware/validation';
import Joi from 'joi';

const router = Router();

// Public routes with rate limiting
router.post('/register', authRateLimit(), validateRegister, register);
router.post('/login', authRateLimit(), validateLogin, login);
router.post('/refresh-token', authRateLimit(10, 15 * 60 * 1000), refreshToken);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/profile', getProfile);
router.put('/profile', 
  validate(schemas.register.fork(['email', 'password'], (schema) => schema.optional())), 
  updateProfile
);
router.post('/change-password',
  validate(Joi.object({
    currentPassword: schemas.register.extract('password').required(),
    newPassword: schemas.register.extract('password').required()
  })),
  changePassword
);
router.post('/logout', logout);
router.get('/verify-token', verifyToken);

export default router;