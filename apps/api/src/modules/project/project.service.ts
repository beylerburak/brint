/**
 * Project Service
 * 
 * Business logic layer for Project operations.
 * Handles validation, permissions, and activity logging.
 */

import { ProjectRepository } from './project.repository.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { logActivity } from '../../core/activity/activity-log.service.js';
import { ActivityActorType, ActivityEntityType } from '@prisma/client';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectDto,
  ProjectWithTaskCountDto,
} from './project.entity.js';
import type { ProjectStatus } from '@prisma/client';

const projectRepository = new ProjectRepository();

/**
 * Service context from authenticated request
 */
export type ProjectServiceContext = {
  userId: string;
  workspaceId: string;
  brandId?: string | null;
};

/**
 * Convert Prisma project to DTO
 */
function toProjectDto(project: any): ProjectWithTaskCountDto {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    brandId: project.brandId,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    createdByUserId: project.createdByUserId,
    updatedByUserId: project.updatedByUserId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    taskCount: project._count?.tasks ?? 0,
  };
}

/**
 * Create a new project
 */
export async function createProject(
  ctx: ProjectServiceContext,
  input: CreateProjectInput
): Promise<ProjectWithTaskCountDto> {
  const { name, description, brandId, status, startDate, endDate } = input;

  logger.info(
    { workspaceId: ctx.workspaceId, name, brandId },
    'Creating project'
  );

  // Validate brand if provided
  if (brandId) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!brand) {
      throw new Error('BRAND_NOT_FOUND');
    }
  }

  // Create project
  const project = await projectRepository.createProject({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? null,
    name,
    description: description ?? null,
    status: (status as ProjectStatus) ?? 'PLANNED',
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    createdByUserId: ctx.userId,
  });

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? null,
    entityType: ActivityEntityType.PROJECT,
    entityId: project.id,
    eventKey: 'project.created',
    message: `Project created: ${project.name}`,
    context: 'project',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      projectId: project.id,
      name: project.name,
      status: project.status,
      brandId: project.brandId,
    },
  });

  return toProjectDto(project);
}

/**
 * Update a project
 */
export async function updateProject(
  ctx: ProjectServiceContext,
  projectId: string,
  input: UpdateProjectInput
): Promise<ProjectWithTaskCountDto> {
  logger.info(
    { workspaceId: ctx.workspaceId, projectId, userId: ctx.userId },
    'Updating project'
  );

  // Find project with validation
  const existingProject = await projectRepository.findProjectByIdWithValidation({
    id: projectId,
    workspaceId: ctx.workspaceId,
  });

  if (!existingProject) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  // Validate brand if being updated
  if (input.brandId !== undefined && input.brandId !== null) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: input.brandId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!brand) {
      throw new Error('BRAND_NOT_FOUND');
    }
  }

  // Update project
  const updatedProject = await projectRepository.updateProjectById(projectId, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.status !== undefined && { status: input.status as ProjectStatus }),
    ...(input.startDate !== undefined && {
      startDate: input.startDate ? new Date(input.startDate) : null,
    }),
    ...(input.endDate !== undefined && {
      endDate: input.endDate ? new Date(input.endDate) : null,
    }),
    ...(input.brandId !== undefined && { brandId: input.brandId }),
    updatedByUserId: ctx.userId,
  });

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingProject.brandId,
    entityType: ActivityEntityType.PROJECT,
    entityId: projectId,
    eventKey: 'project.updated',
    message: `Project updated: ${updatedProject.name}`,
    context: 'project',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      projectId,
      changes: input,
    },
  });

  return toProjectDto(updatedProject);
}

/**
 * Get a project by ID
 */
export async function getProjectById(
  ctx: ProjectServiceContext,
  projectId: string
): Promise<ProjectWithTaskCountDto | null> {
  const project = await projectRepository.findProjectByIdWithValidation({
    id: projectId,
    workspaceId: ctx.workspaceId,
  });

  if (!project) {
    return null;
  }

  return toProjectDto(project);
}

/**
 * List projects
 */
export async function listProjects(
  ctx: ProjectServiceContext,
  query: {
    brandId?: string;
    status?: ProjectStatus;
    page?: number;
    limit?: number;
  }
): Promise<{
  projects: ProjectWithTaskCountDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { brandId, status, page = 1, limit = 20 } = query;

  // Validate brand if provided
  if (brandId) {
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        workspaceId: ctx.workspaceId,
      },
    });

    if (!brand) {
      throw new Error('BRAND_NOT_FOUND');
    }
  }

  const result = await projectRepository.listProjectsByWorkspace({
    workspaceId: ctx.workspaceId,
    brandId: brandId ?? undefined,
    status,
    page,
    limit,
  });

  return {
    projects: result.projects.map(toProjectDto),
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  };
}

/**
 * Archive a project
 */
export async function archiveProject(
  ctx: ProjectServiceContext,
  projectId: string
): Promise<void> {
  logger.info(
    { workspaceId: ctx.workspaceId, projectId, userId: ctx.userId },
    'Archiving project'
  );

  // Find project with validation
  const existingProject = await projectRepository.findProjectByIdWithValidation({
    id: projectId,
    workspaceId: ctx.workspaceId,
  });

  if (!existingProject) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  // Archive project
  await projectRepository.archiveProjectById(projectId, ctx.userId);

  // Log activity
  await logActivity({
    workspaceId: ctx.workspaceId,
    brandId: existingProject.brandId,
    entityType: ActivityEntityType.PROJECT,
    entityId: projectId,
    eventKey: 'project.archived',
    message: `Project archived: ${existingProject.name}`,
    context: 'project',
    actorType: ActivityActorType.USER,
    actorUserId: ctx.userId,
    payload: {
      projectId,
      name: existingProject.name,
    },
  });
}

