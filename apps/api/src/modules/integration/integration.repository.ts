// apps/api/src/modules/integration/integration.repository.ts

import { PrismaClient, IntegrationType, IntegrationStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export class IntegrationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async findByWorkspaceAndType(workspaceId: string, integrationType: IntegrationType) {
    return this.db.workspaceIntegration.findUnique({
      where: {
        workspaceId_integrationType: {
          workspaceId,
          integrationType,
        },
      },
    });
  }

  async listByWorkspace(workspaceId: string) {
    return this.db.workspaceIntegration.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertWorkspaceIntegration(params: {
    workspaceId: string;
    integrationType: IntegrationType;
    status?: IntegrationStatus;
    statusMessage?: string | null;
    auth?: unknown;
    config?: unknown;
    connectedByUserId?: string | null;
    lastSyncedAt?: Date | null;
  }) {
    const { workspaceId, integrationType, ...data } = params;

    return this.db.workspaceIntegration.upsert({
      where: {
        workspaceId_integrationType: {
          workspaceId,
          integrationType,
        },
      },
      create: {
        workspaceId,
        integrationType,
        status: data.status ?? 'PENDING',
        statusMessage: data.statusMessage ?? null,
        auth: data.auth ?? null,
        config: data.config ?? null,
        connectedByUserId: data.connectedByUserId ?? null,
        lastSyncedAt: data.lastSyncedAt ?? null,
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async updateStatus(params: {
    workspaceId: string;
    integrationType: IntegrationType;
    status: IntegrationStatus;
    statusMessage?: string | null;
  }) {
    const { workspaceId, integrationType, status, statusMessage } = params;

    return this.db.workspaceIntegration.update({
      where: { workspaceId_integrationType: { workspaceId, integrationType } },
      data: {
        status,
        statusMessage: statusMessage ?? null,
      },
    });
  }

  async deleteWorkspaceIntegration(workspaceId: string, integrationType: IntegrationType) {
    return this.db.workspaceIntegration.delete({
      where: { workspaceId_integrationType: { workspaceId, integrationType } },
    });
  }
}
