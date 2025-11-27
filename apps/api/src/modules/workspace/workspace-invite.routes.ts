import { FastifyInstance } from "fastify";
import { workspaceInviteService } from "./workspace-invite.service.js";

export async function workspaceInviteRoutes(app: FastifyInstance) {
  app.get("/workspace-invites/health", async () => {
    return { success: true };
  });

  // Placeholder route to list invites; to be implemented with auth/validation.
  app.get("/workspace-invites", async () => {
    return { success: true, data: [] };
  });
}
