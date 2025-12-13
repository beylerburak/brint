"use client"

import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SettingsHeaderProps {
  activeItemName: string | null
  activeItem: string | null
  allItems: Array<{ id: string; name: string; group: string }>
  onItemClick: (id: string) => void
}

export const SettingsHeader = React.memo<SettingsHeaderProps>(
  ({ activeItemName, activeItem, allItems, onItemClick }) => {
    return (
      <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4 flex-1">
          {/* Mobile: Select dropdown */}
          <div className="md:hidden flex-1">
            <Select
              value={activeItem || undefined}
              onValueChange={(value) => onItemClick(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a section" />
              </SelectTrigger>
              <SelectContent>
                {allItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Desktop: Breadcrumb */}
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Settings</BreadcrumbLink>
              </BreadcrumbItem>
              {activeItemName && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeItemName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
    )
  }
)

SettingsHeader.displayName = "SettingsHeader"
