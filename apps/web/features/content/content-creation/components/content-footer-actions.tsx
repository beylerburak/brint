import React, { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ButtonGroup } from "@/components/ui/button-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { IconSend, IconPin, IconChevronDown, IconCheck, IconSparkles, IconLock, IconClock } from "@tabler/icons-react"
import type { PublishMode } from "../content-creation.types"

interface ContentFooterActionsProps {
  // Left side - Create Another & Save Draft
  createAnother: boolean
  onCreateAnotherChange: (checked: boolean) => void
  onSaveDraft: () => void
  isSavingDraft: boolean
  canSaveDraft: boolean
  
  // Right side - Publish Options
  publishMode: PublishMode
  publishModeLabel: string
  selectedDate: Date | undefined
  selectedTime: string
  showPublishOptions: boolean
  showDateTimePicker: boolean
  onPublishOptionsOpenChange: (open: boolean) => void
  onPublishModeChange: (mode: PublishMode) => void
  onDateChange: (date: Date | undefined) => void
  onTimeChange: (time: string) => void
  onShowDateTimePickerChange: (show: boolean) => void
  onDateTimeConfirm: () => void
  onPublish: () => void
  isPublishing: boolean
  
  // Validation
  isDisabled: boolean
  disabledMessage: string
  publishButtonText: string
}

export const ContentFooterActions = React.memo(function ContentFooterActions({
  createAnother,
  onCreateAnotherChange,
  onSaveDraft,
  isSavingDraft,
  canSaveDraft,
  publishMode,
  publishModeLabel,
  selectedDate,
  selectedTime,
  showPublishOptions,
  showDateTimePicker,
  onPublishOptionsOpenChange,
  onPublishModeChange,
  onDateChange,
  onTimeChange,
  onShowDateTimePickerChange,
  onDateTimeConfirm,
  onPublish,
  isPublishing,
  isDisabled,
  disabledMessage,
  publishButtonText,
}: ContentFooterActionsProps) {
  const t = useTranslations("contentCreation")

  return (
    <div className="flex-shrink-0 border-t bg-background px-4 py-3 flex items-center justify-between gap-4">
      {/* Left Side - Create Another & Save Drafts */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="create-another"
            checked={createAnother}
            onCheckedChange={(checked) => onCreateAnotherChange(checked === true)}
          />
          <Label htmlFor="create-another" className="text-sm font-medium cursor-pointer">
            {t("createAnother")}
          </Label>
        </div>
        <div className="h-4 w-px bg-border"></div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSaveDraft}
          disabled={!canSaveDraft || isSavingDraft}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("saveDrafts")}
        </Button>
      </div>

      {/* Right Side - Publish Options */}
      <div className="flex items-center gap-2">
        <ButtonGroup>
          {/* Publish Mode Selector */}
          <Popover open={showPublishOptions} onOpenChange={onPublishOptionsOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 rounded-r-none"
              >
                {publishMode === 'now' && (
                  <>
                    <IconSend className="h-4 w-4" />
                    <span>{t("publishNow")}</span>
                  </>
                )}
                {publishMode === 'setDateTime' && (
                  <>
                    <IconPin className="h-4 w-4" />
                    <span>{publishModeLabel}</span>
                  </>
                )}
                <IconChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="end">
              {!showDateTimePicker ? (
                // Initial options screen
                <div className="p-2">
                  {/* Now */}
                  <button
                    type="button"
                    onClick={() => {
                      onPublishModeChange('now')
                      onPublishOptionsOpenChange(false)
                    }}
                    className={`w-full text-left p-2.5 rounded-md transition-colors ${
                      publishMode === 'now'
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {publishMode === 'now' && (
                          <IconCheck className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="text-sm font-semibold">Now</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Publish your post right away.
                    </p>
                  </button>

                  {/* Separator */}
                  <div className="h-px bg-border my-2" />

                  {/* Smart Time (AI) - Coming Soon */}
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: Show toast
                    }}
                    disabled
                    className="w-full text-left p-2.5 rounded-md transition-colors opacity-60 cursor-not-allowed relative"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <IconSparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold text-muted-foreground">{t("smartTime")}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                          <IconLock className="h-3 w-3" />
                          {t("comingSoon")}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("smartTimeDescription")}
                    </p>
                  </button>

                  {/* Set Date and Time */}
                  <button
                    type="button"
                    onClick={() => {
                      onPublishModeChange('setDateTime')
                      if (!selectedDate) {
                        onDateChange(new Date())
                      }
                      onShowDateTimePickerChange(true)
                    }}
                    className={`w-full text-left p-2.5 rounded-md transition-colors mt-2 ${
                      publishMode === 'setDateTime'
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {publishMode === 'setDateTime' && (
                          <IconCheck className="h-3.5 w-3.5 text-primary" />
                        )}
                        <span className="text-sm font-semibold">{t("setDateTime")}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("setDateTimeDescription")}
                    </p>
                  </button>
                </div>
              ) : (
                // Date & Time picker screen
                <div className="p-4 space-y-4">
                  {/* Calendar */}
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Select Date</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={onDateChange}
                      initialFocus
                    />
                  </div>

                  {/* Time Picker */}
                  <div>
                    <Label htmlFor="time-picker" className="text-xs font-medium mb-2 block">
                      {t("selectTime")} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </Label>
                    <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 w-full">
                      <IconClock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        id="time-picker"
                        type="time"
                        value={selectedTime}
                        onChange={(e) => onTimeChange(e.target.value)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto flex-1 w-full"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onShowDateTimePickerChange(false)
                      }}
                    >
                      ← {t("otherOptions")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={onDateTimeConfirm}
                      disabled={!selectedDate || !selectedTime}
                    >
                      {t("done")}
                    </Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Schedule/Publish Button */}
          {(() => {
            const button = (
              <Button
                variant="outline"
                className="rounded-l-none"
                onClick={onPublish}
                disabled={isDisabled || isPublishing}
              >
                {publishButtonText}
              </Button>
            )
            
            if (isDisabled && disabledMessage) {
              return (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div className="inline-block [&>button]:pointer-events-auto">
                      {button}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {disabledMessage}
                  </TooltipContent>
                </Tooltip>
              )
            }
            
            return button
          })()}
        </ButtonGroup>
      </div>
    </div>
  )
})
