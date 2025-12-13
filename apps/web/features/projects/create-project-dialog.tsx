"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import type { ProjectStatus } from "@/lib/api/projects"

type Brand = {
  id: string
  name: string
  slug: string
}

type CreateProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onSuccess?: (project: any) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
}: CreateProjectDialogProps) {
  const t = useTranslations("projects")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<ProjectStatus>("PLANNED")
  const [brandId, setBrandId] = useState<string>("none")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Brands state
  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoadingBrands, setIsLoadingBrands] = useState(false)

  // Load brands when dialog opens
  useEffect(() => {
    if (open && workspaceId) {
      loadBrands()
    }
  }, [open, workspaceId])

  const loadBrands = async () => {
    setIsLoadingBrands(true)
    try {
      const response = await apiClient.listBrands(workspaceId)
      setBrands(response.brands)
    } catch (error) {
      console.error("Failed to load brands:", error)
      toast.error(t("form.errors.loadBrandsFailed") || "Failed to load brands")
    } finally {
      setIsLoadingBrands(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error(t("form.errors.nameRequired") || "Project name is required")
      return
    }

    setIsSubmitting(true)
    try {
      // Convert date strings to ISO date-time format
      const startDateTime = startDate ? new Date(startDate + "T00:00:00").toISOString() : undefined
      const endDateTime = endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined

      const { project } = await apiClient.createProject(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        brandId: brandId === "none" ? null : brandId,
        startDate: startDateTime,
        endDate: endDateTime,
      })

      toast.success(t("form.success") || "Project created successfully")
      onSuccess?.(project)
      handleClose()
    } catch (error) {
      console.error("Project creation failed:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : t("form.errors.createFailed") || "Failed to create project"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setName("")
    setDescription("")
    setStatus("PLANNED")
    setBrandId("none")
    setStartDate("")
    setEndDate("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("form.title") || "Create Project"}</DialogTitle>
          <DialogDescription>
            {t("form.description") || "Create a new project to organize your work."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t("form.name") || "Project Name"} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("form.namePlaceholder") || "Enter project name"}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("form.descriptionLabel") || "Description"}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder") || "Enter project description (optional)"}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">{t("form.brand") || "Brand"}</Label>
            <Select value={brandId} onValueChange={setBrandId} disabled={isLoadingBrands}>
              <SelectTrigger>
                <SelectValue placeholder={t("form.brandPlaceholder") || "Select a brand (optional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("form.brandNone") || "None"}</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t("form.status") || "Status"}</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as ProjectStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANNED">{t("form.statuses.planned") || "Planned"}</SelectItem>
                <SelectItem value="ACTIVE">{t("form.statuses.active") || "Active"}</SelectItem>
                <SelectItem value="COMPLETED">
                  {t("form.statuses.completed") || "Completed"}
                </SelectItem>
                <SelectItem value="ARCHIVED">
                  {t("form.statuses.archived") || "Archived"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t("form.startDate") || "Start Date"}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">{t("form.endDate") || "End Date"}</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              {t("form.cancel") || "Cancel"}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("form.creating") || "Creating..."}
                </>
              ) : (
                t("form.create") || "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
