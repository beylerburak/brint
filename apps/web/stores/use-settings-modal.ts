import { create } from "zustand"

interface UseSettingsModalStore {
  open: boolean
  activeItem: string | null
  setOpen: (open: boolean) => void
  setActiveItem: (item: string | null) => void
  openWithItem: (item: string | null) => void
}

export const useSettingsModal = create<UseSettingsModalStore>((set) => ({
  open: false,
  activeItem: 'user',
  setOpen: (open) => set({ open }),
  setActiveItem: (item) => set({ activeItem: item }),
  openWithItem: (item) => set({ open: true, activeItem: item }),
}))
