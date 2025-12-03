"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  GripVertical, 
  ChevronRight,
  Trash2,
  Flag,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/features/space/context/workspace-context";
import {
  listTaskStatuses,
  createTaskStatus,
  updateTaskStatus,
  deleteTaskStatus,
  type TaskStatus,
  type TaskStatusGroup,
  type CreateTaskStatusRequest,
  type UpdateTaskStatusRequest,
} from "@/shared/api/task";

// Status group info
const STATUS_GROUP_INFO: Record<TaskStatusGroup, { label: string; icon: React.ReactNode }> = {
  TODO: { label: "To Do", icon: <Circle className="h-4 w-4" /> },
  IN_PROGRESS: { label: "In Progress", icon: <Circle className="h-4 w-4 fill-current" /> },
  DONE: { label: "Done", icon: <CheckCircle2 className="h-4 w-4" /> },
};

// Preset colors
const PRESET_COLORS = [
  { name: "Default", value: null },
  { name: "Gray", value: "#6B7280" },
  { name: "Brown", value: "#92400E" },
  { name: "Orange", value: "#F97316" },
  { name: "Yellow", value: "#F59E0B" },
  { name: "Green", value: "#10B981" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#EC4899" },
  { name: "Red", value: "#EF4444" },
];

interface StatusEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: TaskStatus | null;
  onSave: (data: UpdateTaskStatusRequest) => Promise<void>;
  onDelete: () => Promise<void>;
}

function StatusEditDialog({ 
  open, 
  onOpenChange, 
  status, 
  onSave, 
  onDelete 
}: StatusEditDialogProps) {
  const [name, setName] = React.useState("");
  const [group, setGroup] = React.useState<TaskStatusGroup>("TODO");
  const [color, setColor] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (status) {
      setName(status.name);
      setGroup(status.group);
      setColor(status.color);
    }
  }, [status]);

  const handleSave = async () => {
    if (!name.trim() || !status) return;

    setIsSaving(true);
    try {
      const updateData: UpdateTaskStatusRequest = {
        name: name.trim(),
        color,
      };
      
      // Only send group if status is not default
      if (!status.isDefault) {
        updateData.group = group;
      }

      await onSave(updateData);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await onDelete();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!status) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Status</DialogTitle>
          <DialogDescription>
            Customize this status for your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Status name"
              autoFocus
            />
          </div>

          {/* Group */}
          <div className="space-y-2">
            <Label htmlFor="group">Group</Label>
            <Select 
              value={group} 
              onValueChange={(v) => setGroup(v as TaskStatusGroup)}
              disabled={status.isDefault}
            >
              <SelectTrigger id="group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_GROUP_INFO) as TaskStatusGroup[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {STATUS_GROUP_INFO[g].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status.isDefault && (
              <p className="text-xs text-muted-foreground">
                Default statuses cannot be moved to different groups
              </p>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`h-10 rounded-md border-2 transition-all ${
                    color === preset.value
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/20"
                  }`}
                  style={{ backgroundColor: preset.value || "#27272a" }}
                  title={preset.name}
                >
                  {color === preset.value && (
                    <CheckCircle2 className="h-4 w-4 mx-auto text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          {!status.isDefault && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={isSaving}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Status
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NewStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultGroup?: TaskStatusGroup;
  onSave: (data: CreateTaskStatusRequest) => Promise<void>;
}

function NewStatusDialog({ 
  open, 
  onOpenChange, 
  defaultGroup = "TODO",
  onSave 
}: NewStatusDialogProps) {
  const [name, setName] = React.useState("");
  const [group, setGroup] = React.useState<TaskStatusGroup>(defaultGroup);
  const [color, setColor] = React.useState<string | null>("#6B7280");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setGroup(defaultGroup);
    }
  }, [open, defaultGroup]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        group,
        color,
        // brandId not sent = null (workspace-level)
      });
      onOpenChange(false);
      // Reset form
      setName("");
      setColor("#6B7280");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Status</DialogTitle>
          <DialogDescription>
            Create a new task status for your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. In Review, Blocked, QA Testing"
              autoFocus
            />
          </div>

          {/* Group */}
          <div className="space-y-2">
            <Label htmlFor="new-group">Group</Label>
            <Select value={group} onValueChange={(v) => setGroup(v as TaskStatusGroup)}>
              <SelectTrigger id="new-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_GROUP_INFO) as TaskStatusGroup[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {STATUS_GROUP_INFO[g].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`h-10 rounded-md border-2 transition-all ${
                    color === preset.value
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/20"
                  }`}
                  style={{ backgroundColor: preset.value || "#27272a" }}
                  title={preset.name}
                >
                  {color === preset.value && (
                    <CheckCircle2 className="h-4 w-4 mx-auto text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? "Creating..." : "Create Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkspaceTaskStatusesManager() {
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [editingStatus, setEditingStatus] = React.useState<TaskStatus | null>(null);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [newDialogOpen, setNewDialogOpen] = React.useState(false);
  const [newDialogDefaultGroup, setNewDialogDefaultGroup] = React.useState<TaskStatusGroup>("TODO");

  // Fetch workspace-level statuses only (brandId = null)
  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["workspace-task-statuses", workspace?.id],
    queryFn: () => listTaskStatuses(workspace!.id, { brandId: null }),
    enabled: !!workspace?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTaskStatusRequest) => createTaskStatus(workspace!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-task-statuses", workspace?.id] });
      toast({
        title: "Status created",
        description: "The task status has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create status",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskStatusRequest }) =>
      updateTaskStatus(workspace!.id, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-task-statuses", workspace?.id] });
      toast({
        title: "Status updated",
        description: "The task status has been updated successfully.",
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (statusId: string) => deleteTaskStatus(workspace!.id, statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-task-statuses", workspace?.id] });
      toast({
        title: "Status deleted",
        description: "The task status has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete status",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Group statuses by group
  const groupedStatuses = React.useMemo(() => {
    const groups: Record<TaskStatusGroup, TaskStatus[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };

    statuses.forEach((status) => {
      groups[status.group].push(status);
    });

    // Sort by order within each group
    Object.keys(groups).forEach((key) => {
      groups[key as TaskStatusGroup].sort((a, b) => a.order - b.order);
    });

    return groups;
  }, [statuses]);

  const handleEditStatus = (status: TaskStatus) => {
    setEditingStatus(status);
    setEditDialogOpen(true);
  };

  const handleNewStatus = (group: TaskStatusGroup) => {
    setNewDialogDefaultGroup(group);
    setNewDialogOpen(true);
  };

  const handleSaveEdit = async (data: UpdateTaskStatusRequest) => {
    if (!editingStatus) return;
    await updateMutation.mutateAsync({ id: editingStatus.id, data });
  };

  const handleDelete = async () => {
    if (!editingStatus || editingStatus.isDefault) return;
    await deleteMutation.mutateAsync(editingStatus.id);
  };

  if (!workspace?.id) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">No workspace selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Render each group */}
        {(Object.keys(STATUS_GROUP_INFO) as TaskStatusGroup[]).map((groupKey) => {
          const groupStatuses = groupedStatuses[groupKey];
          const groupInfo = STATUS_GROUP_INFO[groupKey];

          return (
            <div key={groupKey} className="space-y-2">
              {/* Group Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {groupInfo.label}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleNewStatus(groupKey)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Status List */}
              <div className="space-y-1">
                {groupStatuses.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => handleEditStatus(status)}
                    className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-accent transition-colors group"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                    <Badge
                      variant="outline"
                      className="shrink-0"
                      style={status.color ? { borderColor: status.color, color: status.color } : undefined}
                    >
                      <Circle className="h-2.5 w-2.5 mr-1.5 fill-current" />
                      {status.name}
                    </Badge>
                    {status.isDefault && (
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Default
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <StatusEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        status={editingStatus}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
      />

      {/* New Status Dialog */}
      <NewStatusDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        defaultGroup={newDialogDefaultGroup}
        onSave={(data) => createMutation.mutateAsync(data)}
      />
    </>
  );
}

