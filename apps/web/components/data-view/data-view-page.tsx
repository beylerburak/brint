"use client"

import { useEffect, useState, ReactNode } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IconDots } from "@tabler/icons-react"
import { DataSummaryChart, SummaryChartConfig, ViewMode } from "./"
import { IconFlagFilled, IconList, IconCheck, IconAlertCircle } from "@tabler/icons-react"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"

export interface EmptyStateConfig {
  icon?: ReactNode // Icon to display in empty state
  title: string // Title text for empty state
  description?: string // Description text for empty state
  action?: ReactNode // Action button/content for empty state
}

interface DataViewPageProps {
  title: string // Title displayed on the left side of the header
  summaryConfig?: SummaryChartConfig // If provided, shows summary chart and toggle in dropdown
  viewMode: ViewMode
  availableViewModes?: ViewMode[]
  showCompleted?: boolean // If provided with onCompletedFilterChange, shows completed toggle in dropdown
  showSummary?: boolean
  onCompletedFilterChange?: (showCompleted: boolean) => void // Required if showCompleted is provided
  onSummaryVisibilityChange?: (showSummary: boolean) => void
  headerRight?: ReactNode // For toolbar or other header actions (desktop)
  headerRightMobile?: ReactNode // For mobile-specific header actions
  toolbar?: ReactNode // For toolbar below header (mobile)
  children: ReactNode
  summaryClassName?: string
  contentSpacing?: string // Spacing between toolbar/header and content (default: view mode based)
  isEmpty?: boolean // Whether to show empty state
  emptyState?: EmptyStateConfig // Configuration for empty state
  // Deprecated - use summaryConfig instead
  summaryStats?: any
}

export function DataViewPage({
  title,
  summaryConfig,
  viewMode,
  availableViewModes = ["table", "kanban", "calendar"],
  showCompleted: showCompletedProp = true,
  showSummary: showSummaryProp = true,
  onCompletedFilterChange,
  onSummaryVisibilityChange,
  headerRight,
  headerRightMobile,
  toolbar,
  children,
  summaryClassName,
  contentSpacing = "mt-6",
  isEmpty = false,
  emptyState,
}: DataViewPageProps) {
  const t = useTranslations("tasks")
  const isSummaryControlled = showSummaryProp !== undefined
  const isCompletedControlled = showCompletedProp !== undefined

  const [internalShowSummary, setInternalShowSummary] = useState<boolean>(showSummaryProp ?? true)
  const [internalShowCompleted, setInternalShowCompleted] = useState<boolean>(showCompletedProp ?? true)

  // Sync controlled props to internal state when provided
  useEffect(() => {
    if (showSummaryProp !== undefined) {
      setInternalShowSummary(showSummaryProp)
    }
  }, [showSummaryProp])

  useEffect(() => {
    if (showCompletedProp !== undefined) {
      setInternalShowCompleted(showCompletedProp)
    }
  }, [showCompletedProp])

  const showSummary = isSummaryControlled ? (showSummaryProp as boolean) : internalShowSummary
  // Only use completed state if both showCompleted and onCompletedFilterChange are provided
  const hasCompletedFeature = showCompletedProp !== undefined && onCompletedFilterChange !== undefined
  const showCompleted = hasCompletedFeature 
    ? (isCompletedControlled ? (showCompletedProp as boolean) : internalShowCompleted)
    : true // Default to true if feature is not enabled

  const handleSummaryToggle = () => {
    const newValue = !showSummary
    if (!isSummaryControlled) {
      setInternalShowSummary(newValue)
    }
    onSummaryVisibilityChange?.(newValue)
  }

  const handleCompletedToggle = () => {
    if (!hasCompletedFeature) return
    const newValue = !showCompleted
    if (!isCompletedControlled) {
      setInternalShowCompleted(newValue)
    }
    onCompletedFilterChange?.(newValue)
  }

  // Determine summary chart className based on view mode
  const getSummaryClassName = () => {
    if (summaryClassName) return summaryClassName
    if (viewMode === "table") return "pb-0"
    if (viewMode === "calendar") return "pb-4"
    return "pb-1"
  }

  // Determine data view container className
  const getDataViewClassName = () => {
    const baseClasses = `w-full flex-1 min-h-0 flex flex-col`
    // For empty state, use justify-start with some top margin to position it higher
    if (isEmpty && emptyState) {
      return `${baseClasses} justify-start`
    }
    return baseClasses
  }

  // Determine content spacing based on view mode
  const getContentSpacing = () => {
    if (contentSpacing !== "mt-6") {
      // Custom spacing provided, use it
      return contentSpacing
    }
    // Default spacing based on view mode
    if (viewMode === "calendar" || viewMode === "table") {
      return "mt-4"
    }
    // Kanban gets minimal spacing
    return "mt-1"
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {/* Only show dropdown if there are items to show */}
          {(summaryConfig || (showCompleted !== undefined && onCompletedFilterChange)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <IconDots className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {summaryConfig && (
                  <DropdownMenuItem onClick={handleSummaryToggle}>
                    {showSummary ? t("summary.hide") : t("summary.show")}
                  </DropdownMenuItem>
                )}
                {showCompleted !== undefined && onCompletedFilterChange && (
                  <DropdownMenuItem onClick={handleCompletedToggle}>
                    {showCompleted ? t("completed.hide") : t("completed.show")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Mobile header right actions */}
        {headerRightMobile && (
          <div className="sm:hidden ml-auto">
            {headerRightMobile}
          </div>
        )}

        {/* Desktop header right (toolbar) */}
        {headerRight && (
          <div className="hidden sm:flex flex-1 min-w-0 w-full">
            {headerRight}
          </div>
        )}
      </div>

      {/* Mobile Toolbar */}
      {toolbar && (
        <div className="sm:hidden mt-3 flex-shrink-0">
          {toolbar}
        </div>
      )}

      {/* Summary Chart - only show if summaryConfig is provided */}
      {summaryConfig && showSummary && (
        <div className="flex-shrink-0">
          <DataSummaryChart 
            config={summaryConfig}
            className={getSummaryClassName()}
          />
        </div>
      )}

      {/* Data View - scrollable content area */}
      <div className={cn(
        getDataViewClassName(),
        "overflow-auto", // Make this area scrollable
        // Apply spacing: if summary is shown and view is table, add margin-top
        // Otherwise, use default spacing (only when summary is closed, or summary is open but not table view)
        isEmpty && emptyState
          ? "" // No margin on container for empty state
          : showSummary && summaryConfig && viewMode === "table"
          ? "mt-3"
          : !showSummary ? getContentSpacing() : undefined
      )}>
        {isEmpty && emptyState ? (
          <Empty className="py-6 -mt-16">
            <EmptyHeader>
              {emptyState.icon && (
                <EmptyMedia variant="icon">
                  {emptyState.icon}
                </EmptyMedia>
              )}
              <EmptyTitle>{emptyState.title}</EmptyTitle>
              {emptyState.description && (
                <EmptyDescription>{emptyState.description}</EmptyDescription>
              )}
            </EmptyHeader>
            {emptyState.action && (
              <EmptyContent>
                {emptyState.action}
              </EmptyContent>
            )}
          </Empty>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
