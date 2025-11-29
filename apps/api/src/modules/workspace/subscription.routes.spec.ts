import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';

describe('Subscription endpoints', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let testUserToken: string;
  let testWorkspaceId: string;
  let createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    app = await buildAppForTest();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: `subscription-test-user-${Date.now()}@example.com`,
        name: 'Subscription Test User',
        emailVerified: new Date(),
        locale: 'en',
        timezone: 'UTC',
      },
    });
    testUserId = testUser.id;

    // Create a test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Subscription Test Workspace',
        slug: `subscription-ws-${Date.now()}`,
      },
    });
    testWorkspaceId = workspace.id;
    createdWorkspaceIds.push(testWorkspaceId);

    // Add user as OWNER member
    await prisma.workspaceMember.create({
      data: {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        role: 'OWNER',
        joinedAt: new Date(),
      },
    });

    // Create default roles for workspace
    await prisma.role.createMany({
      data: [
        {
          workspaceId: testWorkspaceId,
          key: 'workspace-owner',
          name: 'Workspace Owner',
          builtIn: true,
        },
        {
          workspaceId: testWorkspaceId,
          key: 'workspace-admin',
          name: 'Workspace Admin',
          builtIn: true,
        },
      ],
    });

    // Create permissions
    await prisma.permission.createMany({
      data: [
        {
          key: 'workspace:settings.manage',
          description: 'Manage workspace settings',
        },
      ],
      skipDuplicates: true,
    });

    // Grant permission to owner role
    const ownerRole = await prisma.role.findFirst({
      where: { workspaceId: testWorkspaceId, key: 'workspace-owner' },
    });
    const permission = await prisma.permission.findUnique({
      where: { key: 'workspace:settings.manage' },
    });

    if (ownerRole && permission) {
      await prisma.rolePermission.create({
        data: {
          roleId: ownerRole.id,
          permissionId: permission.id,
        },
      });
    }

    // Create token with workspace context
    testUserToken = tokenService.signAccessToken({ 
      sub: testUser.id,
      wid: testWorkspaceId,
    });
  });

  afterEach(async () => {
    // Cleanup subscriptions
    await prisma.subscription.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

    // Cleanup workspace members
    await prisma.workspaceMember.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

    // Cleanup role permissions
    await prisma.rolePermission.deleteMany({}).catch(() => {});

    // Cleanup roles
    await prisma.role.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

    // Cleanup subscriptions
    await prisma.subscription.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

    // Cleanup workspaces
    for (const wsId of createdWorkspaceIds) {
      await prisma.workspace.delete({ where: { id: wsId } }).catch(() => {});
    }

    // Cleanup test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  describe('GET /v1/workspace/subscription (deprecated)', () => {
    it('should return 400 without X-Workspace-Id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/workspace/subscription',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_ID_REQUIRED');
    });

    it('should return 404 when subscription not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/workspace/subscription',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });

    it('should return 200 with subscription data', async () => {
      // Create subscription
      await prisma.subscription.create({
        data: {
          workspaceId: testWorkspaceId,
          plan: 'PRO',
          status: 'ACTIVE',
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/workspace/subscription',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('workspaceId', testWorkspaceId);
      expect(body.data).toHaveProperty('plan', 'PRO');
      expect(body.data).toHaveProperty('status', 'ACTIVE');
      expect(body.data).toHaveProperty('renewsAt');
      
      // Check deprecation headers
      expect(response.headers['deprecation']).toBe('true');
      expect(response.headers['link']).toContain('workspaces/:workspaceId/subscription');
    });
  });

  describe('GET /v1/workspaces/:workspaceId/subscription', () => {
    it('should return 400 without X-Workspace-Id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_ID_REQUIRED');
    });

    it('should return 403 when workspace ID mismatch', async () => {
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-ws-${Date.now()}`,
        },
      });
      createdWorkspaceIds.push(otherWorkspace.id);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': otherWorkspace.id,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_MISMATCH');
    });

    it('should return 200 with null when subscription not found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });

    it('should return 200 with subscription data when exists', async () => {
      // Create subscription
      const subscription = await prisma.subscription.create({
        data: {
          workspaceId: testWorkspaceId,
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id', subscription.id);
      expect(body.data).toHaveProperty('workspaceId', testWorkspaceId);
      expect(body.data).toHaveProperty('plan', 'ENTERPRISE');
      expect(body.data).toHaveProperty('status', 'ACTIVE');
    });
  });

  describe('PUT /v1/workspaces/:workspaceId/subscription', () => {
    it('should return 400 without X-Workspace-Id header', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          plan: 'PRO',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_ID_REQUIRED');
    });

    it('should return 403 when workspace ID mismatch', async () => {
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-ws-${Date.now()}`,
        },
      });
      createdWorkspaceIds.push(otherWorkspace.id);

      const response = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': otherWorkspace.id,
        },
        payload: {
          plan: 'PRO',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_MISMATCH');
    });

    it('should create subscription when it does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
        payload: {
          plan: 'PRO',
          status: 'ACTIVE',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id');
      expect(body.data).toHaveProperty('workspaceId', testWorkspaceId);
      expect(body.data).toHaveProperty('plan', 'PRO');
      expect(body.data).toHaveProperty('status', 'ACTIVE');
    });

    it('should update subscription when it exists', async () => {
      // Create initial subscription
      const subscription = await prisma.subscription.create({
        data: {
          workspaceId: testWorkspaceId,
          plan: 'FREE',
          status: 'ACTIVE',
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
        payload: {
          plan: 'ENTERPRISE',
          status: 'ACTIVE',
          periodStart: new Date().toISOString(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('id', subscription.id);
      expect(body.data).toHaveProperty('plan', 'ENTERPRISE');
      expect(body.data).toHaveProperty('status', 'ACTIVE');
      expect(body.data).toHaveProperty('periodStart');
      expect(body.data).toHaveProperty('periodEnd');
    });

    it('should handle cancelAt field', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
        payload: {
          plan: 'PRO',
          status: 'CANCELED',
          cancelAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('status', 'CANCELED');
      expect(body.data).toHaveProperty('cancelAt');
    });

    it('should return 400 for invalid plan', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${testWorkspaceId}/subscription`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
        payload: {
          plan: 'INVALID_PLAN',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });
});

