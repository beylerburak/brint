"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { usePreference, PreferenceKeys } from "@/lib/preferences"
import { toast } from "sonner"
import { IconPlus } from "@tabler/icons-react"
import {
  DataViewPage,
  DataViewToolbar,
  DataViewTable,
  ViewMode,
  FilterTab,
  SummaryChartConfig,
  EmptyStateConfig,
} from "@/components/data-view"
import { IconList, IconCheck, IconAlertCircle, IconFlagFilled, IconFolder } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import type { Project, ProjectStatus } from "@/lib/api/projects"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { CreateProjectDialog } from "@/features/projects/create-project-dialog"

type ProjectTableRow = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  brandId: string | null
  brandName: string | null
  brandSlug: string | null
  brandLogoUrl: string | null
  taskCount: number
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export default function ProjectsPage() {
  const params = useParams()
  const router = useRouter()
  const { currentWorkspace } = useWorkspace()
  const t = useTranslations("projects")

  // State
  const [viewMode, setViewMode] = usePreference<ViewMode>(PreferenceKeys.TASKS_VIEW_MODE, {
    defaultValue: "table",
    storage: "url",
    urlParam: "view",
    scope: "workspace",
  })
  const [filterTab, setFilterTab] = useState<FilterTab>("all")
  const [searchValue, setSearchValue] = useState("")
  const [showCompleted, setShowCompleted] = usePreference<boolean>(PreferenceKeys.TASKS_SHOW_COMPLETED, {
    defaultValue: true,
    storage: "local",
    scope: "workspace",
    urlParam: "completed",
  })
  const [showSummary, setShowSummary] = usePreference<boolean>(PreferenceKeys.TASKS_SHOW_SUMMARY, {
    defaultValue: true,
    storage: "local",
    scope: "workspace",
    urlParam: "summary",
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [brands, setBrands] = useState<Array<{ id: string; name: string; slug: string; logoUrl: string | null }>>([])

  // Load projects and brands
  useEffect(() => {
    if (currentWorkspace?.id) {
      loadProjects()
      loadBrands()
    }
  }, [currentWorkspace?.id])

  const loadBrands = async () => {
    if (!currentWorkspace?.id) return

    try {
      const response = await apiClient.listBrands(currentWorkspace.id)
      setBrands(response.brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl })))
    } catch (error) {
      console.error("Failed to load brands:", error)
    }
  }

  const loadProjects = async () => {
    if (!currentWorkspace?.id) return

    setIsLoadingProjects(true)
    try {
      const response = await apiClient.listProjects(currentWorkspace.id, {
        limit: 100,
      })
      setProjects(response.projects)
    } catch (error) {
      console.error("Failed to load projects:", error)
      toast.error("Failed to load projects")
    } finally {
      setIsLoadingProjects(false)
    }
  }

  // Filter projects
  const filteredProjects = useMemo(() => {
    let result = projects

    // Filter by search
    if (searchValue) {
      const searchLower = searchValue.toLowerCase()
      result = result.filter(
        (project) =>
          project.name.toLowerCase().includes(searchLower) ||
          project.description?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by tab
    if (filterTab === "todo") {
      result = result.filter((p) => p.status === "PLANNED")
    } else if (filterTab === "inProgress") {
      result = result.filter((p) => p.status === "ACTIVE")
    } else if (filterTab === "completed") {
      result = result.filter((p) => p.status === "COMPLETED")
    } else if (filterTab === "overdue") {
      // Projects don't have overdue concept, skip
    } else if (filterTab === "all") {
      // Show all
    }

    // Filter by showCompleted
    if (!showCompleted) {
      result = result.filter((p) => p.status !== "COMPLETED" && p.status !== "ARCHIVED")
    }

    return result
  }, [projects, searchValue, filterTab, showCompleted])

  // Calculate summary config for projects
  const summaryConfig: SummaryChartConfig = useMemo(() => {
    const total = projects.length
    const active = projects.filter((p) => p.status === "ACTIVE").length
    const completed = projects.filter((p) => p.status === "COMPLETED").length
    const planned = projects.filter((p) => p.status === "PLANNED").length
    const archived = projects.filter((p) => p.status === "ARCHIVED").length

    return {
      leftSection: [
        {
          label: t("chart.planned") || "Planned",
          value: planned,
          icon: <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />,
        },
        {
          label: t("chart.active") || "Active",
          value: active,
          icon: <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-500" />,
        },
        {
          label: t("chart.archived") || "Archived",
          value: archived,
          icon: <IconFlagFilled className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />,
        },
      ],
      rightSection: [
        {
          label: t("chart.totalProjects") || "Total Projects",
          value: total,
          icon: <IconList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />,
        },
        {
          label: t("chart.completed") || "Completed",
          value: completed,
          icon: <IconCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />,
        },
      ],
    }
  }, [projects, t])

  // Convert projects to table data format
  const tableData: ProjectTableRow[] = useMemo(() => {
    return filteredProjects.map((project) => {
      const brand = project.brandId ? brands.find((b) => b.id === project.brandId) : null
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        brandId: project.brandId,
        brandName: brand?.name || null,
        brandSlug: brand?.slug || null,
        brandLogoUrl: brand?.logoUrl || null,
        taskCount: project.taskCount,
        startDate: project.startDate,
        endDate: project.endDate,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      }
    })
  }, [filteredProjects, brands])

  // Define columns for projects table
  const columns: ColumnDef<ProjectTableRow>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name}</div>
      ),
    },
    {
      accessorKey: "brandName",
      header: t("table.brand") || "Brand",
      cell: ({ row }) => {
        const { brandSlug, brandName, brandLogoUrl } = row.original
        if (!brandSlug) {
          return <div className="text-muted-foreground">-</div>
        }
        return (
          <div className="flex items-center gap-1.5 px-1 pr-2 py-1 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors cursor-default w-fit">
            <div className="h-5 w-5 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={brandName || brandSlug}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="text-[10px] font-semibold">
                  {brandName?.substring(0, 2).toUpperCase() || brandSlug.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            @{brandSlug}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status
        const variant = status === "ACTIVE" ? "default" : 
                       status === "COMPLETED" ? "secondary" : 
                       status === "PLANNED" ? "outline" : "destructive"
        return (
          <Badge variant={variant}>
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "taskCount",
      header: "Tasks",
      cell: ({ row }) => row.original.taskCount,
    },
    {
      accessorKey: "startDate",
      header: "Start Date",
      cell: ({ row }) => {
        if (!row.original.startDate) return "-"
        return new Date(row.original.startDate).toLocaleDateString()
      },
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => {
        if (!row.original.endDate) return "-"
        return new Date(row.original.endDate).toLocaleDateString()
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
  ], [])

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === "kanban") {
      setFilterTab("all")
    }
  }

  const handleCreateProject = () => {
    setIsCreateDialogOpen(true)
  }

  const handleProjectCreated = (newProject: Project) => {
    // Add new project to list
    setProjects((prev) => [newProject, ...prev])
    // Reload projects to get fresh data
    loadProjects()
  }

  const handleProjectClick = (project: ProjectTableRow) => {
    const locale = params?.locale as string
    const workspace = params?.workspace as string
    // Use project id as slug for now (can be changed to actual slug later)
    router.push(`/${locale}/${workspace}/projects/${project.id}`)
  }

  const handleDeleteProject = async (projectId: string | number) => {
    if (!currentWorkspace) return

    try {
      // TODO: Implement delete project API call
      // await apiClient.deleteProject(currentWorkspace.id, String(projectId))
      
      setProjects((prev) => prev.filter((p) => p.id !== String(projectId)))
      toast.success("Project deleted successfully")
    } catch (error: any) {
      toast.error("Failed to delete project")
    }
  }

  // Empty state configuration
  const isEmpty = !isLoadingProjects && filteredProjects.length === 0
  const emptyState: EmptyStateConfig | undefined = isEmpty ? {
    icon: <IconFolder className="h-8 w-8" />,
    title: t("empty.title") || "No projects found",
    description: t("empty.description") || "Get started by creating your first project.",
    action: (
      <Button onClick={handleCreateProject}>
        <IconPlus className="h-4 w-4 mr-2" />
        {t("empty.action") || "Create Project"}
      </Button>
    ),
  } : undefined

  // Desktop toolbar (header right)
  const desktopToolbar = (
    <DataViewToolbar
      viewMode={viewMode}
      filterTab={filterTab}
      searchValue={searchValue}
      onViewModeChange={handleViewModeChange}
      onFilterChange={setFilterTab}
      onSearchChange={setSearchValue}
      onCreate={handleCreateProject}
      createLabel={t("toolbar.create") || "New Project"}
      availableViewModes={["table"]}
      searchPlaceholder={t("toolbar.searchPlaceholder") || "Search projects..."}
      isEmpty={isEmpty}
      filterLabels={{
        filter: t("toolbar.filter") || "Filter",
        assignee: t("toolbar.assignee") || "Assignee",
        priority: t("toolbar.priority") || "Priority",
      }}
      tabLabels={{
        todo: t("toolbar.tabs.planned") || "Planned",
        inProgress: t("toolbar.tabs.active") || "Active",
        overdue: t("toolbar.tabs.overdue") || "Overdue",
        completed: t("toolbar.tabs.completed") || "Completed",
        all: t("toolbar.tabs.all") || "All",
      }}
    />
  )

  // Mobile toolbar (below header)
  const mobileToolbar = (
    <DataViewToolbar
      viewMode={viewMode}
      filterTab={filterTab}
      searchValue={searchValue}
      onViewModeChange={handleViewModeChange}
      onFilterChange={setFilterTab}
      onSearchChange={setSearchValue}
      onCreate={handleCreateProject}
      createLabel={t("toolbar.create") || "New Project"}
      availableViewModes={["table"]}
      searchPlaceholder={t("toolbar.searchPlaceholder") || "Search projects..."}
      isEmpty={isEmpty}
      filterLabels={{
        filter: t("toolbar.filter") || "Filter",
        assignee: t("toolbar.assignee") || "Assignee",
        priority: t("toolbar.priority") || "Priority",
      }}
      tabLabels={{
        todo: t("toolbar.tabs.planned") || "Planned",
        inProgress: t("toolbar.tabs.active") || "Active",
        overdue: t("toolbar.tabs.overdue") || "Overdue",
        completed: t("toolbar.tabs.completed") || "Completed",
        all: t("toolbar.tabs.all") || "All",
      }}
    />
  )

  return (
    <>
    <DataViewPage
      title={t("title")}
      summaryConfig={summaryConfig}
      viewMode={viewMode}
      showSummary={showSummary}
      showCompleted={showCompleted}
      onSummaryVisibilityChange={setShowSummary}
      onCompletedFilterChange={setShowCompleted}
      headerRight={desktopToolbar}
      headerRightMobile={
        <Button size="sm" onClick={handleCreateProject}>
          <IconPlus className="h-4 w-4" />
          {t("toolbar.create") || "New Project"}
        </Button>
      }
      toolbar={mobileToolbar}
      isEmpty={isEmpty}
      emptyState={emptyState}
    >
      {isLoadingProjects ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">{t("loading") || "Loading projects..."}</div>
        </div>
      ) : viewMode === "table" ? (
        <DataViewTable
          data={tableData}
          columns={columns}
          onRowClick={handleProjectClick}
          onDeleteRow={handleDeleteProject}
        />
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">
            {viewMode === "kanban" 
              ? (t("comingSoon.kanban") || "Kanban view coming soon")
              : (t("comingSoon.calendar") || "Calendar view coming soon")
            }
          </div>
        </div>
      )}
    </DataViewPage>

    {currentWorkspace && (
      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        workspaceId={currentWorkspace.id}
        onSuccess={handleProjectCreated}
      />
    )}
    </>
  )
}
