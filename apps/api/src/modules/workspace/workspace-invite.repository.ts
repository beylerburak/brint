import { prisma } from "../../lib/prisma.js";

export interface CreateWorkspaceInviteInput {
  email: string;
  workspaceId: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
}

export class WorkspaceInviteRepository {
  async createInvite(input: CreateWorkspaceInviteInput) {
    return prisma.workspaceInvite.create({
      data: {
        email: input.email,
        workspaceId: input.workspaceId,
        invitedBy: input.invitedBy,
        token: input.token,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByToken(token: string) {
    return prisma.workspaceInvite.findUnique({
      where: { token },
    });
  }

  async findById(id: string) {
    return prisma.workspaceInvite.findUnique({
      where: { id },
    });
  }

  async updateStatus(id: string, status: "PENDING" | "ACCEPTED" | "EXPIRED") {
    return prisma.workspaceInvite.update({
      where: { id },
      data: { status },
    });
  }

  async findPendingByEmailAndWorkspace(email: string, workspaceId: string) {
    return prisma.workspaceInvite.findFirst({
      where: {
        email,
        workspaceId,
        status: "PENDING",
      },
    });
  }
}

export const workspaceInviteRepository = new WorkspaceInviteRepository();
