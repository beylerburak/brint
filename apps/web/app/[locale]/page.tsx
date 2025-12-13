"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useLocale } from "next-intl"
import { apiClient } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { buildWorkspaceUrl, buildOnboardingUrl, buildLoginUrl } from "@/lib/locale-path"

export default function LocaleRootPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const currentLocale = (params?.locale as string) || locale

  useEffect(() => {
    redirectToWorkspace()
  }, [])

  const redirectToWorkspace = async () => {
    try {
      const response = await apiClient.getMe()
      
      // Redirect to first workspace
      if (response.workspaces.length > 0) {
        const firstWorkspace = response.workspaces[0]
        router.replace(buildWorkspaceUrl(currentLocale, firstWorkspace.slug, "/home"))
      } else {
        // No workspaces - go to onboarding
        router.replace(buildOnboardingUrl(currentLocale))
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
      router.replace(buildLoginUrl(currentLocale))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-64 mx-auto" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
