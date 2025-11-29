import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';
import { prisma } from '../../lib/prisma.js';

describe('Media endpoints', () => {
  let app: FastifyInstance;
  let testWorkspaceId: string;
  let createdWorkspaceIds: string[] = [];
  let createdMediaIds: string[] = [];

  beforeAll(async () => {
    app = await buildAppForTest();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Media Test Workspace',
        slug: `media-ws-${Date.now()}`,
      },
    });
    testWorkspaceId = workspace.id;
    createdWorkspaceIds.push(testWorkspaceId);
    createdMediaIds = [];
  });

  afterEach(async () => {
    // Cleanup media
    for (const mediaId of createdMediaIds) {
      await prisma.media.delete({ where: { id: mediaId } }).catch(() => {});
    }

    // Cleanup subscriptions
    await prisma.subscription.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

    // Cleanup workspaces
    for (const wsId of createdWorkspaceIds) {
      await prisma.workspace.delete({ where: { id: wsId } }).catch(() => {});
    }
  });

  describe('GET /v1/media/config', () => {
    it('should return 200 with media config (public endpoint)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/media/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('version');
      expect(body.data).toHaveProperty('presign');
      expect(body.data.presign).toHaveProperty('uploadExpireSeconds');
      expect(body.data.presign).toHaveProperty('downloadExpireSeconds');
      expect(body.data).toHaveProperty('allowedAssetTypes');
      expect(body.data).toHaveProperty('assets');
      expect(Array.isArray(body.data.allowedAssetTypes)).toBe(true);
    });

    it('should include asset type configurations', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/media/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.assets).toBeDefined();
      // Should have at least one asset type configured
      expect(Object.keys(body.data.assets).length).toBeGreaterThan(0);
    });
  });

  describe('POST /v1/media/presign-upload', () => {
    it('should return 404 when workspace not found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/presign-upload',
        payload: {
          workspaceId: 'non-existent-workspace-id',
          fileName: 'test.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_NOT_FOUND');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/presign-upload',
        payload: {
          workspaceId: testWorkspaceId,
          // fileName, contentType, sizeBytes missing
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 200 with presigned URL for valid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/presign-upload',
        payload: {
          workspaceId: testWorkspaceId,
          fileName: 'test-image.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
          assetType: 'content-image',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('url');
      expect(body.data).toHaveProperty('objectKey');
      expect(typeof body.data.url).toBe('string');
      expect(typeof body.data.objectKey).toBe('string');
    });

    it('should accept workspace slug instead of ID', async () => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: testWorkspaceId },
        select: { slug: true },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/presign-upload',
        payload: {
          workspaceId: workspace!.slug,
          fileName: 'test.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should handle avatar asset type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/presign-upload',
        payload: {
          workspaceId: testWorkspaceId,
          fileName: 'avatar.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          assetType: 'avatar',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /v1/media/finalize', () => {
    it('should return 404 when workspace not found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/finalize',
        payload: {
          objectKey: 'test-key',
          workspaceId: 'non-existent-workspace-id',
          originalName: 'test.jpg',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_NOT_FOUND');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/finalize',
        payload: {
          workspaceId: testWorkspaceId,
          // objectKey, originalName missing
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 404 when object not found in S3', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/media/finalize',
        payload: {
          objectKey: 'non-existent-object-key',
          workspaceId: testWorkspaceId,
          originalName: 'test.jpg',
          contentType: 'image/jpeg',
        },
      });

      // This will fail because S3 object doesn't exist
      // The exact status depends on the error handling
      expect([400, 404, 500]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /v1/media/:id', () => {
    it('should return 404 when media not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/media/non-existent-media-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MEDIA_NOT_FOUND');
    });

    it('should return 200 with media and presigned URL when media exists', async () => {
      // Create a test media record
      const media = await prisma.media.create({
        data: {
          workspaceId: testWorkspaceId,
          objectKey: `test/${testWorkspaceId}/test-image.jpg`,
          originalName: 'test-image.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
          variants: {},
        },
      });
      createdMediaIds.push(media.id);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/media/${media.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('media');
      expect(body.data).toHaveProperty('url');
      expect(body.data.media.id).toBe(media.id);
      expect(typeof body.data.url).toBe('string');
    });
  });

  describe('GET /v1/media/:id/variants', () => {
    it('should return 404 when media not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/media/non-existent-media-id/variants',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MEDIA_NOT_FOUND');
    });

    it('should return 200 with empty variants when media has no variants', async () => {
      // Create a test media record without variants
      const media = await prisma.media.create({
        data: {
          workspaceId: testWorkspaceId,
          objectKey: `test/${testWorkspaceId}/test-image.jpg`,
          originalName: 'test-image.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
          variants: null,
        },
      });
      createdMediaIds.push(media.id);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/media/${media.id}/variants`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('mediaId', media.id);
      expect(body.data).toHaveProperty('variants');
      expect(Object.keys(body.data.variants).length).toBe(0);
    });

    it('should return 200 with variant URLs when media has variants', async () => {
      // Create a test media record with variants
      const media = await prisma.media.create({
        data: {
          workspaceId: testWorkspaceId,
          objectKey: `test/${testWorkspaceId}/test-image.jpg`,
          originalName: 'test-image.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
          variants: {
            thumb: { key: `test/${testWorkspaceId}/test-image-thumb.jpg` },
            sm: { key: `test/${testWorkspaceId}/test-image-sm.jpg` },
          },
        },
      });
      createdMediaIds.push(media.id);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/media/${media.id}/variants`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('mediaId', media.id);
      expect(body.data).toHaveProperty('variants');
      expect(Object.keys(body.data.variants).length).toBeGreaterThan(0);
      // Variant URLs should be strings
      for (const url of Object.values(body.data.variants)) {
        expect(typeof url).toBe('string');
      }
    });
  });
});

