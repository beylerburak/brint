"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { IconDots, IconDownload } from "@tabler/icons-react"

export default function BrandAnalyticsPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <IconDots className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline">
          <IconDownload className="h-4 w-4" />
          Export Report
        </Button>
      </div>
      
      <div>
        <p className="text-muted-foreground">Brand: @{brandSlug}</p>
      </div>
    </div>
  )
}

