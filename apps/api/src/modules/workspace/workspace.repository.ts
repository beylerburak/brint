/**
 * Workspace Repository
 * 
 * Data access layer for Workspace entities using Prisma.
 * Handles all database operations related to workspaces.
 */

import { prisma } from '../../lib/prisma.js';
import { WorkspaceEntity } from './workspace.entity.js';
import { Prisma } from '@prisma/client';

export class WorkspaceRepository {
  /**
   * Finds a workspace by ID
   * @returns WorkspaceEntity or null if not found
   */
  async findWorkspaceById(id: string): Promise<WorkspaceEntity | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
    });

    if (!workspace) {
      return null;
    }

    return WorkspaceEntity.fromPrisma(workspace);
  }

  /**
   * Finds a workspace by slug
   * @returns WorkspaceEntity or null if not found
   */
  async findWorkspaceBySlug(slug: string): Promise<WorkspaceEntity | null> {
    const workspace = await prisma.workspace.findUnique({
      where: { slug },
    });

    if (!workspace) {
      return null;
    }

    return WorkspaceEntity.fromPrisma(workspace);
  }

  /**
   * Creates a new workspace
   * @param data Workspace creation data
   * @returns Created WorkspaceEntity
   * @throws Error if slug already exists or validation fails
   */
  async createWorkspace(data: {
    name: string;
    slug: string;
  }): Promise<WorkspaceEntity> {
    try {
      const workspace = await prisma.workspace.create({
        data: {
          name: data.name,
          slug: data.slug,
        },
      });

      return WorkspaceEntity.fromPrisma(workspace);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new Error(`Workspace with slug ${data.slug} already exists`);
      }
      throw error;
    }
  }

  /**
   * Creates a workspace with owner in a transaction
   * 
   * If user doesn't exist, creates it. Then creates workspace and workspace member.
   * @param params Creation parameters
   * @returns Object containing created user, workspace, and member
   */
  async createWorkspaceWithOwner(params: {
    userEmail: string;
    userName?: string | null;
    workspaceName: string;
    workspaceSlug: string;
  }): Promise<{
    user: { id: string; email: string; name: string | null };
    workspace: WorkspaceEntity;
    member: { id: string; role: string };
  }> {
    return await prisma.$transaction(async (tx) => {
      // Find or create user
      let user = await tx.user.findUnique({
        where: { email: params.userEmail },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: params.userEmail,
            name: params.userName ?? null,
          },
        });
      }

      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: params.workspaceName,
          slug: params.workspaceSlug,
        },
      });

      // Create workspace member with owner role
      const member = await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: 'owner',
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        workspace: WorkspaceEntity.fromPrisma(workspace),
        member: {
          id: member.id,
          role: member.role,
        },
      };
    });
  }
}

// Export singleton instance
export const workspaceRepository = new WorkspaceRepository();

