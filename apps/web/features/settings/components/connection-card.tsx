"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface ConnectionCardProps {
  icon: string | React.ReactNode
  title: string
  description: string
  buttonText: string
  onButtonClick?: () => void
  connected?: boolean
  disabled?: boolean
}

export function ConnectionCard({
  icon,
  title,
  description,
  buttonText,
  onButtonClick,
  connected = false,
  disabled = false,
}: ConnectionCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 bg-card transition-all duration-200 hover:shadow-sm hover:bg-accent/50 cursor-pointer">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          {typeof icon === "string" ? (
            <div className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center bg-muted p-1.5">
              <Image
                src={icon}
                alt={title}
                width={40}
                height={40}
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center bg-muted">
              {icon}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button
        onClick={onButtonClick}
        disabled={disabled}
        variant={connected ? "outline" : "default"}
        className="w-full"
      >
        {buttonText}
      </Button>
    </div>
  )
}

