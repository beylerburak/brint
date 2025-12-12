"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconDots, IconPin, IconPinFilled } from "@tabler/icons-react"
import { SocialIcon } from "react-social-icons"

export default function BrandHomePage() {
  const params = useParams()
  const t = useTranslations('brandHome')
  const { currentWorkspace } = useWorkspace()
  const brandSlug = params?.brandSlug as string
  const workspaceSlug = params?.workspace as string
  const locale = (params?.locale as string) || 'en'
  
  const [isPinned, setIsPinned] = useState(false)
  const [brandInfo, setBrandInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)

  // Load brand info
  useEffect(() => {
    const loadBrandInfo = async () => {
      if (!currentWorkspace?.id) return

      try {
        const response = await apiClient.listBrands(currentWorkspace.id)
        const brand = response.brands.find(b => b.slug === brandSlug)
        if (brand) {
          setBrandInfo({
            name: brand.name,
            logoUrl: brand.logoUrl,
          })
        }
      } catch (error) {
        console.error('Failed to load brand info:', error)
      }
    }

    loadBrandInfo()
  }, [currentWorkspace?.id, brandSlug])

  // Check if brand is pinned on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = `pinned-brand-${workspaceSlug}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          const pinned = JSON.parse(stored)
          if (pinned.brandSlug === brandSlug) {
            setIsPinned(true)
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [workspaceSlug, brandSlug])

  const handlePinToggle = () => {
    if (typeof window !== 'undefined') {
      const key = `pinned-brand-${workspaceSlug}`
      
      if (isPinned) {
        // Unpin
        localStorage.removeItem(key)
        setIsPinned(false)
      } else {
        // Pin
        const pinData = {
          brandSlug,
          brandName: brandInfo?.name || brandSlug,
          logoUrl: brandInfo?.logoUrl || null,
        }
        localStorage.setItem(key, JSON.stringify(pinData))
        setIsPinned(true)
      }
      
      // Trigger a custom event to notify sidebar to update
      window.dispatchEvent(new CustomEvent('brand-pin-changed'))
    }
  }

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <IconDots className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePinToggle}>
                {isPinned ? (
                  <>
                    <IconPinFilled className="h-4 w-4 mr-2" />
                    {t('unpinFromMainMenu')}
                  </>
                ) : (
                  <>
                    <IconPin className="h-4 w-4 mr-2" />
                    {t('pinToMainMenu')}
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div>
        <p className="text-muted-foreground">Brand: @{brandSlug}</p>
      </div>
      
      {/* Social Media Icons Demo */}
      <div className="flex items-center gap-4 p-6 border rounded-lg">
        <SocialIcon network="facebook" style={{ height: 40, width: 40 }} />
        <SocialIcon network="instagram" style={{ height: 40, width: 40 }} />
        <SocialIcon network="youtube" style={{ height: 40, width: 40 }} />
        <SocialIcon network="linkedin" style={{ height: 40, width: 40 }} />
        <SocialIcon network="tiktok" style={{ height: 40, width: 40 }} />
        <SocialIcon network="x" style={{ height: 40, width: 40 }} />
        <SocialIcon network="pinterest" style={{ height: 40, width: 40 }} />
      </div>
    </div>
  )
}

