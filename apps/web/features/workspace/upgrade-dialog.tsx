"use client"

import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IconSparkles, IconCheck } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"

/**
 * UpgradeDialog Component
 * 
 * Generic upgrade dialog that can be triggered from any feature
 * when a plan limit is reached.
 * 
 * Features:
 * - Shows recommended plan based on current plan
 * - Displays plan features and pricing
 * - Translation support (EN/TR)
 * - Feature-based limiting (brands, storage, members)
 * 
 * Usage:
 * ```tsx
 * <UpgradeDialog
 *   open={showUpgrade}
 *   onOpenChange={setShowUpgrade}
 *   currentPlan="FREE"
 *   feature="brands"
 * />
 * ```
 * 
 * TODO:
 * - Add actual upgrade flow (payment integration)
 * - Add plan comparison table
 * - Add feature-specific messaging
 */

type UpgradeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlan: string
  feature: 'brands' | 'storage' | 'members' | 'socialAccounts'
}

// Plan limits and pricing (synced with backend app-config.ts)
const PLAN_FEATURES = {
  STARTER: {
    brands: 5,
    storage: '10GB',
    members: 5,
    price: '$29',
  },
  PRO: {
    brands: 20,
    storage: '100GB',
    members: 20,
    price: '$99',
  },
  AGENCY: {
    brands: 'Unlimited',
    storage: '500GB',
    members: 50,
    price: '$299',
  },
} as const

export function UpgradeDialog({
  open,
  onOpenChange,
  currentPlan,
  feature,
}: UpgradeDialogProps) {
  const t = useTranslations('upgrade')

  const getRecommendedPlan = () => {
    if (currentPlan === 'FREE') return 'STARTER'
    if (currentPlan === 'STARTER') return 'PRO'
    return 'AGENCY'
  }

  const recommendedPlan = getRecommendedPlan()
  const planFeatures = PLAN_FEATURES[recommendedPlan as keyof typeof PLAN_FEATURES]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <IconSparkles className="h-5 w-5 text-primary" />
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('description', { plan: currentPlan })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold">{recommendedPlan}</h4>
              <Badge variant="secondary">{t('recommended')}</Badge>
            </div>
            <p className="text-2xl font-bold mb-4">{planFeatures.price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span>{planFeatures.brands} {t('brands')}</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span>{planFeatures.storage} {t('storage')}</span>
              </li>
              <li className="flex items-center gap-2 text-sm">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span>{planFeatures.members} {t('teamMembers')}</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('notNow')}
          </Button>
          <Button disabled>
            <IconSparkles className="h-4 w-4 mr-2" />
            {t('upgradeTo', { plan: recommendedPlan })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

