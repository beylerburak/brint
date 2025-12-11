// apps/api/src/modules/integration/integration.entity.ts

import { IntegrationStatus, IntegrationType, WorkspaceIntegration } from '@prisma/client';

export type IntegrationTypeEnum = IntegrationType;
export type IntegrationStatusEnum = IntegrationStatus;

export interface WorkspaceIntegrationAuthGoogleDrive {
  accessToken: string;
  refreshToken: string;
  expiryDate: string; // ISO
  scope?: string;
  tokenType?: string;
}

export interface WorkspaceIntegrationConfigGoogleDrive {
  rootFolderId?: string;
}

export type WorkspaceIntegrationAuth = WorkspaceIntegrationAuthGoogleDrive | Record<string, unknown>;
export type WorkspaceIntegrationConfig = WorkspaceIntegrationConfigGoogleDrive | Record<string, unknown>;

export interface WorkspaceIntegrationDTO {
  id: string;
  workspaceId: string;
  integrationType: IntegrationType;
  status: IntegrationStatus;
  statusMessage?: string | null;
  lastSyncedAt?: Date | null;
  connectedByUserId?: string | null;

  // auth & config raw JSON (frontend'e minimal veri dönebilirsin)
  hasAuth: boolean;
  config: WorkspaceIntegrationConfig | null;

  createdAt: Date;
  updatedAt: Date;
}
