import React from "react"
import { useTranslations } from "next-intl"
import { Label } from "@/components/ui/label"
import { SocialPlatformIcon, getPlatformColor } from "@/components/social-platform-icon"
import type { ContentFormFactor } from "@brint/shared-config/platform-rules"
import type { SocialAccount } from "../content-creation.types"

interface ContentAccountSelectorProps {
  socialAccounts: SocialAccount[]
  selectedAccountIds: string[]
  isLoadingAccounts: boolean
  formFactor: ContentFormFactor | null
  brandSlug?: string
  brandName?: string
  brandLogoUrl?: string
  onAccountToggle: (accountId: string) => void
  onSelectAll: () => void
  isAccountIncompatible: (accountId: string) => boolean
}

export const ContentAccountSelector = React.memo(function ContentAccountSelector({
  socialAccounts,
  selectedAccountIds,
  isLoadingAccounts,
  formFactor,
  brandSlug,
  brandName,
  brandLogoUrl,
  onAccountToggle,
  onSelectAll,
  isAccountIncompatible,
}: ContentAccountSelectorProps) {
  const t = useTranslations("contentCreation")

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{t("selectAccounts")}</Label>
        {(() => {
          // Calculate compatible accounts for dynamic label
          const compatibleAccounts = formFactor
            ? socialAccounts.filter(account => !isAccountIncompatible(account.id))
            : socialAccounts
          const allCompatibleSelected = compatibleAccounts.length > 0 && 
            compatibleAccounts.every(acc => selectedAccountIds.includes(acc.id))
          
          return (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs text-primary hover:underline"
            >
              {allCompatibleSelected ? (t("clearAll") || "Clear All") : (t("selectAll") || "Select All")}
            </button>
          )
        })()}
      </div>
      {isLoadingAccounts ? (
        <p className="text-sm text-muted-foreground">{t("loadingAccounts")}</p>
      ) : socialAccounts.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">{t("noAccountsAvailable")}</p>
          <p className="text-xs text-muted-foreground">
            {t("connectAccountsMessage")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {socialAccounts.map((account) => {
            const isIncompatible = isAccountIncompatible(account.id)
            const isSelected = selectedAccountIds.includes(account.id)
            const hasSelection = selectedAccountIds.length > 0
            const shouldDim = hasSelection && !isSelected && !isIncompatible
            
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => !isIncompatible && onAccountToggle(account.id)}
                disabled={isIncompatible}
                className={`
                  relative flex items-center justify-center transition-all
                  ${isIncompatible
                    ? "opacity-40 cursor-not-allowed"
                    : shouldDim
                    ? "opacity-80 hover:scale-105 cursor-pointer"
                    : isSelected
                    ? "ring-2 ring-primary ring-offset-2 rounded-full"
                    : "hover:scale-105 cursor-pointer"
                  }
                `}
                style={{ width: 48, height: 48 }}
              >
                {/* Account Avatar with Platform Border + Icon */}
                <div className="relative w-full h-full">
                  {/* Outer border with platform color */}
                  <div
                    className={`rounded-full p-0.5 flex items-center justify-center ${
                      isIncompatible
                        ? 'border border-border/50 dark:border-border/40'
                        : account.platform === 'X' || account.platform === 'TIKTOK'
                        ? 'border-2 border-gray-400 dark:border-gray-500'
                        : ''
                    }`}
                    style={{
                      backgroundColor: isIncompatible
                        ? 'transparent'
                        : account.platform === 'X' || account.platform === 'TIKTOK'
                        ? 'transparent'
                        : getPlatformColor(account.platform),
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {/* Inner white/background circle with padding */}
                    <div className="h-full w-full rounded-full bg-background p-0.5 flex items-center justify-center">
                      {/* Avatar */}
                      <div className="h-full w-full rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border/50 dark:border-border/40">
                        {account.avatarUrl || account.externalAvatarUrl ? (
                          <img
                            src={account.avatarUrl || account.externalAvatarUrl || ''}
                            alt={account.displayName || account.username || account.platform}
                            className="h-full w-full rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent && !parent.querySelector('img[data-brand-logo]') && brandLogoUrl) {
                                const fallback = document.createElement('img')
                                fallback.src = brandLogoUrl
                                fallback.alt = brandName || brandSlug || ''
                                fallback.className = 'h-full w-full rounded-full object-cover'
                                fallback.setAttribute('data-brand-logo', 'true')
                                parent.appendChild(fallback)
                              } else if (parent && !parent.querySelector('span[data-initials]')) {
                                const fallback = document.createElement('span')
                                fallback.className = 'text-[10px] font-semibold'
                                fallback.setAttribute('data-initials', 'true')
                                fallback.textContent = (account.displayName || account.username || account.platform).substring(0, 2).toUpperCase()
                                parent.appendChild(fallback)
                              }
                            }}
                          />
                        ) : brandLogoUrl ? (
                          <img
                            src={brandLogoUrl}
                            alt={brandName || brandSlug || ''}
                            className="h-full w-full rounded-full object-cover"
                            data-brand-logo="true"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold" data-initials="true">
                            {(account.displayName || account.username || account.platform).substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Platform Icon - positioned at bottom right, overlapping border */}
                  <div 
                    className="absolute rounded-full bg-background p-0.5 border border-border dark:border-border/60 shadow-sm"
                    style={{
                      bottom: -2,
                      right: -2,
                    }}
                  >
                    <SocialPlatformIcon
                      platform={account.platform}
                      size={16}
                      className="flex-shrink-0"
                    />
                  </div>
                  
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

