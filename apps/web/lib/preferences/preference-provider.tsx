"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useWorkspace } from "@/contexts/workspace-context"
import { preferencesApi, type UserPreferenceDto } from "../api/preferences"
import { PreferenceKey } from "./preference-keys"
import { localStorageAdapter } from "./storage-adapters"

type PreferenceContextValue = {
  preferences: UserPreferenceDto[]
  isLoading: boolean
  error: string | null
  version: number
  refreshPreferences: (workspaceId?: string | null) => Promise<void>
  getPreferenceValue: (key: PreferenceKey, workspaceId?: string | null) => any
  setPreferenceValue: (key: PreferenceKey, value: any, workspaceId?: string | null) => void
}

const PreferenceContext = createContext<PreferenceContextValue | undefined>(undefined)

const mapKey = (key: PreferenceKey, workspaceId?: string | null) =>
  `${workspaceId ?? "global"}::${key}`

export function PreferenceProvider({ children }: { children: React.ReactNode }) {
  const { user, currentWorkspace } = useWorkspace()
  const [preferences, setPreferences] = useState<UserPreferenceDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const lastWorkspaceIdRef = useRef<string | null>(null)

  const refreshPreferences = useCallback(
    async (workspaceId?: string | null) => {
      if (!user) {
        setPreferences([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await preferencesApi.listPreferences(workspaceId ?? undefined)
        setPreferences(response.preferences)
        setVersion((prev) => prev + 1)
        lastWorkspaceIdRef.current = workspaceId ?? null
      } catch (err) {
        console.error("[Preference] Failed to load preferences", err)
        setError("Failed to load preferences")
      } finally {
        setIsLoading(false)
      }
    },
    [user]
  )

  // Sync localStorage preferences to DB on session end (batch)
  const syncLocalStorageToDb = useCallback(async () => {
    if (!user || typeof window === "undefined") return

    try {
      // Get all localStorage keys with our prefix
      const allKeys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key?.startsWith("brint:pref:")) {
          allKeys.push(key)
        }
      }

      if (allKeys.length === 0) return

      // Parse and collect preferences for batch sync
      const preferencesToSync: Array<{
        key: string
        value: any
        workspaceId?: string | null
      }> = []

      for (const storageKey of allKeys) {
        try {
          // Parse storage key: brint:pref:workspace:workspaceId:key or brint:pref:user:user:key
          // Remove prefix "brint:pref:"
          const withoutPrefix = storageKey.replace("brint:pref:", "")
          const parts = withoutPrefix.split(":")
          if (parts.length < 3) continue

          const scope = parts[0] as "workspace" | "user"
          const scopeKey = parts[1]
          const prefKey = parts.slice(2).join(":") as PreferenceKey

          // Read value directly from localStorage
          const storedValue = window.localStorage.getItem(storageKey)
          if (!storedValue) continue

          let value: any
          try {
            value = JSON.parse(storedValue)
          } catch {
            continue
          }

          const workspaceId =
            scope === "workspace" && scopeKey !== "workspace-global" ? scopeKey : null

          // Only sync workspace-scoped preferences if we have a workspace
          if (scope === "workspace" && !workspaceId && !currentWorkspace?.id) continue

          const targetWorkspaceId = scope === "workspace" ? workspaceId ?? currentWorkspace?.id ?? null : null

          preferencesToSync.push({
            key: prefKey,
            value,
            workspaceId: targetWorkspaceId ?? undefined,
          })
        } catch (error) {
          console.error(`[Preference] Failed to parse storage key ${storageKey}:`, error)
        }
      }

      // Batch sync all preferences in a single request
      if (preferencesToSync.length > 0) {
        // Split into chunks of 100 (API limit)
        const chunkSize = 100
        for (let i = 0; i < preferencesToSync.length; i += chunkSize) {
          const chunk = preferencesToSync.slice(i, i + chunkSize)
          await preferencesApi.batchUpsertPreferences(chunk).catch((error) => {
            console.error("[Preference] Failed to batch sync preferences to DB:", error)
          })
        }
      }
    } catch (error) {
      console.error("[Preference] Failed to sync localStorage to DB:", error)
    }
  }, [user, currentWorkspace?.id])

  useEffect(() => {
    if (!user) {
      setPreferences([])
      lastWorkspaceIdRef.current = null
      return
    }

    const targetWorkspaceId = currentWorkspace?.id ?? null

    if (lastWorkspaceIdRef.current === targetWorkspaceId) {
      return
    }

    void refreshPreferences(targetWorkspaceId)
  }, [user, currentWorkspace?.id, refreshPreferences])

  // Note: We don't sync localStorage to DB on initial load anymore.
  // Sync only happens when session ends (beforeunload/pagehide events).
  // This prevents unnecessary API calls during normal usage.

  const preferenceMap = useMemo(() => {
    const map = new Map<string, any>()
    preferences.forEach((pref) => {
      map.set(mapKey(pref.key as PreferenceKey, pref.workspaceId ?? null), pref.value)
    })
    return map
  }, [preferences])

  const getPreferenceValue = useCallback(
    (key: PreferenceKey, workspaceId?: string | null) => {
      return preferenceMap.get(mapKey(key, workspaceId ?? null))
    },
    [preferenceMap]
  )

  const setPreferenceValue = useCallback(
    (key: PreferenceKey, value: any, workspaceId?: string | null) => {
      const storageKey = mapKey(key, workspaceId ?? null)
      const timestamp = new Date().toISOString()

      setPreferences((prev) => {
        const existingIndex = prev.findIndex(
          (pref) => mapKey(pref.key as PreferenceKey, pref.workspaceId ?? null) === storageKey
        )

        if (existingIndex !== -1) {
          const next = [...prev]
          next[existingIndex] = { ...next[existingIndex], value, updatedAt: timestamp }
          return next
        }

        return [
          ...prev,
          {
            id: `local-${storageKey}`,
            key,
            value,
            workspaceId: workspaceId ?? null,
            userId: user?.id ?? "",
            updatedAt: timestamp,
          },
        ]
      })

      setVersion((prev) => prev + 1)
    },
    [user?.id]
  )

  // Set up session end listeners - sync localStorage preferences to DB only when session ends
  useEffect(() => {
    if (!user || typeof window === "undefined") return

    let syncScheduled = false
    const performSync = () => {
      if (syncScheduled) return
      syncScheduled = true
      // Use sendBeacon or fetch with keepalive for reliable sync on page unload
      void syncLocalStorageToDb()
    }

    // Handle page unload (most browsers)
    const handleBeforeUnload = () => {
      performSync()
    }

    // Handle page hide (more reliable, works even when navigating away)
    const handlePageHide = () => {
      performSync()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("pagehide", handlePageHide)
      // Final sync on unmount (e.g., during navigation in Next.js app router)
      performSync()
    }
  }, [user, syncLocalStorageToDb])

  const value: PreferenceContextValue = {
    preferences,
    isLoading,
    error,
    version,
    refreshPreferences,
    getPreferenceValue,
    setPreferenceValue,
  }

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>
}

export function usePreferenceContext(): PreferenceContextValue {
  const context = useContext(PreferenceContext)
  if (!context) {
    throw new Error("usePreferenceContext must be used within a PreferenceProvider")
  }
  return context
}
