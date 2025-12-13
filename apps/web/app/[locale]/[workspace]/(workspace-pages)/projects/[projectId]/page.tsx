"use client"

import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params?.projectId as string
  const t = useTranslations("projects")

  if (!projectId) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold">
          {t("detail.title") || "Project Detail"}
        </h1>
      </div>

      <div className="flex-1">
        <p className="text-muted-foreground">
          Project ID: {projectId}
        </p>
      </div>
    </div>
  )
}
