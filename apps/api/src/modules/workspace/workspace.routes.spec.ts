import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';

describe('Workspace endpoints', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let testUserToken: string;
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
        email: `ws-test-user-${Date.now()}@example.com`,
        name: 'Workspace Test User',
        emailVerified: new Date(),
        locale: 'en',
        timezone: 'UTC',
      },
    });
    testUserId = testUser.id;
    testUserToken = tokenService.signAccessToken({ sub: testUser.id });
    createdWorkspaceIds = [];
  });

  afterEach(async () => {
    // Cleanup created workspaces (cascade deletes members, subscriptions, roles)
    for (const wsId of createdWorkspaceIds) {
      try {
        // Delete workspace members first
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: wsId } });
        // Delete subscriptions
        await prisma.subscription.deleteMany({ where: { workspaceId: wsId } });
        // Delete workspace roles (model name is Role, not WorkspaceRole)
        await prisma.role.deleteMany({ where: { workspaceId: wsId } });
        // Delete workspace
        await prisma.workspace.delete({ where: { id: wsId } });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Cleanup test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  describe('POST /v1/workspaces', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        payload: {
          name: 'Test Workspace',
          slug: `test-ws-${Date.now()}`,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should create workspace successfully with default FREE plan', async () => {
      const slug = `test-ws-${Date.now()}`;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'My Test Workspace',
          slug,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.workspace).toHaveProperty('id');
      expect(body.data.workspace.name).toBe('My Test Workspace');
      expect(body.data.workspace.slug).toBe(slug);
      expect(body.data.subscription).toHaveProperty('id');
      expect(body.data.subscription.plan).toBe('FREE');
      expect(body.data.subscription.status).toBe('ACTIVE');

      // Track for cleanup
      createdWorkspaceIds.push(body.data.workspace.id);
    });

    it('should create workspace with PRO plan', async () => {
      const slug = `pro-ws-${Date.now()}`;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'Pro Workspace',
          slug,
          plan: 'PRO',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.subscription.plan).toBe('PRO');

      createdWorkspaceIds.push(body.data.workspace.id);
    });

    it('should add creator as OWNER member', async () => {
      const slug = `owner-ws-${Date.now()}`;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'Owner Test',
          slug,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const workspaceId = body.data.workspace.id;
      createdWorkspaceIds.push(workspaceId);

      // Verify membership
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: testUserId,
        },
      });

      expect(member).toBeTruthy();
      expect(member?.role).toBe('OWNER');
    });

    it('should return 409 for duplicate slug', async () => {
      const slug = `duplicate-ws-${Date.now()}`;
      
      // Create first workspace with ENTERPRISE plan to bypass workspace limits
      const first = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'First Workspace',
          slug,
          plan: 'ENTERPRISE', // Use ENTERPRISE to allow multiple workspaces
        },
      });

      expect(first.statusCode).toBe(201);
      createdWorkspaceIds.push(JSON.parse(first.body).data.workspace.id);

      // Try to create second with same slug (also ENTERPRISE to bypass limits)
      const second = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'Second Workspace',
          slug,
          plan: 'ENTERPRISE',
        },
      });

      expect(second.statusCode).toBe(409);
      const body = JSON.parse(second.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_SLUG_EXISTS');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'Missing Slug',
          // slug is missing
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should create default workspace roles', async () => {
      const slug = `roles-ws-${Date.now()}`;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
        payload: {
          name: 'Roles Test',
          slug,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const workspaceId = body.data.workspace.id;
      createdWorkspaceIds.push(workspaceId);

      // Verify default roles were created (model name is Role, not WorkspaceRole)
      const roles = await prisma.role.findMany({
        where: { workspaceId },
      });

      expect(roles.length).toBeGreaterThan(0);
      const roleNames = roles.map(r => r.name);
      // Should have at least Workspace Owner role
      expect(roleNames).toContain('Workspace Owner');
    });
  });
});
