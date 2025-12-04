"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { useWorkspace } from "@/contexts/workspace-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

type Brand = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

export function BrandSwitcher() {
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'en'
  const workspaceSlug = params?.workspace as string
  const currentBrandSlug = params?.brandSlug as string
  const { currentWorkspace } = useWorkspace()

  const [brands, setBrands] = React.useState<Brand[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  // Load brands
  React.useEffect(() => {
    if (currentWorkspace?.id) {
      loadBrands()
    }
  }, [currentWorkspace?.id])

  const loadBrands = async () => {
    if (!currentWorkspace?.id) return

    setIsLoading(true)
    try {
      const response = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}/brands`,
        { credentials: 'include' }
      )
      const data = await response.json()
      if (data.success) {
        setBrands(data.brands)
      }
    } catch (error) {
      console.error('Failed to load brands:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentBrand = brands.find(b => b.slug === currentBrandSlug)

  if (isLoading || !currentBrand) {
    return null
  }

  const handleBrandSwitch = (brandSlug: string) => {
    router.push(`/${locale}/${workspaceSlug}/${brandSlug}/home`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto !px-2 py-1.5 data-[state=open]:bg-accent gap-2"
        >
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={currentBrand.logoUrl || undefined} alt={currentBrand.name} />
            <AvatarFallback className="rounded-md text-xs">
              {currentBrand.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="font-medium text-sm leading-none">{currentBrand.name}</span>
            <span className="text-xs text-muted-foreground leading-none mt-1">@{currentBrand.slug}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 rounded-lg"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Switch Brand
        </DropdownMenuLabel>
        {brands.map((brand) => (
          <DropdownMenuItem
            key={brand.id}
            onClick={() => handleBrandSwitch(brand.slug)}
            className="gap-3 p-2"
            disabled={brand.slug === currentBrandSlug}
          >
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarImage src={brand.logoUrl || undefined} alt={brand.name} />
              <AvatarFallback className="rounded-md text-xs">
                {brand.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{brand.name}</span>
              <span className="text-xs text-muted-foreground">@{brand.slug}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

