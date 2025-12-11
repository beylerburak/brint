import React from "react"
import { useTranslations } from "next-intl"

export const ContentPreviewPanel = React.memo(function ContentPreviewPanel() {
  const t = useTranslations("contentCreation")

  return (
    <div className="w-full lg:w-[40%] xl:w-[35%] bg-muted/30 overflow-y-auto">
      <div className="p-4 sm:p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">{t("preview")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("previewPlaceholder")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

