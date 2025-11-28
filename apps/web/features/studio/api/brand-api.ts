import { httpClient } from "@/shared/http";
import { getWorkspaceId } from "@/shared/http/workspace-header";

export interface Brand {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetBrandsResponse {
  success: boolean;
  data: {
    userId: string;
    workspaceId: string;
    hasBrandViewPermission: boolean;
    effectivePermissions: string[];
    brands: Brand[];
  };
}

export interface CreateBrandRequest {
  name: string;
  slug: string;
  description?: string;
  logoMediaId?: string;
}

export interface CreateBrandResponse {
  success: boolean;
  data: Brand;
}

export async function getBrands(workspaceId?: string): Promise<Brand[]> {
  const resolvedWorkspaceId = workspaceId ?? getWorkspaceId();
  if (!resolvedWorkspaceId) {
    throw new Error("Workspace ID is required to fetch brands");
  }

  const response = await httpClient.get<GetBrandsResponse>(
    `/workspaces/${resolvedWorkspaceId}/studio/brands`,
    {
      headers: { "X-Workspace-Id": resolvedWorkspaceId },
    }
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to get brands");
  }

  return response.data.data.brands;
}

export async function createBrand(
  data: CreateBrandRequest,
  workspaceId?: string
): Promise<Brand> {
  const resolvedWorkspaceId = workspaceId ?? getWorkspaceId();
  if (!resolvedWorkspaceId) {
    throw new Error("Workspace ID is required to create a brand");
  }

  const response = await httpClient.post<CreateBrandResponse>(
    `/workspaces/${resolvedWorkspaceId}/studio/brands`,
    data,
    {
      headers: { "X-Workspace-Id": resolvedWorkspaceId },
    }
  );

  if (!response.ok) {
    throw new Error(response.message || "Failed to create brand");
  }

  return response.data.data;
}
