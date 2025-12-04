/**
 * Workspace Domain Entity
 * 
 * Domain-level representation of a Workspace, independent of database schema.
 * Contains business rules and validation logic.
 */

import type { WorkspacePlan } from "@prisma/client";

export type WorkspaceProps = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  baseCurrency: string;
  plan: WorkspacePlan;
  settings: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
};

export class WorkspaceEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly slug: string;
  public readonly ownerUserId: string;
  public readonly avatarUrl: string | null;
  public readonly timezone: string;
  public readonly locale: string;
  public readonly baseCurrency: string;
  public readonly plan: WorkspacePlan;
  public readonly settings: Record<string, any> | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: WorkspaceProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.ownerUserId = props.ownerUserId;
    this.avatarUrl = props.avatarUrl;
    this.timezone = props.timezone;
    this.locale = props.locale;
    this.baseCurrency = props.baseCurrency;
    this.plan = props.plan;
    this.settings = props.settings;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Creates a WorkspaceEntity with validation
   * @throws Error if slug is invalid
   */
  static create(props: WorkspaceProps): WorkspaceEntity {
    // Slug validation: lowercase alphanumeric and hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(props.slug)) {
      throw new Error(
        `Invalid slug format: ${props.slug}. Slug must contain only lowercase letters, numbers, and hyphens.`
      );
    }

    // Name validation: non-empty
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Workspace name cannot be empty');
    }

    return new WorkspaceEntity(props);
  }

  /**
   * Creates a WorkspaceEntity from Prisma Workspace model
   */
  static fromPrisma(prismaWorkspace: {
    id: string;
    name: string;
    slug: string;
    ownerUserId: string;
    avatarUrl: string | null;
    timezone: string;
    locale: string;
    baseCurrency: string;
    plan: WorkspacePlan;
    settings: any;
    createdAt: Date;
    updatedAt: Date;
  }): WorkspaceEntity {
    return new WorkspaceEntity({
      id: prismaWorkspace.id,
      name: prismaWorkspace.name,
      slug: prismaWorkspace.slug,
      ownerUserId: prismaWorkspace.ownerUserId,
      avatarUrl: prismaWorkspace.avatarUrl,
      timezone: prismaWorkspace.timezone,
      locale: prismaWorkspace.locale,
      baseCurrency: prismaWorkspace.baseCurrency,
      plan: prismaWorkspace.plan,
      settings: prismaWorkspace.settings as Record<string, any> | null,
      createdAt: prismaWorkspace.createdAt,
      updatedAt: prismaWorkspace.updatedAt,
    });
  }

  /**
   * Converts entity to plain object
   */
  toJSON(): WorkspaceProps {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      ownerUserId: this.ownerUserId,
      avatarUrl: this.avatarUrl,
      timezone: this.timezone,
      locale: this.locale,
      baseCurrency: this.baseCurrency,
      plan: this.plan,
      settings: this.settings,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}