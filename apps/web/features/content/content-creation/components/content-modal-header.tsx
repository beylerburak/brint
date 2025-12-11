import React from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconX, IconDots, IconTrash } from "@tabler/icons-react"

interface ContentModalHeaderProps {
  contentId?: string | null
  brandSlug?: string
  brandName?: string
  brandLogoUrl?: string
  isDeleting: boolean
  onClose: () => void
  onDeleteClick: () => void
}

export const ContentModalHeader = React.memo(function ContentModalHeader({
  contentId,
  brandSlug,
  brandName,
  brandLogoUrl,
  isDeleting,
  onClose,
  onDeleteClick,
}: ContentModalHeaderProps) {
  const t = useTranslations("contentCreation")

  return (
    <div className="flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 flex-shrink-0 border-b">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
        <h2 className="text-base sm:text-lg font-semibold truncate">
          {contentId ? t("editTitle") : t("title")}
        </h2>
        {brandSlug && (
          <>
            <div className="h-4 sm:h-5 w-px bg-border flex-shrink-0"></div>
            <div className="flex items-center gap-1 sm:gap-1.5 pl-1 pr-1.5 sm:pl-1.5 sm:pr-2 py-0.5 sm:py-1 rounded-md text-xs sm:text-sm font-medium border border-border hover:bg-accent transition-colors cursor-default flex-shrink-0">
              <div className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt={brandName || brandSlug}
                    className="h-full w-full rounded-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent && !parent.querySelector('span')) {
                        const fallback = document.createElement('span')
                        fallback.className = 'text-[9px] sm:text-[10px] font-semibold'
                        fallback.textContent = (brandName?.substring(0, 2) || brandSlug.substring(0, 2)).toUpperCase()
                        parent.appendChild(fallback)
                      }
                    }}
                  />
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-semibold">
                    {brandName?.substring(0, 2).toUpperCase() || brandSlug.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span>@{brandSlug}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        {contentId && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <IconDots className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <div className="p-1">
                <button
                  type="button"
                  onClick={onDeleteClick}
                  disabled={isDeleting}
                  className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconTrash className="h-4 w-4" />
                  <span>{t("delete")}</span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})

