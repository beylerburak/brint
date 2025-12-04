export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md space-y-6 p-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Brint! 🎉
          </h1>
          <p className="text-muted-foreground">
            Let&apos;s get you started by creating your first workspace.
          </p>
        </div>
        
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">
            This is your onboarding page. We&apos;ll add workspace creation here soon.
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>For now, you can explore the platform or contact support.</p>
        </div>
      </div>
    </div>
  )
}

