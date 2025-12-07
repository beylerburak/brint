"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useLocale } from "next-intl"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { LogOut } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()
  
  // Extract locale from pathname for redirect
  const pathParts = pathname.split('/').filter(Boolean)
  const potentialLocale = pathParts[0]
  const currentLocale = ['en', 'tr'].includes(potentialLocale) ? potentialLocale : locale
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [hasWorkspaces, setHasWorkspaces] = useState(false)
  const [firstWorkspaceSlug, setFirstWorkspaceSlug] = useState<string | null>(null)

  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    try {
      const response = await apiClient.getMe()
      
      // If user already completed onboarding, ALWAYS redirect to first workspace
      // Don't show onboarding page at all for completed users
      if (response.user.onboardingCompletedAt) {
        if (response.workspaces.length > 0) {
          const firstWorkspace = response.workspaces[0]
          // Use locale prefix if locale is not default
          const redirectPath = currentLocale && currentLocale !== 'en'
            ? `/${currentLocale}/${firstWorkspace.slug}/home`
            : `/${firstWorkspace.slug}/home`
          router.replace(redirectPath)
          return
        }
        // If onboarding completed but no workspaces, still redirect away
        // (shouldn't happen, but handle gracefully)
        const loginPath = currentLocale && currentLocale !== 'en'
          ? `/${currentLocale}/login`
          : '/login'
        router.replace(loginPath)
        return
      }
      
      // If user has workspaces but onboarding not completed, they can complete it
      if (response.workspaces.length > 0) {
        setHasWorkspaces(true)
        setFirstWorkspaceSlug(response.workspaces[0].slug)
      } else {
        // No workspaces - need to create one first
        setHasWorkspaces(false)
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
      router.replace('/login')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteOnboarding = async () => {
    try {
      setIsCompleting(true)
      await apiClient.completeOnboarding()
      
      toast.success('Onboarding completed! Welcome aboard! 🎉')
      
      // Always redirect to first workspace after completing onboarding
      // Refresh user data to get latest workspace list
      try {
        const response = await apiClient.getMe()
        if (response.workspaces.length > 0) {
          const firstWorkspace = response.workspaces[0]
          // Use locale prefix if locale is not default
          const redirectPath = currentLocale && currentLocale !== 'en'
            ? `/${currentLocale}/${firstWorkspace.slug}/home`
            : `/${firstWorkspace.slug}/home`
          router.replace(redirectPath)
        } else if (firstWorkspaceSlug) {
          // Fallback to stored slug if refresh fails
          const redirectPath = currentLocale && currentLocale !== 'en'
            ? `/${currentLocale}/${firstWorkspaceSlug}/home`
            : `/${firstWorkspaceSlug}/home`
          router.replace(redirectPath)
        } else {
          const loginPath = currentLocale && currentLocale !== 'en'
            ? `/${currentLocale}/login`
            : '/login'
          router.replace(loginPath)
        }
      } catch (refreshError) {
        // If refresh fails, use stored slug
        if (firstWorkspaceSlug) {
          const redirectPath = currentLocale && currentLocale !== 'en'
            ? `/${currentLocale}/${firstWorkspaceSlug}/home`
            : `/${firstWorkspaceSlug}/home`
          router.replace(redirectPath)
        } else {
          const loginPath = currentLocale && currentLocale !== 'en'
            ? `/${currentLocale}/login`
            : '/login'
          router.replace(loginPath)
        }
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      toast.error('Failed to complete onboarding')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await apiClient.logout()
      toast.success('Logged out successfully')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Failed to logout:', error)
      toast.error('Failed to logout')
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md space-y-6 p-6 text-center">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-96 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-6 p-6">
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </Button>
        </div>
        
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Brint! 🎉
          </h1>
          <p className="text-muted-foreground">
            {hasWorkspaces 
              ? "You're all set! Let's get started." 
              : "Let's create your first workspace."}
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>
              {hasWorkspaces ? 'Ready to Start' : 'Create Workspace'}
            </CardTitle>
            <CardDescription>
              {hasWorkspaces 
                ? 'Your workspace is ready. Click below to start using Brint.' 
                : 'You need to create a workspace before you can start.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasWorkspaces ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>✓ Workspace created</p>
                  <p>✓ Account verified</p>
                  <p>✓ Ready to go!</p>
                </div>
                <Button 
                  onClick={handleCompleteOnboarding}
                  disabled={isCompleting}
                  className="w-full"
                  size="lg"
                >
                  {isCompleting ? 'Starting...' : 'Start Using Brint'}
                </Button>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                <p>Workspace creation flow will be implemented here.</p>
                <p className="mt-2">For now, workspaces are created automatically on first login.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

