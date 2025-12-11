// apps/api/src/modules/integration/integration.service.ts

import { IntegrationRepository } from './integration.repository.js';
import { IntegrationType } from '@prisma/client';

export class IntegrationService {
  constructor(private readonly repo = new IntegrationRepository()) {}

  async listWorkspaceIntegrations(workspaceId: string) {
    const integrations = await this.repo.listByWorkspace(workspaceId);

    return integrations.map((i) => ({
      id: i.id,
      workspaceId: i.workspaceId,
      integrationType: i.integrationType,
      status: i.status,
      statusMessage: i.statusMessage,
      lastSyncedAt: i.lastSyncedAt,
      connectedByUserId: i.connectedByUserId,
      hasAuth: !!i.auth,
      config: i.config ?? null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
  }

  async getWorkspaceIntegration(workspaceId: string, integrationType: IntegrationType) {
    const i = await this.repo.findByWorkspaceAndType(workspaceId, integrationType);
    if (!i) return null;

    return {
      id: i.id,
      workspaceId: i.workspaceId,
      integrationType: i.integrationType,
      status: i.status,
      statusMessage: i.statusMessage,
      lastSyncedAt: i.lastSyncedAt,
      connectedByUserId: i.connectedByUserId,
      hasAuth: !!i.auth,
      config: i.config ?? null,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }
}
