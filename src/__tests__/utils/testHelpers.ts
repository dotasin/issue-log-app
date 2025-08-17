// src/__tests__/utils/testHelpers.ts

import request from 'supertest';
import app from '../../app';
import { User } from '../../models/User';
import { Issue } from '../../models/Issue';
import { Comment } from '../../models/Comment';
import { JWTUtils } from '../../utils/jwt';

export interface TestUser {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export interface TestIssue {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'complete';
  priority: 'low' | 'medium' | 'high';
  createdBy: string;
  assignedTo?: string;
}

export const testUsers = {
  user1: {
    email: 'test1@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe'
  },
  user2: {
    email: 'test2@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith'
  },
  admin: {
    email: 'admin@example.com',
    password: 'adminpass123',
    firstName: 'Admin',
    lastName: 'User'
  }
};

// Create a test user and return user data with tokens
export const createTestUser = async (userData = testUsers.user1): Promise<TestUser> => {
  const user = new User(userData);
  await user.save();

  const tokens = JWTUtils.generateTokens({
    userId: user._id,
    email: user.email
  });

  return {
    _id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    password: userData.password,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
};

// Create multiple test users
export const createTestUsers = async (): Promise<{
  user1: TestUser;
  user2: TestUser;
  admin: TestUser;
}> => {
  const user1 = await createTestUser(testUsers.user1);
  const user2 = await createTestUser(testUsers.user2);
  const admin = await createTestUser(testUsers.admin);

  return { user1, user2, admin };
};

// Create a test issue
export const createTestIssue = async (createdBy: string, assignedTo?: string): Promise<TestIssue> => {
  const issueData = {
    title: 'Test Issue',
    description: 'This is a test issue for testing purposes',
    priority: 'medium' as const,
    status: 'pending' as const,
    createdBy,
    ...(assignedTo && { assignedTo })
  };

  const issue = new Issue(issueData);
  await issue.save();

  return {
    _id: issue._id,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    createdBy: issue.createdBy.toString(),
    assignedTo: issue.assignedTo?.toString()
  };
};

// Create a test comment
export const createTestComment = async (issueId: string, userId: string, content = 'Test comment') => {
  const comment = new Comment({
    content,
    issueId,
    userId
  });
  await comment.save();
  return comment;
};

// Get authorization header for a user
export const getAuthHeader = (token: string) => ({
  Authorization: `Bearer ${token}`
});

// Register a user via API
export const registerUser = async (userData = testUsers.user1) => {
  return request(app)
    .post('/api/auth/register')
    .send(userData);
};

// Login a user via API
export const loginUser = async (email: string, password: string) => {
  return request(app)
    .post('/api/auth/login')
    .send({ email, password });
};

// Create an issue via API
export const createIssueViaAPI = async (token: string, issueData?: any) => {
  const defaultIssueData = {
    title: 'API Test Issue',
    description: 'Created via API for testing',
    priority: 'high'
  };

  return request(app)
    .post('/api/issues')
    .set(getAuthHeader(token))
    .send(issueData || defaultIssueData);
};

// Create a comment via API
export const createCommentViaAPI = async (token: string, issueId: string, content = 'Test comment via API') => {
  return request(app)
    .post(`/api/comments/issue/${issueId}`)
    .set(getAuthHeader(token))
    .send({ content });
};

// Upload a file via API (mock file)
export const uploadFileViaAPI = async (token: string, issueId: string) => {
  return request(app)
    .post(`/api/files/issue/${issueId}/upload`)
    .set(getAuthHeader(token))
    .attach('files', Buffer.from('test file content'), 'test.txt');
};

// Cleanup test data
export const cleanupTestData = async () => {
  await User.deleteMany({});
  await Issue.deleteMany({});
  await Comment.deleteMany({});
};

// Delay utility for testing async operations
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Assert pagination response structure
export const assertPaginationStructure = (response: any) => {
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('data');
  expect(response.body).toHaveProperty('pagination');
  expect(response.body.pagination).toHaveProperty('page');
  expect(response.body.pagination).toHaveProperty('limit');
  expect(response.body.pagination).toHaveProperty('total');
  expect(response.body.pagination).toHaveProperty('pages');
  expect(response.body.pagination).toHaveProperty('hasNext');
  expect(response.body.pagination).toHaveProperty('hasPrev');
};

// Assert error response structure
export const assertErrorResponse = (response: any, expectedStatus: number) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  expect(response.body.error).toHaveProperty('message');
  expect(response.body.error).toHaveProperty('statusCode', expectedStatus);
};

// Assert success response structure
export const assertSuccessResponse = (response: any, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('message');
};