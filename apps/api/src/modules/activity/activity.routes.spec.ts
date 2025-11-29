import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTest } from '../../test/utils/build-app.js';
import { prisma } from '../../lib/prisma.js';
import { tokenService } from '../../core/auth/token.service.js';

describe('Activity endpoints', () => {
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
        email: `activity-test-user-${Date.now()}@example.com`,
        name: 'Activity Test User',
        emailVerified: new Date(),
        locale: 'en',
        timezone: 'UTC',
      },
    });
    testUserId = testUser.id;
    testUserToken = tokenService.signAccessToken({ 
      sub: testUser.id,
      wid: undefined, // Will be set per request
    });

    // Create a test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Activity Test Workspace',
        slug: `activity-ws-${Date.now()}`,
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
  });

  afterEach(async () => {
    // Cleanup activity events
    await prisma.activityEvent.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

    // Cleanup workspace members
    await prisma.workspaceMember.deleteMany({ 
      where: { workspaceId: testWorkspaceId } 
    }).catch(() => {});

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

  describe('GET /v1/workspaces/:workspaceId/activity', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return 400 without X-Workspace-Id header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('WORKSPACE_ID_REQUIRED');
    });

    it('should return 403 when X-Workspace-Id does not match param', async () => {
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-ws-${Date.now()}`,
        },
      });
      createdWorkspaceIds.push(otherWorkspace.id);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity`,
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

    it('should return 403 when user is not a workspace member', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: `other-user-${Date.now()}@example.com`,
          name: 'Other User',
          emailVerified: new Date(),
          locale: 'en',
          timezone: 'UTC',
        },
      });
      const otherUserToken = tokenService.signAccessToken({ sub: otherUser.id });

      try {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/workspaces/${testWorkspaceId}/activity`,
          headers: {
            Authorization: `Bearer ${otherUserToken}`,
            'X-Workspace-Id': testWorkspaceId,
          },
        });

        expect(response.statusCode).toBe(403);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
      } finally {
        await prisma.user.delete({ where: { id: otherUser.id } }).catch(() => {});
      }
    });

    it('should return 200 with empty array when no activity events', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.nextCursor).toBeNull();
    });

    it('should return activity events when they exist', async () => {
      // Create some activity events
      await prisma.activityEvent.createMany({
        data: [
          {
            workspaceId: testWorkspaceId,
            userId: testUserId,
            actorType: 'user',
            source: 'api',
            type: 'workspace.member_invited',
            scopeType: 'workspace',
            scopeId: testWorkspaceId,
          },
          {
            workspaceId: testWorkspaceId,
            userId: testUserId,
            actorType: 'user',
            source: 'api',
            type: 'workspace.created',
            scopeType: 'workspace',
            scopeId: testWorkspaceId,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThan(0);
      expect(body.data.items[0]).toHaveProperty('id');
      expect(body.data.items[0]).toHaveProperty('timestamp');
      expect(body.data.items[0]).toHaveProperty('type');
      expect(body.data.items[0]).toHaveProperty('title');
      expect(body.data.items[0]).toHaveProperty('summary');
    });

    it('should respect limit query parameter', async () => {
      // Create 5 activity events
      await prisma.activityEvent.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({
          workspaceId: testWorkspaceId,
          userId: testUserId,
          actorType: 'user',
          source: 'api',
          type: 'workspace.member_invited',
          scopeType: 'workspace',
          scopeId: testWorkspaceId,
        })),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity?limit=2`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeLessThanOrEqual(2);
    });

    it('should filter system events when includeSystemEvents=false', async () => {
      // Create both user and system events
      await prisma.activityEvent.createMany({
        data: [
          {
            workspaceId: testWorkspaceId,
            userId: testUserId,
            actorType: 'user',
            source: 'api',
            type: 'workspace.member_invited',
            scopeType: 'workspace',
            scopeId: testWorkspaceId,
          },
          {
            workspaceId: testWorkspaceId,
            userId: null,
            actorType: 'system',
            source: 'automation',
            type: 'workspace.backup_completed',
            scopeType: 'workspace',
            scopeId: testWorkspaceId,
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${testWorkspaceId}/activity?includeSystemEvents=false`,
        headers: {
          Authorization: `Bearer ${testUserToken}`,
          'X-Workspace-Id': testWorkspaceId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      // Should only return user events, not system events
      const systemEvents = body.data.items.filter((item: any) => item.actorType === 'system');
      expect(systemEvents.length).toBe(0);
    });
  });
});

