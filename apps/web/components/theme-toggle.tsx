"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Hydration mismatch'i önlemek için
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="size-5" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  const handleToggle = () => {
    // Inject animation styles
    const styleId = `theme-transition-${Date.now()}`
    const style = document.createElement('style')
    style.id = styleId
    
    // Circle expand animation from center
    const css = `
      @supports (view-transition-name: root) {
        ::view-transition-old(root) { 
          animation: none;
        }
        ::view-transition-new(root) {
          animation: circle-expand 0.4s ease-out;
          transform-origin: center;
        }
        @keyframes circle-expand {
          from {
            clip-path: circle(0% at 50% 50%);
          }
          to {
            clip-path: circle(150% at 50% 50%);
          }
        }
      }
    `
    
    style.textContent = css
    document.head.appendChild(style)
    
    // Clean up animation styles after transition
    setTimeout(() => {
      const styleEl = document.getElementById(styleId)
      if (styleEl) {
        styleEl.remove()
      }
    }, 3000)

    // Use View Transitions API if available
    const updateTheme = () => {
      if (theme === "light") {
        setTheme("dark")
      } else if (theme === "dark") {
        setTheme("light")
      } else {
        setTheme("light")
      }
    }

    if ('startViewTransition' in document) {
      (document as any).startViewTransition(updateTheme)
    } else {
      updateTheme()
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
    >
      {theme === "dark" ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

