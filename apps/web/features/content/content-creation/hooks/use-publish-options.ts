import { useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import type { PublishMode } from "../content-creation.types"

interface UsePublishOptionsProps {
  publishMode: PublishMode
  selectedDate: Date | undefined
  selectedTime: string
  onPublishModeChange: (mode: PublishMode) => void
  onDateChange: (date: Date | undefined) => void
  onTimeChange: (time: string) => void
}

export function usePublishOptions({
  publishMode,
  selectedDate,
  selectedTime,
  onPublishModeChange,
  onDateChange,
  onTimeChange,
}: UsePublishOptionsProps) {
  const t = useTranslations("contentCreation")

  // Build final scheduledAt and status based on publish mode
  const getFinalScheduledAtAndStatus = useCallback((): {
    scheduledAt: string | null
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'
  } => {
    if (publishMode === 'now') {
      return {
        scheduledAt: new Date().toISOString(),
        status: 'PUBLISHED',
      }
    } else if (publishMode === 'setDateTime' && selectedDate && selectedTime) {
      const dateTime = new Date(selectedDate)
      const [hours, minutes] = selectedTime.split(':')
      dateTime.setHours(parseInt(hours), parseInt(minutes))
      return {
        scheduledAt: dateTime.toISOString(),
        status: 'SCHEDULED',
      }
    }
    return {
      scheduledAt: null,
      status: 'DRAFT',
    }
  }, [publishMode, selectedDate, selectedTime])

  // Get publish mode button label
  const publishModeLabel = useMemo(() => {
    if (publishMode === 'now') {
      return t("publishNow") || "Publish Now"
    } else if (publishMode === 'setDateTime') {
      if (selectedDate && selectedTime) {
        return `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${selectedTime}`
      } else if (selectedDate) {
        return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      return t("setDateTime") || "Set Date & Time"
    }
    return t("publishNow") || "Publish Now"
  }, [publishMode, selectedDate, selectedTime, t])

  // Handle date/time confirmation
  const handleDateTimeConfirm = useCallback(() => {
    if (selectedDate && selectedTime) {
      const dateTime = new Date(selectedDate)
      const [hours, minutes] = selectedTime.split(':')
      dateTime.setHours(parseInt(hours), parseInt(minutes))
      // The parent component will handle the actual state update
      return dateTime.toISOString()
    }
    return null
  }, [selectedDate, selectedTime])

  return {
    getFinalScheduledAtAndStatus,
    publishModeLabel,
    handleDateTimeConfirm,
  }
}

