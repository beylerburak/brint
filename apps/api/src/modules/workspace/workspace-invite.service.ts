import { workspaceInviteRepository, CreateWorkspaceInviteInput } from "./workspace-invite.repository.js";

export class WorkspaceInviteService {
  async create(input: CreateWorkspaceInviteInput) {
    return workspaceInviteRepository.createInvite(input);
  }

  async getByToken(token: string) {
    return workspaceInviteRepository.findByToken(token);
  }

  async getById(id: string) {
    return workspaceInviteRepository.findById(id);
  }

  async updateStatus(id: string, status: "PENDING" | "ACCEPTED" | "EXPIRED") {
    return workspaceInviteRepository.updateStatus(id, status);
  }

  async getPendingByEmailAndWorkspace(email: string, workspaceId: string) {
    return workspaceInviteRepository.findPendingByEmailAndWorkspace(email, workspaceId);
  }
}

export const workspaceInviteService = new WorkspaceInviteService();
