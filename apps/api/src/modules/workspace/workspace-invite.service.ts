import { workspaceInviteRepository, CreateWorkspaceInviteInput } from "./workspace-invite.repository.js";

export class WorkspaceInviteService {
  async create(input: CreateWorkspaceInviteInput) {
    return workspaceInviteRepository.createInvite(input);
  }

  async getByToken(token: string) {
    return workspaceInviteRepository.findByToken(token);
  }

  async updateStatus(id: string, status: "PENDING" | "ACCEPTED" | "EXPIRED") {
    return workspaceInviteRepository.updateStatus(id, status);
  }
}

export const workspaceInviteService = new WorkspaceInviteService();
