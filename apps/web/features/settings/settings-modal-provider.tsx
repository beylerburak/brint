"use client"

import { SettingsModal } from "./settings-modal"
import { useSettingsModal } from "@/stores/use-settings-modal"

export function SettingsModalProvider() {
  const { open, setOpen, activeItem } = useSettingsModal()

  return (
    <SettingsModal
      open={open}
      onOpenChange={(next) => {
        // Allow ONLY explicit close or open actions
        setOpen(next)
      }}
      initialActiveItem={activeItem}
    />
  )
}
