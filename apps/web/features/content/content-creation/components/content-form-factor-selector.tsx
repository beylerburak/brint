import React from "react"
import { useTranslations } from "next-intl"
import { Label } from "@/components/ui/label"
import { IconPhoto, IconVideo } from "@tabler/icons-react"
import type { ContentFormFactor } from "@brint/shared-config/platform-rules"

interface ContentFormFactorSelectorProps {
  formFactor: ContentFormFactor | null
  onFormFactorChange: (factor: ContentFormFactor) => void
}

export const ContentFormFactorSelector = React.memo(function ContentFormFactorSelector({
  formFactor,
  onFormFactorChange,
}: ContentFormFactorSelectorProps) {
  const t = useTranslations("contentCreation")

  const formFactors = [
    { value: "FEED_POST" as ContentFormFactor, labelKey: "feedPost", icon: IconPhoto },
    { value: "STORY" as ContentFormFactor, labelKey: "story", icon: IconPhoto },
    { value: "VERTICAL_VIDEO" as ContentFormFactor, labelKey: "verticalVideo", icon: IconVideo },
  ]

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{t("contentType")}</Label>
      <div className="grid grid-cols-3 gap-2">
        {formFactors.map(({ value, labelKey, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onFormFactorChange(value)}
            className={`
              flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
              ${formFactor === value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent"
              }
            `}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
})

