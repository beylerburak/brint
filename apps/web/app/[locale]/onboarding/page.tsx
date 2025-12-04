"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function OnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [hasWorkspaces, setHasWorkspaces] = useState(false)
  const [firstWorkspaceSlug, setFirstWorkspaceSlug] = useState<string | null>(null)

  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    try {
      const response = await apiClient.getMe()
      
      // If user already completed onboarding, redirect to first workspace
      if (response.user.onboardingCompletedAt) {
        if (response.workspaces.length > 0) {
          const firstWorkspace = response.workspaces[0]
          router.replace(`/${firstWorkspace.slug}/home`)
          return
        }
      }
      
      // If user has workspaces, they can complete onboarding
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
      
      // Redirect to first workspace
      if (firstWorkspaceSlug) {
        router.replace(`/${firstWorkspaceSlug}/home`)
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
      toast.error('Failed to complete onboarding')
    } finally {
      setIsCompleting(false)
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

