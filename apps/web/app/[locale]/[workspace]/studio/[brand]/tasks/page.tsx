"use client";

/**
 * Studio Brand Tasks Page
 * 
 * Route: /[locale]/[workspace]/studio/[brand]/tasks
 * 
 * Task management page for the brand studio with Table and Kanban views.
 */

import * as React from "react";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Plus, 
  CheckCircle2,
  Circle,
  AlertCircle,
  Tag,
  User,
  Calendar,
  Flag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useStudioBrand } from "@/features/studio/hooks";
import { useStudioPageHeader } from "@/features/studio/context";
import { BiDataView, type BiDataViewColumn, type BiDataViewAction } from "@/components/generic/bi-data-view";
import { TaskDetailModal } from "@/features/studio/components/task-detail-modal";
import { getWorkspaceMembers, type WorkspaceMember } from "@/features/space/api/members-api";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listTaskCategories,
  listTaskStatuses,
  type Task,
  type TaskCategory,
  type TaskStatus,
  type TaskStatusGroup,
  type TaskPriority,
  type CreateTaskRequest,
} from "@/shared/api/task";

// ============================================================================
// Constants & Helpers
// ============================================================================

const PRIORITY_INFO: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: "Low", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

// Helper to get icon for status based on group
const getStatusIcon = (group: TaskStatusGroup) => {
  switch (group) {
    case "TODO":
      return <Circle className="h-4 w-4" />;
    case "IN_PROGRESS":
      return <Circle className="h-4 w-4 fill-current" />;
    case "DONE":
      return <CheckCircle2 className="h-4 w-4" />;
  }
};

// ============================================================================
// Badge Components
// ============================================================================

function StatusBadge({ status }: { status: Task["status"] }) {
  // Derive color based on status color or group
  const getBadgeColor = () => {
    if (status.color) {
      return {
        borderColor: status.color,
        color: status.color,
      };
    }
    // Fallback based on group
    switch (status.group) {
      case "TODO":
        return {};
      case "IN_PROGRESS":
        return {};
      case "DONE":
        return {};
      default:
        return {};
    }
  };

  return (
    <Badge 
      variant="outline" 
      className="shrink-0 text-xs flex items-center gap-1"
      style={getBadgeColor()}
    >
      <Circle className="h-3 w-3" />
      {status.name}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const info = PRIORITY_INFO[priority];
  return (
    <Badge variant="outline" className={`shrink-0 text-xs ${info.color}`}>
      {info.label}
    </Badge>
  );
}

// ============================================================================
// New Task Dialog Component
// ============================================================================

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  brandId: string;
  categories: TaskCategory[];
  statuses: TaskStatus[];
  onSuccess: () => void;
}

function NewTaskDialog({ 
  open, 
  onOpenChange, 
  workspaceId, 
  brandId, 
  categories,
  statuses,
  onSuccess 
}: NewTaskDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>(""); // Optional, backend uses default if empty
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskRequest) => createTask(workspaceId, data),
    onSuccess: () => {
      toast({
        title: "Task created",
        description: "Your task has been created successfully.",
      });
      onSuccess();
      onOpenChange(false);
      // Reset form
      setTitle("");
      setDescription("");
      setCategoryId("");
      setStatusId("");
      setPriority("MEDIUM");
      setDueDate("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create task",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a task title.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      statusId: statusId || null, // Optional, backend uses default "Not Started" if null
      priority,
      dueDate: dueDate || null,
      brandId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>
              Create a new task for your brand.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 
          -4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title..."
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Not Started (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_INFO) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_INFO[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Kanban Card Renderer
// ============================================================================

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, statusId: string) => void;
  onClick?: () => void;
}

function TaskCard({ task, onStatusChange, onClick }: TaskCardProps) {
  return (
    <div 
      className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {task.category && (
            <Badge 
              variant="outline" 
              className="shrink-0 text-xs"
              style={task.category.color ? { borderColor: task.category.color, color: task.category.color } : undefined}
            >
              {task.category.name}
            </Badge>
          )}
        </div>
        <PriorityBadge priority={task.priority} />
      </div>
      
      {/* Title */}
      <h4 className="font-medium text-sm mb-2">{task.title}</h4>
      
      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {task.description}
        </p>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {task.assignee && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate">{task.assignee.name || task.assignee.email}</span>
            </div>
          )}
        </div>
        {task.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
              }).format(new Date(task.dueDate))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function StudioBrandTasksPage() {
  const { toast } = useToast();
  const { brand } = useStudioBrand();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", brand.workspaceId, brand.id],
    queryFn: () => listTasks(brand.workspaceId, { brandId: brand.id }),
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["task-categories", brand.workspaceId, brand.id],
    queryFn: () => listTaskCategories(brand.workspaceId, { brandId: brand.id }),
  });

  // Fetch statuses
  const { data: statuses = [] } = useQuery({
    queryKey: ["task-statuses", brand.workspaceId, brand.id],
    queryFn: () => listTaskStatuses(brand.workspaceId, { brandId: brand.id }),
  });

  // Fetch workspace members
  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ["workspace-members", brand.workspaceId],
    queryFn: () => getWorkspaceMembers(brand.workspaceId),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(brand.workspaceId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", brand.workspaceId, brand.id] });
      toast({
        title: "Task deleted",
        description: "The task has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete task",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: string; statusId: string }) =>
      updateTask(brand.workspaceId, taskId, { statusId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", brand.workspaceId, brand.id] });
      toast({
        title: "Status updated",
        description: "The task status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Set page header
  const headerConfig = useMemo(() => ({
    title: "Tasks",
    description: `Manage tasks for ${brand.name}`,
    badge: !tasksLoading && tasks.length > 0 ? (
      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
        {tasks.length}
      </Badge>
    ) : undefined,
  }), [brand.name, tasks.length, tasksLoading]);
  
  useStudioPageHeader(headerConfig);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => 
    Array.from(new Set(tasks.map(t => t.status.name))).sort(),
    [tasks]
  );

  const uniquePriorities = useMemo(() => 
    Array.from(new Set(tasks.map(t => PRIORITY_INFO[t.priority].label))).sort(),
    [tasks]
  );

  const uniqueAssignees = useMemo(() => 
    Array.from(new Set(tasks.filter(t => t.assignee).map(t => t.assignee!.name || t.assignee!.email))).sort(),
    [tasks]
  );

  // Column definitions
  const columns: BiDataViewColumn<Task>[] = useMemo(() => [
    {
      id: "title",
      label: "Title",
      type: "text",
      width: "w-[400px]",
      accessorFn: (row) => row.title,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.category && (
            <Badge 
              variant="outline" 
              className="shrink-0 text-xs"
              style={row.category.color ? { borderColor: row.category.color, color: row.category.color } : undefined}
            >
              {row.category.name}
            </Badge>
          )}
          <span className="font-medium">{row.title}</span>
        </div>
      ),
    },
    // Hidden column for Kanban grouping by status ID
    {
      id: "statusId",
      label: "Status ID",
      type: "text",
      accessorFn: (row) => row.status.id,
      filterable: false,
      hiddenInTable: true,
    },
    {
      id: "status",
      label: "Status",
      type: "select",
      icon: <Circle className="h-4 w-4" />,
      options: uniqueStatuses,
      accessorFn: (row) => row.status.name,
      filterValueFn: (row) => row.status.id, // Use status ID for filtering
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "priority",
      label: "Priority",
      type: "select",
      icon: <Flag className="h-4 w-4" />,
      options: uniquePriorities,
      accessorFn: (row) => PRIORITY_INFO[row.priority].label,
      cell: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      id: "assignee",
      label: "Assignee",
      type: "select",
      icon: <User className="h-4 w-4" />,
      options: uniqueAssignees,
      accessorFn: (row) => row.assignee?.name || row.assignee?.email || "",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.assignee?.name || row.assignee?.email || "—"}
        </span>
      ),
    },
    {
      id: "dueDate",
      label: "Due Date",
      type: "date",
      icon: <Calendar className="h-4 w-4" />,
      accessorFn: (row) => row.dueDate || "",
      cell: (row) => {
        if (!row.dueDate) return <span className="text-sm text-muted-foreground">—</span>;
        
        const date = new Date(row.dueDate);
        const formatted = new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }).format(date);
        
        return (
          <span className="text-sm text-muted-foreground">
            {formatted}
          </span>
        );
      },
      sortValueFn: (row) => row.dueDate ? new Date(row.dueDate).getTime() : 0,
    },
  ], [uniqueStatuses, uniquePriorities, uniqueAssignees]);

  // Row actions
  const actions: BiDataViewAction<Task>[] = useMemo(() => {
    // Find "Completed" and "In Progress" statuses
    const completedStatus = statuses.find((s) => s.slug === "completed");
    const inProgressStatus = statuses.find((s) => s.slug === "in-progress");

    return [
      ...(completedStatus
        ? [
            {
              label: "Mark as Completed",
              icon: <CheckCircle2 className="mr-2 h-4 w-4" />,
              onClick: (task: Task) =>
                updateStatusMutation.mutate({ taskId: task.id, statusId: completedStatus.id }),
              disabled: (task: Task) => task.status.group === "DONE",
            },
          ]
        : []),
      ...(inProgressStatus
        ? [
            {
              label: "Mark as In Progress",
              icon: <Circle className="mr-2 h-4 w-4" />,
              onClick: (task: Task) =>
                updateStatusMutation.mutate({ taskId: task.id, statusId: inProgressStatus.id }),
              disabled: (task: Task) => task.status.id === inProgressStatus.id,
            },
          ]
        : []),
      {
        label: "Delete",
        icon: <Circle className="mr-2 h-4 w-4" />,
        onClick: (task: Task) => deleteMutation.mutate(task.id),
        destructive: true,
        separator: true,
      },
    ];
  }, [statuses, updateStatusMutation, deleteMutation]);

  const handleNewTask = useCallback(() => {
    setNewTaskDialogOpen(true);
  }, []);

  const handleTaskCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks", brand.workspaceId, brand.id] });
  }, [queryClient, brand.workspaceId, brand.id]);

  const handleTaskClick = useCallback((task: Task) => {
    // Update URL with taskId
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskId", task.id);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleTaskUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tasks", brand.workspaceId, brand.id] });
  }, [queryClient, brand.workspaceId, brand.id]);

  const handleCloseTaskDetail = useCallback(() => {
    // Remove taskId from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router]);

  // Get selected task from URL
  const taskId = searchParams.get("taskId");
  const selectedTask = useMemo(() => {
    if (!taskId) return null;
    return tasks.find((t) => t.id === taskId) || null;
  }, [taskId, tasks]);

  const taskDetailOpen = !!selectedTask;

  // Empty state
  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[300px] border rounded-lg border-dashed">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">No tasks yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create your first task to start managing your work for {brand.name}.
        </p>
      </div>
      <Button onClick={handleNewTask}>
        <Plus className="mr-2 h-4 w-4" />
        Create your first task
      </Button>
    </div>
  );

  // Toolbar actions
  const toolbarActions = (
    <Button onClick={handleNewTask} size="sm" className="gap-2">
      <Plus className="h-4 w-4" />
      New Task
    </Button>
  );

  // Kanban columns based on actual statuses (ordered by group, then order)
  const kanbanColumns = useMemo(() => {
    return statuses.map((status) => ({
      id: status.id,
      label: status.name,
      icon: getStatusIcon(status.group),
    }));
  }, [statuses]);

  // Kanban card renderer
  const renderKanbanCard = useCallback((task: Task) => (
    <TaskCard 
      task={task} 
      onStatusChange={(taskId, statusId) => updateStatusMutation.mutate({ taskId, statusId })}
      onClick={() => handleTaskClick(task)}
    />
  ), [updateStatusMutation, handleTaskClick]);

  return (
    <>
      <BiDataView
        data={tasks}
        columns={columns}
        getRowId={(task) => task.id}
        onRowClick={handleTaskClick}
        actions={actions}
        searchPlaceholder="Search tasks..."
        searchableColumns={["title"]}
        loading={tasksLoading}
        emptyState={emptyState}
        views={["table", "kanban"]}
        toolbarActions={toolbarActions}
        selectable={true}
        kanbanGroupKey="statusId"
        kanbanColumns={kanbanColumns}
        renderKanbanCard={renderKanbanCard}
      />

      <NewTaskDialog
        open={newTaskDialogOpen}
        onOpenChange={setNewTaskDialogOpen}
        workspaceId={brand.workspaceId}
        brandId={brand.id}
        categories={categories}
        statuses={statuses}
        onSuccess={handleTaskCreated}
      />

      {taskDetailOpen && selectedTask && (
        <TaskDetailModal
          open={taskDetailOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCloseTaskDetail();
            }
          }}
          task={selectedTask}
          workspaceId={brand.workspaceId}
          brand={{
            name: brand.name,
            slug: brand.slug,
            primaryColor: brand.primaryColor,
            logoUrl: null, // TODO: Get from brand.logoMedia?.url when available
          }}
          statuses={statuses}
          members={workspaceMembers.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
          }))}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </>
  );
}
