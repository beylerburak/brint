// apps/api/src/modules/integration/integration.routes.ts

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { IntegrationService } from './integration.service.js';
import { requireWorkspaceRoleFor } from '../../core/auth/workspace-guard.js';
import { getWorkspaceIdFromRequest } from '../../core/auth/workspace-context.js';

export async function registerIntegrationRoutes(app: FastifyInstance) {
  const service = new IntegrationService();

  app.get(
    '/integrations',
    {
      preHandler: requireWorkspaceRoleFor('workspace:view'),
      schema: {
        tags: ['Integrations'],
        summary: 'List workspace integrations',
        description: 'Returns all integrations for the workspace',
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const workspaceId = getWorkspaceIdFromRequest(request);
      const list = await service.listWorkspaceIntegrations(workspaceId);

      return reply.send({
        success: true,
        integrations: list,
      });
    },
  );
}
