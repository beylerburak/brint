import React, { useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { ContentStatusType } from "../content-creation.types"

interface ContentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentStatus: ContentStatusType | null
  isDeleting: boolean
  onConfirm: () => void
}

export const ContentDeleteDialog = React.memo(function ContentDeleteDialog({
  open,
  onOpenChange,
  contentStatus,
  isDeleting,
  onConfirm,
}: ContentDeleteDialogProps) {
  const t = useTranslations("contentCreation")

  const translations = useMemo(() => {
    const isPublished = contentStatus === 'PUBLISHED' || contentStatus === 'PARTIALLY_PUBLISHED'
    const isDraftOrFailed = contentStatus === 'DRAFT' || contentStatus === 'FAILED'
    
    if (isPublished) {
      return {
        title: t("deleteDialog.published.title"),
        description: t("deleteDialog.published.description"),
        cancel: t("deleteDialog.published.cancel"),
        confirm: t("deleteDialog.published.confirm"),
      }
    } else if (isDraftOrFailed) {
      return {
        title: t("deleteDialog.draft.title"),
        description: t("deleteDialog.draft.description"),
        cancel: t("deleteDialog.draft.cancel"),
        confirm: t("deleteDialog.draft.confirm"),
      }
    } else {
      return {
        title: t("deleteDialog.default.title"),
        description: t("deleteDialog.default.description"),
        cancel: t("deleteDialog.default.cancel"),
        confirm: t("deleteDialog.default.confirm"),
      }
    }
  }, [contentStatus, t])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{translations.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {translations.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {translations.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? t("deleteDialog.deleting") : translations.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
})

