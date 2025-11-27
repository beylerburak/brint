/**
 * Brand Domain Entity
 * 
 * Domain-level representation of a Brand, independent of database schema.
 * Contains business rules and validation logic.
 */

/**
 * Normalizes a string into a URL-friendly slug
 * - Converts to lowercase
 * - Replaces whitespace and underscores with hyphens
 * - Removes non-alphanumeric characters (except hyphens)
 * - Trims leading/trailing hyphens
 */
function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // whitespace to hyphen
    .replace(/_/g, '-') // underscore to hyphen
    .replace(/[^a-z0-9-]/g, '') // remove non-alphanumeric (except hyphen)
    .replace(/-+/g, '-') // multiple hyphens to single hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

export type BrandProps = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class BrandEntity {
  public readonly id: string;
  public readonly workspaceId: string;
  public readonly name: string;
  public readonly slug: string;
  public readonly description: string | null;
  public readonly isActive: boolean;
  public readonly createdBy: string | null;
  public readonly updatedBy: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: BrandProps) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.slug = props.slug;
    this.description = props.description ?? null;
    this.isActive = props.isActive;
    this.createdBy = props.createdBy ?? null;
    this.updatedBy = props.updatedBy ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Creates a BrandEntity with validation
   * @throws Error if name is empty or slug is invalid
   */
  static create(props: {
    workspaceId: string;
    name: string;
    slug: string;
    description?: string | null;
    isActive?: boolean;
    createdBy?: string | null;
  }): BrandEntity {
    // Name validation: non-empty and trimmed
    const trimmedName = props.name.trim();
    if (trimmedName.length === 0) {
      throw new Error('Brand name cannot be empty');
    }

    // Slug normalization and validation
    const normalizedSlug = normalizeSlug(props.slug);
    if (normalizedSlug.length === 0) {
      throw new Error('Brand slug cannot be empty after normalization');
    }

    // Slug format validation: lowercase alphanumeric and hyphens only
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(normalizedSlug)) {
      throw new Error(
        `Invalid slug format: ${normalizedSlug}. Slug must contain only lowercase letters, numbers, and hyphens.`
      );
    }

    return new BrandEntity({
      id: '', // Will be set by repository
      workspaceId: props.workspaceId,
      name: trimmedName,
      slug: normalizedSlug,
      description: props.description ?? null,
      isActive: props.isActive ?? true,
      createdBy: props.createdBy ?? null,
      updatedBy: props.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Creates a BrandEntity from Prisma Brand model
   */
  static fromPrisma(prismaBrand: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string | null;
    isActive: boolean;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): BrandEntity {
    return new BrandEntity({
      id: prismaBrand.id,
      workspaceId: prismaBrand.workspaceId,
      name: prismaBrand.name,
      slug: prismaBrand.slug,
      description: prismaBrand.description,
      isActive: prismaBrand.isActive,
      createdBy: prismaBrand.createdBy,
      updatedBy: prismaBrand.updatedBy,
      createdAt: prismaBrand.createdAt,
      updatedAt: prismaBrand.updatedAt,
    });
  }

  /**
   * Converts entity to Prisma create input
   */
  toPrismaCreateInput(): {
    workspaceId: string;
    name: string;
    slug: string;
    description?: string | null;
    isActive: boolean;
    createdBy?: string | null;
    updatedBy?: string | null;
  } {
    return {
      workspaceId: this.workspaceId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      isActive: this.isActive,
      createdBy: this.createdBy ?? undefined,
      updatedBy: this.updatedBy ?? undefined,
    };
  }

  /**
   * Converts entity to plain object
   */
  toJSON(): BrandProps {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      name: this.name,
      slug: this.slug,
      description: this.description,
      isActive: this.isActive,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
