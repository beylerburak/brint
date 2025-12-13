"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useLocale } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { buildLoginUrl, buildOnboardingUrl, buildWorkspaceUrl, getLocaleFromPathnameOrParams } from "@/lib/locale-path"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * WorkspaceGuard - Handles redirects based on workspace status
 * Should be used in layouts/pages that require workspace access
 * 
 * Redirect logic:
 * - NO_ACCESS → login (with from param)
 * - EMPTY → onboarding
 * - ERROR (NOT_FOUND) → first workspace or onboarding
 * - LOADING → show skeleton until a workspace is available (keep UI mounted during background refresh)
 * - READY → render children
 */
export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  const { status, error, workspaces, currentWorkspace, isLoadingUser, isLoadingWorkspace } = useWorkspace()
  const currentLocale = getLocaleFromPathnameOrParams(pathname, undefined) || locale
  const hasWorkspaceContext = Boolean(currentWorkspace)

  useEffect(() => {
    // Handle redirects based on status
    if (status === "NO_ACCESS") {
      // Auth issue - redirect to login (proxy should handle this, but double-check)
      if (!pathname.includes('/login')) {
        router.push(buildLoginUrl(currentLocale, pathname))
      }
    } else if (status === "EMPTY") {
      // No workspaces - redirect to onboarding
      if (!pathname.includes('/onboarding')) {
        router.push(buildOnboardingUrl(currentLocale))
      }
    } else if (status === "ERROR" && error?.code === 'WORKSPACE_NOT_FOUND') {
      // Invalid workspace slug - redirect to first workspace or onboarding
      if (workspaces.length > 0) {
        router.push(buildWorkspaceUrl(currentLocale, workspaces[0].slug, "/home"))
      } else {
        router.push(buildOnboardingUrl(currentLocale))
      }
    } else if (status === "ERROR" && error?.code === 'NOT_FOUND') {
      // Workspace deleted/not found - redirect to first workspace or onboarding
      if (workspaces.length > 0) {
        router.push(buildWorkspaceUrl(currentLocale, workspaces[0].slug, "/home"))
      } else {
        router.push(buildOnboardingUrl(currentLocale))
      }
    }
  }, [status, error, workspaces, pathname, currentLocale, router])

  // Show loading state
  // Keep the existing UI mounted (including modals) when we already have workspace data
  if (!hasWorkspaceContext && (isLoadingUser || isLoadingWorkspace || status === "LOADING")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-96 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    )
  }

  // Show error/empty states (redirect will happen via useEffect)
  if (status === "NO_ACCESS" || status === "EMPTY" || (status === "ERROR" && (error?.code === 'WORKSPACE_NOT_FOUND' || error?.code === 'NOT_FOUND'))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">
            {status === "NO_ACCESS" ? "Access Denied" : 
             status === "EMPTY" ? "No Workspaces" : 
             "Workspace Not Found"}
          </p>
          <p className="text-sm text-muted-foreground">
            {error?.message || "Redirecting..."}
          </p>
        </div>
      </div>
    )
  }

  // Show generic error state
  if (status === "ERROR") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-lg font-semibold">Error</p>
          <p className="text-sm text-muted-foreground">{error?.message || "An error occurred"}</p>
        </div>
      </div>
    )
  }

  // Ready state - render children
  // Allow rendering while background refreshes keep status at LOADING
  if (currentWorkspace && (status === "READY" || status === "LOADING")) {
    return <>{children}</>
  }

  // Fallback (shouldn't reach here)
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-64 mx-auto" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
