"use client"

import { ReactNode } from "react"
import { memo } from "react"

export interface SummaryStatItem {
  label: string // Pre-translated label text (caller should translate before passing)
  value: number
  icon?: ReactNode // Optional icon component
}

export interface SummaryChartConfig {
  leftSection?: SummaryStatItem[] // Left section stats (e.g., priority stats)
  rightSection?: SummaryStatItem[] // Right section stats (e.g., task stats)
}

interface DataSummaryChartProps {
  config: SummaryChartConfig
  className?: string
}

export const DataSummaryChart = memo(function DataSummaryChart({
  config,
  className = "",
}: DataSummaryChartProps) {
  return (
    <div className={`w-full pt-4 pb-1 ${className}`}>
      <div className="flex flex-row gap-2 sm:gap-4 w-full">
        {/* Left Section */}
        {config.leftSection && config.leftSection.length > 0 && (
          <div className="w-full h-auto sm:h-[88px] rounded-xl border border-muted-foreground/15 flex flex-col sm:flex-row items-center px-3 sm:px-6 py-3 sm:py-0">
            {config.leftSection.map((item, index) => (
              <div key={index} className="contents">
                <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto items-center sm:items-start">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-semibold">{item.value}</div>
                </div>
                {index < config.leftSection!.length - 1 && (
                  <>
                    <div className="hidden sm:block h-12 w-px bg-border mx-2 sm:mx-4 flex-shrink-0"></div>
                    <div className="sm:hidden w-full h-px bg-border my-2"></div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Right Section */}
        {config.rightSection && config.rightSection.length > 0 && (
          <div className="w-full h-auto sm:h-[88px] rounded-xl border border-muted-foreground/15 flex flex-col sm:flex-row items-center px-3 sm:px-6 py-3 sm:py-0">
            {config.rightSection.map((item, index) => (
              <div key={index} className="contents">
                <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto items-center sm:items-start">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-semibold">{item.value}</div>
                </div>
                {index < config.rightSection!.length - 1 && (
                  <>
                    <div className="hidden sm:block h-12 w-px bg-border mx-2 sm:mx-4 flex-shrink-0"></div>
                    <div className="sm:hidden w-full h-px bg-border my-2"></div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
