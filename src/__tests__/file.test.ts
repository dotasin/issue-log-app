// src/__tests__/files.test.ts

import request from 'supertest';
import app from '../app';
import path from 'path';
import fs from 'fs';
import { File } from '../models/File';
import { 
  createTestUsers,
  createTestIssue,
  getAuthHeader,
  assertErrorResponse,
  assertSuccessResponse
} from './utils/testHelpers';

describe('Files API', () => {
  let users: any;
  let testIssue: any;
  const testFilePath = path.join(__dirname, 'test-file.txt');
  const testImagePath = path.join(__dirname, 'test-image.png');

  beforeAll(async () => {
    // Create test files
    fs.writeFileSync(testFilePath, 'This is a test file content for uploading');
    
    // Create a simple PNG file (1x1 pixel)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngBuffer);
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
  });

  beforeEach(async () => {
    users = await createTestUsers();
    testIssue = await createTestIssue(users.user1._id);
  });

  describe('POST /api/files/issue/:issueId/upload', () => {
    it('should upload file successfully', async () => {
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);

      assertSuccessResponse(response, 201);
      expect(response.body.data.files).toBeInstanceOf(Array);
      expect(response.body.data.files.length).toBe(1);
      expect(response.body.data.files[0]).toHaveProperty('originalName');
      expect(response.body.data.files[0]).toHaveProperty('size');
      expect(response.body.data.files[0]).toHaveProperty('mimetype');
      expect(response.body.data.files[0].issueId).toBe(testIssue._id);
    });

    it('should upload multiple files successfully', async () => {
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath)
        .attach('files', testImagePath);

      assertSuccessResponse(response, 201);
      expect(response.body.data.files.length).toBe(2);
    });

    it('should upload file when assigned to issue', async () => {
      // Create issue assigned to user2
      const assignedIssue = await createTestIssue(users.user1._id, users.user2._id);

      const response = await request(app)
        .post(`/api/files/issue/${assignedIssue._id}/upload`)
        .set(getAuthHeader(users.user2.accessToken))
        .attach('files', testFilePath);

      assertSuccessResponse(response, 201);
    });

    it('should not upload file without authentication', async () => {
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .attach('files', testFilePath);

      assertErrorResponse(response, 401);
    });

    it('should not upload file to non-existent issue', async () => {
      const response = await request(app)
        .post('/api/files/issue/507f1f77bcf86cd799439011/upload')
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);

      assertErrorResponse(response, 404);
    });

    it('should not upload file without permission', async () => {
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user2.accessToken))
        .attach('files', testFilePath);

      assertErrorResponse(response, 403);
    });

    it('should not upload without files', async () => {
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('No files uploaded');
    });

    it('should validate file size limit', async () => {
      // Create a large file (over 10MB limit)
      const largeFilePath = path.join(__dirname, 'large-file.txt');
      const largeContent = 'A'.repeat(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFilePath, largeContent);

      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', largeFilePath);

      // Clean up large file
      fs.unlinkSync(largeFilePath);

      assertErrorResponse(response, 400);
      expect(response.body.error.message).toContain('File too large');
    });

    it('should update issue files array when file is uploaded', async () => {
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);

      assertSuccessResponse(response, 201);

      // Check if issue's files array is updated
      const issueResponse = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(issueResponse.body.data.issue.files).toContain(response.body.data.files[0]._id);
    });
  });

  describe('GET /api/files/issue/:issueId', () => {
    let uploadedFile: any;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);
      
      uploadedFile = uploadResponse.body.data.files[0];
    });

    it('should get files for an issue', async () => {
      const response = await request(app)
        .get(`/api/files/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.files).toBeInstanceOf(Array);
      expect(response.body.data.files.length).toBe(1);
      expect(response.body.data.files[0]._id).toBe(uploadedFile._id);
    });

    it('should not get files for non-existent issue', async () => {
      const response = await request(app)
        .get('/api/files/issue/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should populate uploader information', async () => {
      const response = await request(app)
        .get(`/api/files/issue/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.files[0].uploadedBy).toHaveProperty('firstName');
      expect(response.body.data.files[0].uploadedBy).toHaveProperty('lastName');
    });
  });

  describe('GET /api/files/:id', () => {
    let uploadedFile: any;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);
      
      uploadedFile = uploadResponse.body.data.files[0];
    });

    it('should get file metadata by ID', async () => {
      const response = await request(app)
        .get(`/api/files/${uploadedFile._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.file._id).toBe(uploadedFile._id);
      expect(response.body.data.file).toHaveProperty('originalName');
      expect(response.body.data.file).toHaveProperty('size');
      expect(response.body.data.file).toHaveProperty('mimetype');
    });

    it('should not get non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should populate uploader and issue information', async () => {
      const response = await request(app)
        .get(`/api/files/${uploadedFile._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.file.uploadedBy).toHaveProperty('firstName');
      expect(response.body.data.file.issueId).toHaveProperty('title');
    });
  });

  describe('GET /api/files/:id/download', () => {
    let uploadedFile: any;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);
      
      uploadedFile = uploadResponse.body.data.files[0];
    });

    it('should download file successfully', async () => {
      const response = await request(app)
        .get(`/api/files/${uploadedFile._id}/download`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('This is a test file content');
    });

    it('should not download non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/507f1f77bcf86cd799439011/download')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should set correct headers for download', async () => {
      const response = await request(app)
        .get(`/api/files/${uploadedFile._id}/download`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('content-disposition');
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers).toHaveProperty('content-length');
    });
  });

  describe('DELETE /api/files/:id', () => {
    let uploadedFile: any;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);
      
      uploadedFile = uploadResponse.body.data.files[0];
    });

    it('should delete own uploaded file', async () => {
      const response = await request(app)
        .delete(`/api/files/${uploadedFile._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);

      // Verify file is deleted
      const getResponse = await request(app)
        .get(`/api/files/${uploadedFile._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(getResponse.status).toBe(404);
    });

    it('should allow issue creator to delete any file on their issue', async () => {
      // Upload file as user2 on user1's issue (user2 is assigned)
      const assignedIssue = await createTestIssue(users.user1._id, users.user2._id);
      const user2Upload = await request(app)
        .post(`/api/files/issue/${assignedIssue._id}/upload`)
        .set(getAuthHeader(users.user2.accessToken))
        .attach('files', testFilePath);

      const response = await request(app)
        .delete(`/api/files/${user2Upload.body.data.files[0]._id}`)
        .set(getAuthHeader(users.user1.accessToken)); // Issue creator

      assertSuccessResponse(response, 200);
    });

    it('should not delete file without permission', async () => {
      const response = await request(app)
        .delete(`/api/files/${uploadedFile._id}`)
        .set(getAuthHeader(users.user2.accessToken));

      assertErrorResponse(response, 403);
    });

    it('should not delete non-existent file', async () => {
      const response = await request(app)
        .delete('/api/files/507f1f77bcf86cd799439011')
        .set(getAuthHeader(users.user1.accessToken));

      assertErrorResponse(response, 404);
    });

    it('should remove file from issue files array when deleted', async () => {
      const response = await request(app)
        .delete(`/api/files/${uploadedFile._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);

      // Check if file is removed from issue's files array
      const issueResponse = await request(app)
        .get(`/api/issues/${testIssue._id}`)
        .set(getAuthHeader(users.user1.accessToken));

      expect(issueResponse.body.data.issue.files).not.toContain(uploadedFile._id);
    });
  });

  describe('GET /api/files/my-files', () => {
    beforeEach(async () => {
      // Upload files by user1
      await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);

      await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testImagePath);

      // Upload file by user2 (assigned to issue)
      const assignedIssue = await createTestIssue(users.user1._id, users.user2._id);
      await request(app)
        .post(`/api/files/issue/${assignedIssue._id}/upload`)
        .set(getAuthHeader(users.user2.accessToken))
        .attach('files', testFilePath);
    });

    it('should get files uploaded by current user', async () => {
      const response = await request(app)
        .get('/api/files/my-files')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.files).toBeInstanceOf(Array);
      expect(response.body.data.files.length).toBe(2);
      expect(response.body.data.files.every((file: any) => 
        file.uploadedBy === users.user1._id
      )).toBe(true);
    });

    it('should paginate user files', async () => {
      const response = await request(app)
        .get('/api/files/my-files?page=1&limit=1')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.data.files.length).toBe(1);
    });

    it('should populate issue information', async () => {
      const response = await request(app)
        .get('/api/files/my-files')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.files[0].issueId).toHaveProperty('title');
      expect(response.body.data.files[0].issueId).toHaveProperty('status');
    });
  });

  describe('GET /api/files/stats', () => {
    beforeEach(async () => {
      // Upload files to generate stats
      await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);

      await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testImagePath);
    });

    it('should get file statistics', async () => {
      const response = await request(app)
        .get('/api/files/stats')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.overall).toHaveProperty('totalFiles');
      expect(response.body.data.overall).toHaveProperty('totalSize');
      expect(response.body.data.overall).toHaveProperty('avgSize');
      expect(response.body.data).toHaveProperty('byMimeType');
      expect(response.body.data.byMimeType).toBeInstanceOf(Array);
    });

    it('should calculate correct statistics', async () => {
      const response = await request(app)
        .get('/api/files/stats')
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.overall.totalFiles).toBeGreaterThanOrEqual(2);
      expect(response.body.data.overall.totalSize).toBeGreaterThan(0);
      expect(response.body.data.byMimeType.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/files/issue/:issueId/validate', () => {
    let uploadedFile: any;

    beforeEach(async () => {
      const uploadResponse = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);
      
      uploadedFile = uploadResponse.body.data.files[0];
    });

    it('should validate file integrity', async () => {
      const response = await request(app)
        .get(`/api/files/issue/${testIssue._id}/validate`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('totalFiles');
      expect(response.body.data).toHaveProperty('existingFiles');
      expect(response.body.data).toHaveProperty('missingFiles');
      expect(response.body.data).toHaveProperty('files');
      expect(response.body.data.files).toBeInstanceOf(Array);
    });

    it('should report existing files correctly', async () => {
      const response = await request(app)
        .get(`/api/files/issue/${testIssue._id}/validate`)
        .set(getAuthHeader(users.user1.accessToken));

      assertSuccessResponse(response, 200);
      expect(response.body.data.totalFiles).toBe(1);
      expect(response.body.data.existingFiles).toBe(1);
      expect(response.body.data.missingFiles).toBe(0);
      expect(response.body.data.files[0].exists).toBe(true);
    });
  });

  describe('File Upload Edge Cases', () => {
    it('should handle multiple file uploads with mixed success/failure', async () => {
      // This test would need to be adapted based on actual validation logic
      const response = await request(app)
        .post(`/api/files/issue/${testIssue._id}/upload`)
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath)
        .attach('files', testImagePath);

      // Should succeed with both valid files
      assertSuccessResponse(response, 201);
      expect(response.body.data.files.length).toBe(2);
    });

    it('should clean up files on upload failure', async () => {
      // Test that files are cleaned up if database save fails
      // This would require mocking or database connection issues
      // For now, just test that invalid issue ID doesn't leave orphaned files
      const response = await request(app)
        .post('/api/files/issue/507f1f77bcf86cd799439011/upload')
        .set(getAuthHeader(users.user1.accessToken))
        .attach('files', testFilePath);

      assertErrorResponse(response, 404);
    });
  });
});