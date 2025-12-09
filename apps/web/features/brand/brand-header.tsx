"use client"

import { useState } from "react"
import { useParams, useRouter, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { BrandNavMenu } from "./brand-nav-menu"
import { BrandSwitcher } from "./brand-switcher"
import { IconArrowLeft, IconMenu2 } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { key: 'home', href: 'home' },
  { key: 'profile', href: 'profile' },
  { key: 'tasks', href: 'tasks' },
  { key: 'calendar', href: 'calendar' },
  { key: 'analytics', href: 'analytics' },
  { key: 'socialAccounts', href: 'social-accounts' },
  { key: 'publish', href: 'publish' },
] as const

export function BrandHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const t = useTranslations('brandNav')
  const locale = params?.locale as string || 'en'
  const workspaceSlug = params?.workspace as string
  const brandSlug = params?.brandSlug as string
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) => {
    return pathname.endsWith(`/${href}`)
  }

  const handleNavClick = (href: string) => {
    router.push(`/${locale}/${workspaceSlug}/${brandSlug}/${href}`)
    setMobileMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center gap-2 px-4 md:gap-4 md:px-6">
        {/* Mobile: Menu toggle (left) */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden shrink-0"
            >
              <IconMenu2 className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 px-4">
            <SheetHeader>
              <VisuallyHidden>
                <SheetTitle>Navigation</SheetTitle>
              </VisuallyHidden>
            </SheetHeader>
            <div className="mt-6 space-y-1">
              {/* Navigation items */}
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href)
                return (
                  <Button
                    key={item.key}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      active && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    onClick={() => handleNavClick(item.href)}
                  >
                    {t(item.key)}
                  </Button>
                )
              })}
              
              {/* Back to workspace - bottom */}
              <div className="pt-4">
                <Separator className="mb-4" />
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    router.push(`/${locale}/${workspaceSlug}/brands`)
                    setMobileMenuOpen(false)
                  }}
                >
                  <IconArrowLeft className="h-4 w-4 mr-2" />
                  Back to Workspace
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop: Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hidden md:flex"
          onClick={() => router.push(`/${locale}/${workspaceSlug}/brands`)}
        >
          <IconArrowLeft className="h-4 w-4" />
        </Button>

        {/* Brand switcher */}
        <BrandSwitcher />

        {/* Desktop: Separator + Navigation */}
        <Separator orientation="vertical" className="h-4 hidden md:block" />
        <div className="hidden md:block">
          <BrandNavMenu />
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

