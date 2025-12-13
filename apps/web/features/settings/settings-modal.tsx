"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SettingsSidebar } from "./components/settings-sidebar"
import { SettingsContent } from "./components/settings-content"
import { useSettingsModal } from "@/stores/use-settings-modal"

export function SettingsModal({
  open,
  onOpenChange,
  initialActiveItem,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialActiveItem?: string | null
}) {
  const { activeItem: storeActiveItem, setActiveItem: setStoreActiveItem } = useSettingsModal()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = open !== undefined && onOpenChange !== undefined
  const dialogOpen = isControlled ? open : internalOpen
  const setDialogOpen = isControlled ? onOpenChange : setInternalOpen
  const activeItem = initialActiveItem !== undefined ? initialActiveItem : storeActiveItem

  const handleItemClick = React.useCallback((id: string) => {
    setStoreActiveItem(id)
  }, [setStoreActiveItem])


  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">Open Dialog</Button>
        </DialogTrigger>
      )}
      <DialogContent 
        className="overflow-hidden p-0 h-[90vh] w-full max-w-full sm:w-[95vw] sm:max-w-[95vw] md:w-[80vw] md:max-w-[80vw]"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          setDialogOpen(false)
        }}
        onPointerDownOutside={(e) => {
          // real outside click should close
          setDialogOpen(false)
        }}
        onInteractOutside={(e: DialogPrimitive.InteractOutsideEvent) => {
          // IMPORTANT: do NOT close on focus changes triggered by rerenders / portals (e.g. Sonner toast)
          const oe = e.detail?.originalEvent as Event | undefined
          if (oe && oe.type === "focusin") {
            e.preventDefault()
            return
          }
          // For pointer interactions, pointerDownOutside already handles it.
          // Do nothing here.
        }}
        onCloseAutoFocus={(e) => {
          // Prevent Radix from moving focus in a way that can trigger focusin outside loops
          e.preventDefault()
        }}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="flex h-full min-h-0">
          <SettingsSidebar activeItem={activeItem} onItemClick={handleItemClick} />
          <main className="flex flex-1 flex-col overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <SettingsContent activeItem={activeItem} />
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}
