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

  async updateStatus(id: string, status: "PENDING" | "ACCEPTED" | "EXPIRED") {
    return prisma.workspaceInvite.update({
      where: { id },
      data: { status },
    });
  }
}

export const workspaceInviteRepository = new WorkspaceInviteRepository();
