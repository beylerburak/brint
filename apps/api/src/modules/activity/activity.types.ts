export type ActivityActorType = "user" | "system" | "integration";

export type ActivitySource = "api" | "worker" | "webhook" | "automation";

export type ActivityScopeType =
  | "workspace"
  | "brand"
  | "content"
  | "publication"
  | "user"
  | "billing"
  | "social_account";

export type ActivityEventType =
  // Auth events
  | "auth.magic_link_requested"
  | "auth.magic_link_login_success"
  | "auth.google_oauth_login_success"
  | "auth.logout"
  // Workspace events
  | "workspace.member_invited"
  // Email events
  | "email.magic_link_sent"
  | "email.magic_link_failed"
  | "email.workspace_invite_sent"
  | "email.workspace_invite_failed"
  // Brand events
  | "brand.created"
  | "brand.updated"
  | "brand.deleted"
  | "brand.profile_completed"
  | "brand.social_account_connected"
  | "brand.social_account_disconnected"
  | "brand.publishing_defaults_updated"
  // Social Account events
  | "social_account.connected"
  | "social_account.disconnected"
  | "social_account.removed"
  // Content events
  | "content.created"
  | "content.updated"
  | "content.deleted"
  // Publication events
  | "publication.scheduled"
  | "publication.updated"
  | "publication.cancelled"
  | "publication.published"
  | "publication.failed";

export type ActivityEventRaw = {
  id: string;
  createdAt: Date;
  workspaceId: string | null;
  userId: string | null;
  actorType: ActivityActorType;
  source: ActivitySource;
  type: ActivityEventType | string; // string de kabul et, geriye dönük esneklik için
  scopeType: ActivityScopeType | null;
  scopeId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
};

// AI/snapshot için "projection" tipi
export type AiActivityItem = {
  id: string;
  timestamp: string; // ISO string
  type: string; // ActivityEventType veya custom string
  actorType: ActivityActorType;
  source: ActivitySource;
  workspaceId: string | null;
  userId: string | null;
  scopeType: ActivityScopeType | null;
  scopeId: string | null;
  // AI açıklama ve UI için özet alanlar:
  title: string; // kısa başlık (örn: "Workspace member invited")
  summary: string; // tek cümlelik açıklama
  details?: string; // isteğe bağlı daha detaylı açıklama
  metadata: Record<string, unknown>; // normalize edilmiş metadata
};

