import request from 'supertest';
import app from '../app';
import { Issue } from '../models/Issue';
import { createTestUsers, createTestIssue, getAuthHeader, createIssueViaAPI, assertErrorResponse, assertSuccessResponse, assertPaginationStructure } from './utils/testHelpers';

describe('Issues API', () => {
  let users: any;

  beforeEach(async () => {
    users = await createTestUsers();
  });

  describe('GET /api/issues', () => {
    beforeEach(async () => {
      // Create test issues
      await createTestIssue(users.user1._id);
      await createTestIssue(users.user2._id, users.user1._id);
      await createTestIssue(users.admin._id);
    });

    it('should get all issues with pagination', async () => {
      const response = await request(app)
        .get('/api/issues?page=1&limit=10')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      assertPaginationStructure(response);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter issues by status', async () => {
      // Create a completed issue
      const completedIssue = await createTestIssue(users.user1._id);
      await Issue.findByIdAndUpdate(completedIssue._id, { status: 'complete' });

      const response = await request(app)
        .get('/api/issues?status=complete')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.every((issue: any) => issue.status === 'complete')).toBe(true);
    });

    it('should filter issues by priority', async () => {
      const response = await request(app)
        .get('/api/issues?priority=medium')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.every((issue: any) => issue.priority === 'medium')).toBe(true);
    });

    it('should search issues by title and description', async () => {
      // Create issue with specific content
      await createIssueViaAPI(users.user1.accessToken, {
        title: 'Unique Search Term Bug',
        description: 'This has a unique description',
        priority: 'high'
      });

      const response = await request(app)
        .get('/api/issues?search=Unique')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.some((issue: any) => 
        issue.title.includes('Unique') || issue.description.includes('unique')
      )).toBe(true);
    });

    it('should not get issues without authentication', async () => {
      const response = await request(app)
        .get('/api/issues');

      assertErrorResponse(response, 401);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/issues?page=1&limit=2')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('POST /api/issues', () => {
    it('should create a new issue successfully', async () => {
      const issueData = {
        title: 'New Test Issue',
        description: 'This is a new test issue',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(issueData);

      assertSuccessResponse(response, 201);
      expect(response.body.data.issue.title).toBe(issueData.title);
      expect(response.body.data.issue.description).toBe(issueData.description);
      expect(response.body.data.issue.priority).toBe(issueData.priority);
      expect(response.body.data.issue.status).toBe('pending');
      expect(response.body.data.issue.createdBy._id).toBe(users.user1._id);
    });

    it('should create issue with assignment', async () => {
      const issueData = {
        title: 'Assigned Issue',
        description: 'This issue is assigned',
        priority: 'medium',
        assignedTo: users.user2._id
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(issueData);

      assertSuccessResponse(response, 201);
      expect(response.body.data.issue.assignedTo._id).toBe(users.user2._id);
    });

    it('should not create issue without authentication', async () => {
      const issueData = {
        title: 'Unauthorized Issue',
        description: 'This should not be created',
        priority: 'low'
      };

      const response = await request(app)
        .post('/api/issues')
        .send(issueData);

      assertErrorResponse(response, 401);
    });

    it('should not create issue with invalid data', async () => {
      const invalidIssueData = {
        priority: 'invalid-priority'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(invalidIssueData);

      assertErrorResponse(response, 400);
    });

    it('should not create issue with non-existent assigned user', async () => {
      const issueData = {
        title: 'Invalid Assignment',
        description: 'Assigned to non-existent user',
        priority: 'low',
        assignedTo: '507f1f77bcf86cd799439011' // Non-existent ObjectId
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(issueData);

      assertErrorResponse(response, 400);
    });
  });

  describe('GET /api/issues/:id', () => {
    let testIssue: any;

    beforeEach(async () => {
      testIssue = await createTestIssue(users.user1._id);
    });

    it('should get specific issue by ID', async () => {
      const response = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.issue._id).toBe(testIssue._id);
      expect(response.body.data.issue.title).toBe(testIssue.title);
    });

    it('should not get non-existent issue', async () => {
      const response = await request(app)
        .get('/api/issues/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should not get issue with invalid ID format', async () => {
      const response = await request(app)
        .get('/api/issues/invalid-id')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 400);
    });
  });

  describe('PUT /api/issues/:id', () => {
    let testIssue: any;

    beforeEach(async () => {
      testIssue = await createTestIssue(users.user1._id);
    });

    it('should update own issue successfully', async () => {
      const updateData = {
        title: 'Updated Issue Title',
        description: 'Updated description',
        priority: 'high'
      };

      const response = await request(app)
        .put(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(updateData);

      assertSuccessResponse(response, 200);
      expect(response.body.data.issue.title).toBe(updateData.title);
      expect(response.body.data.issue.description).toBe(updateData.description);
      expect(response.body.data.issue.priority).toBe(updateData.priority);
    });

    it('should update assigned issue successfully', async () => {
      // Create issue assigned to user2
      const assignedIssue = await createTestIssue(users.user1._id, users.user2._id);
      
      const updateData = { title: 'Updated by Assignee' };

      const response = await request(app)
        .put(`/api/issues/${assignedIssue._id}`)
        .set(getAuthHeader(users.user2.accessToken))
        .send(updateData);

      assertSuccessResponse(response, 200);
      expect(response.body.data.issue.title).toBe(updateData.title);
    });

    it('should not update issue without permission', async () => {
      const updateData = { title: 'Unauthorized Update' };

      const response = await request(app)
        .put(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user2.accessToken))
        .send(updateData);

      assertErrorResponse(response, 403);
    });

    it('should not update non-existent issue', async () => {
      const response = await request(app)
        .put('/api/issues/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken))
        .send({ title: 'Update Non-existent' });

      assertErrorResponse(response, 404);
    });
  });

  describe('PATCH /api/issues/:id/status', () => {
    let testIssue: any;

    beforeEach(async () => {
      testIssue = await createTestIssue(users.user1._id);
    });

    it('should update issue status successfully', async () => {
      const response = await request(app)
        .patch(`/api/issues/${testIssue._id}/status`)
        .set(getAuthHeader(users.user1.accessToken))
        .send({ status: 'complete' });

      assertSuccessResponse(response, 200);
      expect(response.body.data.issue.status).toBe('complete');
    });

    it('should not update status with invalid value', async () => {
      const response = await request(app)
        .patch(`/api/issues/${testIssue._id}/status`)
        .set(getAuthHeader(users.user1.accessToken))
        .send({ status: 'invalid-status' });

      assertErrorResponse(response, 400);
    });

    it('should not update status without permission', async () => {
      const response = await request(app)
        .patch(`/api/issues/${testIssue._id}/status`)
        .set(getAuthHeader(users.user2.accessToken))
        .send({ status: 'complete' });

      assertErrorResponse(response, 403);
    });
  });

  describe('DELETE /api/issues/:id', () => {
    let testIssue: any;

    beforeEach(async () => {
      testIssue = await createTestIssue(users.user1._id);
    });

    it('should delete own issue successfully', async () => {
      const response = await request(app)
        .delete(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);

      // Verify issue is deleted
      const getResponse = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(getResponse.status).toBe(404);
    });

    it('should not delete issue created by another user', async () => {
      const response = await request(app)
        .delete(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user2.accessToken));

      assertErrorResponse(response, 403);
    });

    it('should not delete non-existent issue', async () => {
      const response = await request(app)
        .delete('/api/issues/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });
  });

  describe('GET /api/issues/my-assigned', () => {
    beforeEach(async () => {
      // Create issues assigned to user1
      await createTestIssue(users.user2._id, users.user1._id);
      await createTestIssue(users.admin._id, users.user1._id);
      // Create issue not assigned to user1
      await createTestIssue(users.user2._id);
    });

    it('should get issues assigned to current user', async () => {
      const response = await request(app)
        .get('/api/issues/my-assigned')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      assertPaginationStructure(response);
      expect(response.body.data.every((issue: any) => 
        issue.assignedTo._id === users.user1._id
      )).toBe(true);
    });

    it('should filter assigned issues by status', async () => {
      const response = await request(app)
        .get('/api/issues/my-assigned?status=pending')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.every((issue: any) => 
        issue.status === 'pending' && issue.assignedTo._id === users.user1._id
      )).toBe(true);
    });
  });

  describe('GET /api/issues/my-created', () => {
    beforeEach(async () => {
      // Create issues by user1
      await createTestIssue(users.user1._id);
      await createTestIssue(users.user1._id);
      // Create issue by another user
      await createTestIssue(users.user2._id);
    });

    it('should get issues created by current user', async () => {
      const response = await request(app)
        .get('/api/issues/my-created')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      assertPaginationStructure(response);
      expect(response.body.data.every((issue: any) => 
        issue.createdBy._id === users.user1._id
      )).toBe(true);
    });

    it('should filter created issues by status', async () => {
      const response = await request(app)
        .get('/api/issues/my-created?status=pending')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.every((issue: any) => 
        issue.status === 'pending' && issue.createdBy._id === users.user1._id
      )).toBe(true);
    });
  });

  describe('Issue Validation', () => {
    it('should validate title length', async () => {
      const longTitle = 'A'.repeat(201); // Exceeds max length
      const issueData = {
        title: longTitle,
        description: 'Valid description',
        priority: 'low'
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(issueData);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('200 characters');
    });

    it('should validate description length', async () => {
      const longDescription = 'A'.repeat(2001); // Exceeds max length
      const issueData = {
        title: 'Valid title',
        description: longDescription,
        priority: 'low'
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(issueData);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('2000 characters');
    });

    it('should validate priority values', async () => {
      const issueData = {
        title: 'Valid title',
        description: 'Valid description',
        priority: 'urgent' // Invalid priority
      };

      const response = await request(app)
        .post('/api/issues')
        .set(getAuthHeader(users.user1.accessToken))
        .send(issueData);

      assertErrorResponse(response, 400);
    });
  });

  describe('Issue Relationships', () => {
    it('should populate createdBy and assignedTo fields', async () => {
      const testIssue = await createTestIssue(users.user1._id, users.user2._id);

      const response = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.issue.createdBy).toHaveProperty('firstName');
      expect(response.body.data.issue.createdBy).toHaveProperty('lastName');
      expect(response.body.data.issue.assignedTo).toHaveProperty('firstName');
      expect(response.body.data.issue.assignedTo).toHaveProperty('lastName');
    });

    it('should include comment and file counts', async () => {
      const testIssue = await createTestIssue(users.user1._id);

      const response = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.issue).toHaveProperty('commentCount');
      expect(response.body.data.issue).toHaveProperty('fileCount');
    });
  });
});