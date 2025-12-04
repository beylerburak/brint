/**
 * Activity Log Types
 * 
 * Type definitions for the global activity logging system.
 */

import type {
  ActivityActorType,
  ActivityEntityType,
  ActivitySeverity,
  ActivityVisibility,
} from '@prisma/client';

export interface LogActivityInput {
  workspaceId: string;
  brandId?: string | null;
  
  entityType: ActivityEntityType;
  entityId: string;
  
  eventKey: string; // "brand.created", "content.scheduled", "publication.failed" vb.
  message?: string;
  context?: string; // "brand_profile", "scheduler", "publication_worker" vb.
  
  actorType: ActivityActorType;
  actorUserId?: string | null;
  actorLabel?: string | null; // "Scheduler Worker", "Meta API" gibi
  
  payload?: unknown; // Json olarak saklanacak
  
  visibility?: ActivityVisibility;
  severity?: ActivitySeverity;
}

export interface LogActivityOptions {
  swallowErrors?: boolean; // default: true - log hatası ana iş akışını bozmasın
}

