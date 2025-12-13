import { preferencesApi } from "../api/preferences"
import { PreferenceKey } from "./preference-keys"

export type PreferenceScope = "user" | "workspace"

export type StorageContext = {
  scope: PreferenceScope
  workspaceId?: string | null
  urlParam?: string
}

export type PreferenceStorageAdapter = {
  get: (key: PreferenceKey, options?: StorageContext) => any | undefined
  set: (key: PreferenceKey, value: any, options?: StorageContext) => Promise<void> | void
  remove: (key: PreferenceKey, options?: StorageContext) => Promise<void> | void
}

const LOCAL_STORAGE_PREFIX = "brint:pref"

const isBrowser = () => typeof window !== "undefined"

const buildLocalStorageKey = (
  key: PreferenceKey,
  scope: PreferenceScope,
  workspaceId?: string | null
) => {
  const scopeKey = scope === "workspace" ? workspaceId ?? "workspace-global" : "user"
  return `${LOCAL_STORAGE_PREFIX}:${scope}:${scopeKey}:${key}`
}

const serializeUrlValue = (value: any) => {
  if (typeof value === "boolean") return value ? "1" : "0"
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return value.toString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const localStorageAdapter: PreferenceStorageAdapter = {
  get: (key, options) => {
    if (!isBrowser()) return undefined
    const storageKey = buildLocalStorageKey(key, options?.scope ?? "workspace", options?.workspaceId)
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return undefined

    try {
      return JSON.parse(stored)
    } catch {
      return undefined
    }
  },
  set: (key, value, options) => {
    if (!isBrowser()) return
    const storageKey = buildLocalStorageKey(key, options?.scope ?? "workspace", options?.workspaceId)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch (error) {
      console.error("[Preference] Failed to write localStorage", error)
    }
  },
  remove: (key, options) => {
    if (!isBrowser()) return
    const storageKey = buildLocalStorageKey(key, options?.scope ?? "workspace", options?.workspaceId)
    window.localStorage.removeItem(storageKey)
  },
}

export const urlSearchParamAdapter: PreferenceStorageAdapter = {
  get: (_key, options) => {
    if (!isBrowser() || !options?.urlParam) return undefined
    const params = new URLSearchParams(window.location.search)
    const value = params.get(options.urlParam)
    return value ?? undefined
  },
  set: (_key, value, options) => {
    if (!isBrowser() || !options?.urlParam) return
    const url = new URL(window.location.href)

    if (value === undefined || value === null || value === "") {
      url.searchParams.delete(options.urlParam)
    } else {
      url.searchParams.set(options.urlParam, serializeUrlValue(value))
    }

    const newUrl = `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ""}${url.hash}`
    window.history.replaceState(null, "", newUrl)
  },
  remove: (_key, options) => {
    if (!isBrowser() || !options?.urlParam) return
    const url = new URL(window.location.href)
    url.searchParams.delete(options.urlParam)
    const newUrl = `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ""}${url.hash}`
    window.history.replaceState(null, "", newUrl)
  },
}

export const dbAdapter: PreferenceStorageAdapter = {
  get: async (key, options) => {
    const workspaceId = options?.workspaceId ?? undefined
    try {
      const response = await preferencesApi.listPreferences(workspaceId)
      const match = response.preferences.find(
        (pref) =>
          pref.key === key &&
          (pref.workspaceId ?? null) === (options?.workspaceId ?? null)
      )
      return match?.value
    } catch (error) {
      console.error("[Preference] Failed to fetch preference from API", error)
      return undefined
    }
  },
  set: async (key, value, options) => {
    const workspaceId = options?.workspaceId ?? undefined
    await preferencesApi.upsertPreference({
      key,
      value,
      workspaceId: workspaceId ?? undefined,
    })
  },
  remove: async (key, options) => {
    const workspaceId = options?.workspaceId ?? undefined
    await preferencesApi.upsertPreference({
      key,
      value: null,
      workspaceId: workspaceId ?? undefined,
    })
  },
}
