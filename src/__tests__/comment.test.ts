// src/__tests__/comments.test.ts

import request from 'supertest';
import app from '../app';
import { Comment } from '../models/Comment';
import { 
  createTestUsers,
  createTestIssue,
  createTestComment,
  getAuthHeader,
  createCommentViaAPI,
  assertErrorResponse,
  assertSuccessResponse,
  assertPaginationStructure
} from './utils/testHelpers';

describe('Comments API', () => {
  let users: any;
  let testIssue: any;

  beforeEach(async () => {
    users = await createTestUsers();
    testIssue = await createTestIssue(users.user1._id);
  });

  describe('GET /api/comments/issue/:issueId', () => {
    beforeEach(async () => {
      // Create test comments
      await createTestComment(testIssue._id, users.user1._id, 'First comment');
      await createTestComment(testIssue._id, users.user2._id, 'Second comment');
      await createTestComment(testIssue._id, users.user1._id, 'Third comment');
    });

    it('should get comments for a specific issue', async () => {
      const response = await request(app)
        .get(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      assertPaginationStructure(response);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.data.every((comment: any) => 
        comment.issueId === testIssue._id
      )).toBe(true);
    });

    it('should paginate comments correctly', async () => {
      const response = await request(app)
        .get(`/api/comments/issue/${testIssue._id}?page=1&limit=2`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.pagination.limit).toBe(2);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.total).toBe(3);
    });

    it('should not get comments for non-existent issue', async () => {
      const response = await request(app)
        .get('/api/comments/issue/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should not get comments without authentication', async () => {
      const response = await request(app)
        .get(`/api/comments/issue/${testIssue._id}`);

      assertErrorResponse(response, 401);
    });

    it('should populate user information', async () => {
      const response = await request(app)
        .get(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data[0].userId).toHaveProperty('firstName');
      expect(response.body.data[0].userId).toHaveProperty('lastName');
      expect(response.body.data[0].userId).toHaveProperty('email');
    });
  });

  describe('POST /api/comments/issue/:issueId', () => {
    it('should create a new comment successfully', async () => {
      const commentData = {
        content: 'This is a test comment'
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertSuccessResponse(response, 201);
      expect(response.body.data.comment.content).toBe(commentData.content);
      expect(response.body.data.comment.issueId).toBe(testIssue._id);
      expect(response.body.data.comment.userId._id).toBe(users.user1._id);
    });

    it('should not create comment without authentication', async () => {
      const commentData = {
        content: 'Unauthorized comment'
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .send(commentData);

      assertErrorResponse(response, 401);
    });

    it('should not create comment for non-existent issue', async () => {
      const commentData = {
        content: 'Comment on non-existent issue'
      };

      const response = await request(app)
        .post('/api/comments/issue/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertErrorResponse(response, 404);
    });

    it('should not create empty comment', async () => {
      const commentData = {
        content: ''
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertErrorResponse(response, 400);
    });

    it('should not create comment exceeding length limit', async () => {
      const commentData = {
        content: 'A'.repeat(1001) // Exceeds 1000 character limit
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('1000 characters');
    });

    it('should update issue comments array when comment is created', async () => {
      const commentData = {
        content: 'Test comment for array update'
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertSuccessResponse(response, 201);

      // Check if issue's comments array is updated
      const issueResponse = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(issueResponse.body.data.issue.comments).toContain(response.body.data.comment._id);
    });
  });

  describe('GET /api/comments/:id', () => {
    let testComment: any;

    beforeEach(async () => {
      testComment = await createTestComment(testIssue._id, users.user1._id);
    });

    it('should get specific comment by ID', async () => {
      const response = await request(app)
        .get(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.comment._id).toBe(testComment._id.toString());
      expect(response.body.data.comment.content).toBe(testComment.content);
    });

    it('should not get non-existent comment', async () => {
      const response = await request(app)
        .get('/api/comments/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should populate user and issue information', async () => {
      const response = await request(app)
        .get(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.comment.userId).toHaveProperty('firstName');
      expect(response.body.data.comment.issueId).toHaveProperty('title');
    });
  });

  describe('PUT /api/comments/:id', () => {
    let testComment: any;

    beforeEach(async () => {
      testComment = await createTestComment(testIssue._id, users.user1._id);
    });

    it('should update own comment successfully', async () => {
      const updateData = {
        content: 'Updated comment content'
      };

      const response = await request(app)
        .put(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(updateData);

      assertSuccessResponse(response, 200);
      expect(response.body.data.comment.content).toBe(updateData.content);
    });

    it('should not update comment of another user', async () => {
      const updateData = {
        content: 'Unauthorized update'
      };

      const response = await request(app)
        .put(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user2.accessToken))
        .send(updateData);

      assertErrorResponse(response, 403);
    });

    it('should not update with invalid content', async () => {
      const updateData = {
        content: '' // Empty content
      };

      const response = await request(app)
        .put(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(updateData);

      assertErrorResponse(response, 400);
    });

    it('should not update non-existent comment', async () => {
      const updateData = {
        content: 'Update non-existent'
      };

      const response = await request(app)
        .put('/api/comments/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken))
        .send(updateData);

      assertErrorResponse(response, 404);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    let testComment: any;

    beforeEach(async () => {
      testComment = await createTestComment(testIssue._id, users.user1._id);
    });

    it('should delete own comment successfully', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);

      // Verify comment is deleted
      const getResponse = await request(app)
        .get(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(getResponse.status).toBe(404);
    });

    it('should allow issue creator to delete any comment on their issue', async () => {
      // Create comment by user2 on user1's issue
      const user2Comment = await createTestComment(testIssue._id, users.user2._id);

      const response = await request(app)
        .delete(`/api/comments/${user2Comment._id}`)
        .set(getAuthHeader(users.user1.accessToken)); // Issue creator

      assertSuccessResponse(response, 200);
    });

    it('should not delete comment without permission', async () => {
      // Create issue by admin, comment by user1, try to delete with user2
      const adminIssue = await createTestIssue(users.admin._id);
      const user1Comment = await createTestComment(adminIssue._id, users.user1._id);

      const response = await request(app)
        .delete(`/api/comments/${user1Comment._id}`)
        .set(getAuthHeader(users.user2.accessToken));

      assertErrorResponse(response, 403);
    });

    it('should not delete non-existent comment', async () => {
      const response = await request(app)
        .delete('/api/comments/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should remove comment from issue comments array when deleted', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);

      // Check if comment is removed from issue's comments array
      const issueResponse = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(issueResponse.body.data.issue.comments).not.toContain(testComment._id.toString());
    });
  });

  describe('GET /api/comments/my-comments', () => {
    beforeEach(async () => {
      // Create comments by user1
      await createTestComment(testIssue._id, users.user1._id, 'User1 comment 1');
      await createTestComment(testIssue._id, users.user1._id, 'User1 comment 2');
      
      // Create comment by user2
      await createTestComment(testIssue._id, users.user2._id, 'User2 comment');
    });

    it('should get comments by current user', async () => {
      const response = await request(app)
        .get('/api/comments/my-comments')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      assertPaginationStructure(response);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data.every((comment: any) => 
        comment.userId === users.user1._id
      )).toBe(true);
    });

    it('should paginate user comments', async () => {
      const response = await request(app)
        .get('/api/comments/my-comments?page=1&limit=1')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.data.length).toBe(1);
    });

    it('should populate issue information', async () => {
      const response = await request(app)
        .get('/api/comments/my-comments')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data[0].issueId).toHaveProperty('title');
      expect(response.body.data[0].issueId).toHaveProperty('status');
    });
  });

  describe('GET /api/comments/recent', () => {
    beforeEach(async () => {
      // Create multiple comments with slight delays to test ordering
      await createTestComment(testIssue._id, users.user1._id, 'Oldest comment');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createTestComment(testIssue._id, users.user2._id, 'Middle comment');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createTestComment(testIssue._id, users.admin._id, 'Newest comment');
    });

    it('should get recent comments across all issues', async () => {
      const response = await request(app)
        .get('/api/comments/recent?limit=5')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      
      // Should be ordered by creation time (newest first)
      if (response.body.data.length > 1) {
        const first = new Date(response.body.data[0].createdAt);
        const second = new Date(response.body.data[1].createdAt);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });

    it('should limit number of recent comments', async () => {
      const response = await request(app)
        .get('/api/comments/recent?limit=2')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should populate user and issue information', async () => {
      const response = await request(app)
        .get('/api/comments/recent')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].userId).toHaveProperty('firstName');
        expect(response.body.data[0].issueId).toHaveProperty('title');
      }
    });
  });

  describe('Comment Validation', () => {
    it('should validate comment content length', async () => {
      const commentData = {
        content: 'A'.repeat(1001) // Exceeds max length
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('1000 characters');
    });

    it('should validate required content field', async () => {
      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send({});

      assertErrorResponse(response, 400);
    });

    it('should trim whitespace from content', async () => {
      const commentData = {
        content: '  Trimmed content  '
      };

      const response = await request(app)
        .post(`/api/comments/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken))
        .send(commentData);

      assertSuccessResponse(response, 201);
      expect(response.body.data.comment.content).toBe('Trimmed content');
    });
  });
});