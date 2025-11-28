import { httpClient } from "@/shared/http";

export interface AcceptInviteResponse {
  success: boolean;
  data: {
    workspaceId: string;
    status: string;
  };
}

export async function acceptWorkspaceInvite(token: string): Promise<{
  workspaceId: string;
  status: string;
}> {
  const response = await httpClient.post<AcceptInviteResponse>(
<<<<<<< HEAD
    `/public/invites/${token}/accept`
=======
    `/workspace-invites/${token}/accept`
>>>>>>> origin/saj
  );

  if (!response.ok) {
    const errorDetails = response.details as
      | { error?: { code?: string; message?: string } }
      | undefined;
    const code = errorDetails?.error?.code;
    const message =
      errorDetails?.error?.message ||
      response.message ||
      "Failed to accept invite";
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = code;
    error.status = response.status;
    throw error;
  }

  return response.data.data;
}
