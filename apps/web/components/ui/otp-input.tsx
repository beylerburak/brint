"use client"

import * as React from "react"
import { type SlotProps } from "input-otp"
import { cn } from "@/lib/utils"

const OTPInputSlot = React.forwardRef<HTMLDivElement, SlotProps>(
  ({ char, hasFakeCaret, isActive, placeholderChar, ...props }, ref) => {
    // Filter out non-DOM props (placeholderChar is not a valid DOM attribute)
    const { placeholderChar: _, ...domProps } = props as any
    
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
          isActive && "z-10 ring-2 ring-ring ring-offset-background"
        )}
        {...domProps}
      >
        {char}
        {hasFakeCaret && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
          </div>
        )}
      </div>
    )
  }
)
OTPInputSlot.displayName = "OTPInputSlot"

export { OTPInputSlot }
