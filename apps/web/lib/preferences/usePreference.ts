"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useWorkspace } from "@/contexts/workspace-context"
import { PreferenceKey } from "./preference-keys"
import {
  PreferenceScope,
  dbAdapter,
  localStorageAdapter,
  urlSearchParamAdapter,
} from "./storage-adapters"
import { usePreferenceContext } from "./preference-provider"

type UsePreferenceOptions<T> = {
  defaultValue: T
  scope?: PreferenceScope
  storage?: "auto" | "url" | "local" | "db"
  urlParam?: string
}

type Setter<T> = T | ((prev: T) => T)

const firstDefined = <T,>(...values: Array<T | undefined>): T | undefined =>
  values.find((value) => value !== undefined)

const parseUrlValue = <T,>(raw: string | undefined, fallback: T): T | undefined => {
  if (raw === undefined) return undefined

  if (typeof fallback === "boolean") {
    return (raw === "1" || raw.toLowerCase() === "true") as T
  }

  if (typeof fallback === "number") {
    const parsed = Number(raw)
    return Number.isNaN(parsed) ? undefined : (parsed as T)
  }

  if (raw === "") return undefined

  try {
    return JSON.parse(raw) as T
  } catch {
    return raw as T
  }
}

export function usePreference<T>(
  key: PreferenceKey,
  options: UsePreferenceOptions<T>
): [T, (value: Setter<T>) => void] {
  const {
    defaultValue,
    scope = "workspace",
    storage = "auto",
    urlParam,
  } = options
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { currentWorkspace } = useWorkspace()
  const { getPreferenceValue, setPreferenceValue, version } = usePreferenceContext()

  const workspaceId = scope === "workspace" ? currentWorkspace?.id ?? null : null
  const [value, setValue] = useState<T>(defaultValue)

  const writeTarget = useMemo<"url" | "local" | "db">(() => {
    if (storage === "auto") {
      return urlParam ? "url" : "local"
    }
    return storage
  }, [storage, urlParam])

  useEffect(() => {
    const urlValueRaw = urlParam
      ? (urlSearchParamAdapter.get(key, { scope, urlParam }) as string | undefined)
      : undefined
    const urlValue = urlParam ? parseUrlValue<T>(urlValueRaw, defaultValue) : undefined

    const localValue = localStorageAdapter.get(key, { scope, workspaceId }) as T | undefined
    const dbValue = getPreferenceValue(key, workspaceId ?? null) as T | undefined

    const nextValue = firstDefined(urlValue, localValue, dbValue, defaultValue)
    setValue(nextValue as T)
  }, [
    defaultValue,
    scope,
    workspaceId,
    searchParams?.toString(),
    urlParam,
    key,
    getPreferenceValue,
    version,
  ])

  const persistValue = useCallback(
    async (next: T) => {
      const syncUrl = (val: T) => {
        if (urlParam) {
          urlSearchParamAdapter.set(key, val, { scope, urlParam })
        }
      }

      if (writeTarget === "url") {
        // Save to both URL and localStorage for persistence across page changes
        localStorageAdapter.set(key, next, { scope, workspaceId })
        syncUrl(next)
        return
      }

      if (writeTarget === "local") {
        localStorageAdapter.set(key, next, { scope, workspaceId })
        syncUrl(next)
        return
      }

      if (writeTarget === "db") {
        // Workspace-scoped preferences require workspace id to persist
        if (scope === "workspace" && !workspaceId) {
          console.warn("[Preference] Workspace ID missing, skipping DB persistence for", key)
          return
        }

        try {
          await dbAdapter.set(key, next, { scope, workspaceId: workspaceId ?? undefined })
          localStorageAdapter.set(key, next, { scope, workspaceId })
          setPreferenceValue(key, next, workspaceId ?? null)
          syncUrl(next)
        } catch (error) {
          console.error("[Preference] Failed to persist preference", error)
        }
      }
    },
    [key, scope, workspaceId, writeTarget, urlParam, setPreferenceValue]
  )

  const setPreference = useCallback(
    (next: Setter<T>) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next
        // Schedule persistence for after render to avoid updating Router during render
        setTimeout(() => {
          void persistValue(resolved)
        }, 0)
        return resolved
      })
    },
    [persistValue]
  )

  useEffect(() => {
    // Keep URL param in sync when pathname changes (e.g., navigation without reload)
    if (writeTarget !== "url" || !urlParam) return
    const current = urlSearchParamAdapter.get(key, { scope, urlParam }) as string | undefined
    const parsed = parseUrlValue<T>(current, defaultValue)
    if (parsed !== undefined) {
      setValue(parsed)
    }
  }, [pathname, key, urlParam, writeTarget, defaultValue])

  return [value, setPreference]
}
