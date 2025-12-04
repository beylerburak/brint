"use client"

import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { IconDots, IconPlus } from "@tabler/icons-react"

export default function BrandTasksPage() {
  const params = useParams()
  const brandSlug = params?.brandSlug as string

  return (
    <div className="w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <IconDots className="h-4 w-4" />
          </Button>
        </div>
        <Button>
          <IconPlus className="h-4 w-4" />
          Create Task
        </Button>
      </div>
      
      <div>
        <p className="text-muted-foreground">Brand: @{brandSlug}</p>
      </div>
    </div>
  )
}

