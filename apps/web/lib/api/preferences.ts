import { fetchApi, apiCache } from "./http"

export type UserPreferenceDto = {
  id: string
  userId: string
  workspaceId: string | null
  key: string
  value: any
  updatedAt: string
}

export const preferencesApi = {
  async listPreferences(
    workspaceId?: string
  ): Promise<{ success: true; preferences: UserPreferenceDto[] }> {
    const cacheKey = `preferences:${workspaceId ?? "all"}`

    const cached = apiCache.get<{ success: true; preferences: UserPreferenceDto[] }>(cacheKey)
    if (cached) return cached

    const pending = apiCache.getPendingRequest<{ success: true; preferences: UserPreferenceDto[] }>(cacheKey)
    if (pending) return pending

    const promise = fetchApi<{ success: true; preferences: UserPreferenceDto[] }>("/preferences", {
      headers: workspaceId ? { "X-Workspace-Id": workspaceId } : undefined,
    })

    apiCache.setPendingRequest(cacheKey, promise)

    const response = await promise
    apiCache.set(cacheKey, response)
    return response
  },

  async upsertPreference(input: {
    key: string
    value: any
    workspaceId?: string | null
  }): Promise<{ success: true; preference: UserPreferenceDto }> {
    const response = await fetchApi<{ success: true; preference: UserPreferenceDto }>("/preferences", {
      method: "PUT",
      headers: input.workspaceId ? { "X-Workspace-Id": input.workspaceId } : undefined,
      body: JSON.stringify({
        key: input.key,
        value: input.value,
        workspaceId: input.workspaceId ?? undefined,
      }),
    })

    this.clearCache(input.workspaceId ?? undefined)
    return response
  },

  async batchUpsertPreferences(
    preferences: Array<{
      key: string
      value: any
      workspaceId?: string | null
    }>
  ): Promise<{ success: true; preferences: UserPreferenceDto[] }> {
    const workspaceId = preferences[0]?.workspaceId
    const response = await fetchApi<{ success: true; preferences: UserPreferenceDto[] }>(
      "/preferences/batch",
      {
        method: "PUT",
        headers: workspaceId ? { "X-Workspace-Id": workspaceId } : undefined,
        body: JSON.stringify({ preferences }),
      }
    )

    this.clearCache(workspaceId ?? undefined)
    return response
  },

  clearCache(workspaceId?: string | null) {
    apiCache.clear(`preferences:${workspaceId ?? "all"}`)
    apiCache.clear("preferences:all")
  },
}
