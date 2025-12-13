"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { LoaderIcon, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  iconBgColor: string
  isComingSoon?: boolean
  connected?: boolean
  onConnect?: () => void
  onDisconnect?: () => void
  isLoading?: boolean
}

export const WorkspaceIntegrationsContent = React.memo(() => {
  const t = useTranslations('settings')
  const { currentWorkspace } = useWorkspace()
  const [googleDriveStatus, setGoogleDriveStatus] = React.useState<{
    connected: boolean
    isLoading: boolean
  }>({
    connected: false,
    isLoading: true,
  })

  const loadGoogleDriveStatus = React.useCallback(async () => {
    if (!currentWorkspace) return

    try {
      const response = await apiClient.getGoogleDriveStatus(currentWorkspace.id)
      setGoogleDriveStatus({
        connected: response.status.connected,
        isLoading: false,
      })
    } catch (error) {
      console.error('Failed to load Google Drive status:', error)
      setGoogleDriveStatus({
        connected: false,
        isLoading: false,
      })
    }
  }, [currentWorkspace])

  React.useEffect(() => {
    loadGoogleDriveStatus()
  }, [loadGoogleDriveStatus])

  const handleGoogleDriveConnect = React.useCallback(async () => {
    if (!currentWorkspace) return

    try {
      const response = await apiClient.getGoogleDriveAuthUrl(currentWorkspace.id)
      // Open OAuth URL in new window/tab
      window.open(response.url, '_blank', 'width=500,height=600')
      // Poll for status change (user will redirect back after auth)
      // For now, just reload status after a delay
      setTimeout(() => {
        loadGoogleDriveStatus()
      }, 2000)
    } catch (error) {
      console.error('Failed to get Google Drive auth URL:', error)
      toast.error(t('failedToConnectIntegration') || 'Failed to connect integration')
    }
  }, [currentWorkspace, t, loadGoogleDriveStatus])

  const handleGoogleDriveDisconnect = React.useCallback(async () => {
    if (!currentWorkspace) return

    try {
      await apiClient.disconnectGoogleDrive(currentWorkspace.id)
      toast.success(t('integrationDisconnected') || 'Integration disconnected successfully')
      await loadGoogleDriveStatus()
    } catch (error) {
      console.error('Failed to disconnect Google Drive:', error)
      toast.error(t('failedToDisconnectIntegration') || 'Failed to disconnect integration')
    }
  }, [currentWorkspace, t, loadGoogleDriveStatus])

  const integrations: Integration[] = React.useMemo(
    () => [
      {
        id: 'google-drive',
        name: 'Google Drive',
        description: t('googleDriveDescription') || 'Access and import files directly from your Google Drive',
        icon: (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
            <path d="M2 11.9556C2 8.47078 2 6.7284 2.67818 5.39739C3.27473 4.22661 4.22661 3.27473 5.39739 2.67818C6.7284 2 8.47078 2 11.9556 2H20.0444C23.5292 2 25.2716 2 26.6026 2.67818C27.7734 3.27473 28.7253 4.22661 29.3218 5.39739C30 6.7284 30 8.47078 30 11.9556V20.0444C30 23.5292 30 25.2716 29.3218 26.6026C28.7253 27.7734 27.7734 28.7253 26.6026 29.3218C25.2716 30 23.5292 30 20.0444 30H11.9556C8.47078 30 6.7284 30 5.39739 29.3218C4.22661 28.7253 3.27473 27.7734 2.67818 26.6026C2 25.2716 2 23.5292 2 20.0444V11.9556Z" fill="white"/>
            <path d="M16.0022 12.4507L12.5413 6.34297C12.6562 6.22598 12.7884 6.14924 12.9206 6.09766C11.9 6.43355 11.4317 7.57961 11.4317 7.57961L5.1092 18.7345C5.02023 19.0843 4.99552 19.4 5.00664 19.6781H11.9074L16.0022 12.4507Z" fill="#34A853"/>
            <path d="M16.002 12.4507L20.0967 19.6781H26.9975C27.0086 19.4 26.9839 19.0843 26.8949 18.7345L20.5724 7.57961C20.5724 7.57961 20.1029 6.43355 19.0835 6.09766C19.2145 6.14924 19.3479 6.22598 19.4628 6.34297L16.002 12.4507Z" fill="#FBBC05"/>
            <path d="M16.0019 12.4514L19.4628 6.34371C19.3479 6.22671 19.2144 6.14997 19.0835 6.09839C18.9327 6.04933 18.7709 6.01662 18.5954 6.00781H18.4125H13.5913H13.4084C13.2342 6.01536 13.0711 6.04807 12.9203 6.09839C12.7894 6.14997 12.6559 6.22671 12.541 6.34371L16.0019 12.4514Z" fill="#188038"/>
            <path d="M11.9085 19.6782L8.48712 25.7168C8.48712 25.7168 8.37344 25.6614 8.21899 25.5469C8.70458 25.9206 9.17658 25.9998 9.17658 25.9998H22.6136C23.355 25.9998 23.5094 25.7168 23.5094 25.7168C23.5119 25.7155 23.5131 25.7142 23.5156 25.713L20.0967 19.6782H11.9085Z" fill="#4285F4"/>
            <path d="M11.9086 19.6782H5.00781C5.04241 20.4985 5.39826 20.9778 5.39826 20.9778L5.65773 21.4281C5.67627 21.4546 5.68739 21.4697 5.68739 21.4697L6.25205 22.461L7.51976 24.6676C7.55683 24.7569 7.60008 24.8386 7.6458 24.9166C7.66309 24.9431 7.67915 24.972 7.69769 24.9972C7.70263 25.0047 7.70757 25.0123 7.71252 25.0198C7.86944 25.2412 8.04489 25.4123 8.22034 25.5469C8.37479 25.6627 8.48847 25.7168 8.48847 25.7168L11.9086 19.6782Z" fill="#1967D2"/>
            <path d="M20.0967 19.6782H26.9974C26.9628 20.4985 26.607 20.9778 26.607 20.9778L26.3475 21.4281C26.329 21.4546 26.3179 21.4697 26.3179 21.4697L25.7532 22.461L24.4855 24.6676C24.4484 24.7569 24.4052 24.8386 24.3595 24.9166C24.3422 24.9431 24.3261 24.972 24.3076 24.9972C24.3026 25.0047 24.2977 25.0123 24.2927 25.0198C24.1358 25.2412 23.9604 25.4123 23.7849 25.5469C23.6305 25.6627 23.5168 25.7168 23.5168 25.7168L20.0967 19.6782Z" fill="#EA4335"/>
          </svg>
        ),
        iconBgColor: 'bg-white',
        connected: googleDriveStatus.connected,
        isLoading: googleDriveStatus.isLoading,
        onConnect: handleGoogleDriveConnect,
        onDisconnect: handleGoogleDriveDisconnect,
      },
      {
        id: 'telegram',
        name: 'Telegram',
        description: t('telegramDescription') || 'Connect Telegram to receive notifications and updates',
        icon: (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.85 8.723c-.129.581-.468.723-.951.449l-2.625-1.932-1.267 1.219c-.146.146-.269.269-.551.269l.188-2.664 4.849-4.378c.211-.188-.046-.291-.327-.107l-5.995 3.775-2.58-.806c-.562-.175-.576-.562.117-.854l10.087-3.888c.468-.175.878.112.728.842z" />
          </svg>
        ),
        iconBgColor: 'bg-[#0088cc]',
        isComingSoon: true,
      },
    ],
    [googleDriveStatus, handleGoogleDriveConnect, handleGoogleDriveDisconnect, t]
  )

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{t('integrations') || 'Integrations'}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('integrationsDescription') || 'Connect your favorite tools and services to enhance your workflow'}
        </p>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="relative flex flex-col p-5 rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Icon */}
            <div className={`${integration.iconBgColor} w-16 h-16 rounded-lg flex items-center justify-center mb-4 ${integration.iconBgColor === 'bg-white' ? 'shadow-sm' : ''}`}>
              {integration.icon}
            </div>

            {/* Title and Verified Badge */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base">{integration.name}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3 text-green-600 dark:text-green-400" />
                <span>{t('byBrint') || 'by Brint'}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              {integration.description}
            </p>

            {/* Action Button */}
            <div className="flex justify-end">
              {integration.isComingSoon ? (
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  {t('comingSoon') || 'Coming Soon'}
                </Button>
              ) : integration.isLoading ? (
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  <LoaderIcon className="size-4 mr-2 animate-spin" />
                  {t('loading') || 'Loading...'}
                </Button>
              ) : integration.connected ? (
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={integration.onDisconnect}
                    className="flex-1 sm:flex-initial"
                  >
                    {t('disconnect') || 'Disconnect'}
                  </Button>
                  <Button
                    variant="default"
                    disabled
                    className="flex-1 sm:flex-initial"
                  >
                    {t('connected') || 'Connected'}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={integration.onConnect}
                  className="w-full sm:w-auto"
                >
                  <ExternalLink className="size-4 mr-2" />
                  {t('connect') || 'Connect'}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

WorkspaceIntegrationsContent.displayName = "WorkspaceIntegrationsContent"
