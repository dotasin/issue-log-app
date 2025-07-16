// src/__tests__/auth.test.ts

import request from 'supertest';
import app from '../app';
import { User } from '../models/User';
import { 
  testUsers, 
  createTestUser, 
  getAuthHeader,
  assertErrorResponse,
  assertSuccessResponse 
} from './utils/testHelpers';

describe('Authentication API', () => {
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUsers.user1);

      assertSuccessResponse(response, 201);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testUsers.user1.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should not register user with invalid email', async () => {
      const invalidUser = { ...testUsers.user1, email: 'invalid-email' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('valid email');
    });

    it('should not register user with weak password', async () => {
      const weakPasswordUser = { ...testUsers.user1, password: '123' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('6 characters');
    });

    it('should not register user with duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(testUsers.user1);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUsers.user1);

      assertErrorResponse(response, 409);
      expect(response.body.error.message).toContain('already exists');
    });

    it('should not register user with missing required fields', async () => {
      const incompleteUser = { email: 'test@example.com' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteUser);

      assertErrorResponse(response, 400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      await createTestUser();
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.user1.email,
          password: testUsers.user1.password
        });

      assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testUsers.user1.email);
    });

    it('should not login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUsers.user1.password
        });

      assertErrorResponse(response, 401);
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.user1.email,
          password: 'wrongpassword'
        });

      assertErrorResponse(response, 401);
      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('should not login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      assertErrorResponse(response, 400);
    });
  });

  describe('GET /api/auth/profile', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set(getAuthHeader(testUser.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      assertErrorResponse(response, 401);
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set(getAuthHeader('invalid-token'));

      assertErrorResponse(response, 401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set(getAuthHeader(testUser.accessToken))
        .send(updateData);

      assertSuccessResponse(response, 200);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
    });

    it('should not update profile without authentication', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ firstName: 'Updated' });

      assertErrorResponse(response, 401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: testUsers.user1.password,
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set(getAuthHeader(testUser.accessToken))
        .send(passwordData);

      assertSuccessResponse(response, 200);

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: passwordData.newPassword
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should not change password with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set(getAuthHeader(testUser.accessToken))
        .send(passwordData);

      assertErrorResponse(response, 401);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: testUser.refreshToken });

      assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.accessToken).not.toBe(testUser.accessToken);
    });

    it('should not refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-refresh-token' });

      assertErrorResponse(response, 401);
    });
  });

  describe('GET /api/auth/verify-token', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should verify valid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .set(getAuthHeader(testUser.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should not verify invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-token')
        .set(getAuthHeader('invalid-token'));

      assertErrorResponse(response, 401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set(getAuthHeader(testUser.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.message).toContain('Logout successful');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on registration', async () => {
      const requests = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 6; i++) {
        const userData = {
          ...testUsers.user1,
          email: `test${i}@example.com`
        };
        requests.push(
          request(app)
            .post('/api/auth/register')
            .send(userData)
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have at least one rate limited response
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});