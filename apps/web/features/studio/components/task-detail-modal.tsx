"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Flag,
  MoreVertical,
  Tag,
  User,
  X,
  ChevronUp,
  ChevronDown,
  Smile,
  AtSign,
  Link2,
  Paperclip,
  Clock,
  Upload,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import {
  updateTask,
  listTaskAttachments,
  addTaskAttachment,
  deleteTaskAttachment,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TaskAttachment,
} from "@/shared/api/task";
import {
  presignUpload,
  finalizeUpload,
  presignDownload,
} from "@/shared/api/media";
import { MediaViewerModal, type MediaViewerFile } from "./media-viewer-modal";

const PRIORITY_INFO: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: "Low", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
  MEDIUM: { label: "Medium", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  URGENT: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

interface BrandInfo {
  name: string;
  slug: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
}

interface WorkspaceMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  workspaceId: string;
  brand: BrandInfo;
  statuses: TaskStatus[];
  members?: WorkspaceMember[];
  onTaskUpdated?: () => void;
}

export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  workspaceId,
  brand,
  statuses,
  members = [],
  onTaskUpdated,
}: TaskDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState("");
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [editedDescription, setEditedDescription] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [dueDateDialogOpen, setDueDateDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = React.useState("00:00");
  const titleTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerIndex, setViewerIndex] = React.useState(0);
  const [presignedUrls, setPresignedUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (task) {
      setEditedTitle(task.title);
      setEditedDescription(task.description || "");
      if (task.dueDate) {
        // Parse UTC date - browser automatically converts to local timezone
        const localDate = new Date(task.dueDate);
        
        // Set calendar date (without time)
        setSelectedDate(localDate);
        
        // Set time from local date
        setSelectedTime(
          `${String(localDate.getHours()).padStart(2, "0")}:${String(localDate.getMinutes()).padStart(2, "0")}`
        );
      } else {
        setSelectedDate(undefined);
        setSelectedTime("12:00"); // Default to noon
      }
    }
  }, [task]);

  // Auto-resize textarea when editing title
  React.useEffect(() => {
    if (isEditingTitle && titleTextareaRef.current) {
      const textarea = titleTextareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, [isEditingTitle, editedTitle]);

  // Auto-resize textarea when editing description
  React.useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      const textarea = descriptionTextareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, [isEditingDescription, editedDescription]);

  // Update mutation with optimistic update
  const updateMutation = useMutation({
    mutationFn: (data: { 
      statusId?: string; 
      priority?: TaskPriority; 
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      assigneeId?: string | null;
    }) =>
      updateTask(workspaceId, task!.id, data),
    onSuccess: (updatedTask) => {
      // Invalidate queries to refetch
      onTaskUpdated?.();
      
      toast({
        title: "Task updated",
        description: "The task has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update task",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Fetch attachments
  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["task-attachments", task?.id],
    queryFn: () => listTaskAttachments(workspaceId, task!.id),
    enabled: !!task?.id,
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      deleteTaskAttachment(workspaceId, task!.id, attachmentId),
    onSuccess: () => {
      refetchAttachments();
      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete attachment",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (statusId: string) => {
    updateMutation.mutate({ statusId });
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateMutation.mutate({ priority });
  };

  const handleAssigneeChange = (assigneeId: string | null) => {
    updateMutation.mutate({ assigneeId });
  };

  const handleDueDateChange = (dateTimeStr: string | null) => {
    updateMutation.mutate({ dueDate: dateTimeStr });
  };

  const handleDueDateSave = () => {
    if (!selectedDate) {
      handleDueDateChange(null);
      setDueDateDialogOpen(false);
      return;
    }

    // User selects date + time in their local timezone
    // Browser automatically handles timezone conversion
    const [hours, minutes] = selectedTime.split(":").map(Number);
    
    // Create a new Date object with selected date and time
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const day = selectedDate.getDate();
    
    // Create date in user's local timezone
    const localDateTime = new Date(year, month, day, hours, minutes, 0, 0);
    
    // toISOString() automatically converts to UTC
    handleDueDateChange(localDateTime.toISOString());
    setDueDateDialogOpen(false);
  };

  const handleTitleSave = () => {
    if (!editedTitle.trim() || editedTitle === task?.title) {
      setIsEditingTitle(false);
      return;
    }
    updateMutation.mutate({ title: editedTitle.trim() });
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    const trimmedDesc = editedDescription.trim();
    if (trimmedDesc === (task?.description || "")) {
      setIsEditingDescription(false);
      return;
    }
    updateMutation.mutate({ description: trimmedDesc || null });
    setIsEditingDescription(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    try {
      // 1. Presign upload
      const presignData = await presignUpload({
        workspaceId,
        brandId: task!.brandId || undefined,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      // 2. Upload to S3
      const uploadResponse = await fetch(presignData.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      // 3. Finalize upload
      const finalizeData = await finalizeUpload({
        objectKey: presignData.objectKey,
        workspaceId,
        brandId: task!.brandId || undefined,
        originalName: file.name,
        contentType: file.type,
      });

      // 4. Add attachment to task
      await addTaskAttachment(workspaceId, task!.id, finalizeData.media.id);

      // 5. Refetch attachments
      refetchAttachments();

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return <FileImage className="h-4 w-4" />;
    if (contentType.startsWith("video/")) return <FileVideo className="h-4 w-4" />;
    if (contentType.startsWith("audio/")) return <FileAudio className="h-4 w-4" />;
    if (contentType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <Paperclip className="h-4 w-4" />;
  };

  // Convert attachments to viewer format
  const viewerFiles = React.useMemo((): MediaViewerFile[] => {
    return attachments.map((attachment) => ({
      id: attachment.id,
      originalName: attachment.media.originalName,
      contentType: attachment.media.contentType,
      sizeBytes: attachment.media.sizeBytes,
      objectKey: attachment.media.objectKey,
      // Use presigned URL from cache or placeholder
      url: presignedUrls[attachment.media.objectKey] || "",
    }));
  }, [attachments, presignedUrls]);

  const handleAttachmentClick = async (index: number) => {
    const attachment = attachments[index];
    const objectKey = attachment.media.objectKey;

    // Check if URL is already cached
    if (!presignedUrls[objectKey]) {
      try {
        const { downloadUrl } = await presignDownload(objectKey, workspaceId);
        setPresignedUrls((prev) => ({ ...prev, [objectKey]: downloadUrl }));
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load file",
          variant: "destructive",
        });
        return;
      }
    }

    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleDownload = async (file: MediaViewerFile) => {
    try {
      // Get presigned URL if not cached
      let downloadUrl = file.url;
      if (!downloadUrl) {
        const response = await presignDownload(file.objectKey, workspaceId);
        downloadUrl = response.downloadUrl;
        setPresignedUrls((prev) => ({ ...prev, [file.objectKey]: downloadUrl }));
      }

      // Trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.originalName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleCommentSubmit = () => {
    if (!comment.trim()) return;
    
    // TODO: Implement comment creation API
    toast({
      title: "Coming soon",
      description: "Comment functionality will be available soon.",
    });
    setComment("");
  };

  if (!task) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[50vw] max-w-[50vw] sm:max-w-[50vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col shadow-none" showCloseButton={false}>
          <DialogTitle className="sr-only">{task.title}</DialogTitle>
          <DialogDescription className="sr-only">Task details and comments</DialogDescription>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-6 pt-4 pb-6 overflow-y-auto flex-1">
              {/* Brand Info */}
              <div className="flex items-center gap-2 mb-3">
                {brand.logoUrl ? (
                  <img 
                    src={brand.logoUrl} 
                    alt={brand.name}
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : (
                  <div 
                    className="h-5 w-5 rounded flex items-center justify-center text-xs font-semibold"
                    style={{ 
                      backgroundColor: brand.primaryColor || "#8B5CF6",
                      color: "white"
                    }}
                  >
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium">{brand.name}</span>
              </div>

              {/* Title */}
              <div className="mb-6">
                {isEditingTitle ? (
                  <Textarea
                    ref={titleTextareaRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleTitleSave();
                      }
                      if (e.key === "Escape") {
                        setEditedTitle(task.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    className="!text-2xl !leading-tight font-semibold border-0 px-2 py-1 min-h-0 h-auto resize-none focus-visible:ring-0 focus-visible:ring-offset-0 overflow-hidden"
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-2xl font-semibold cursor-pointer hover:bg-accent/50 rounded px-2 py-1 break-words"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {task.title}
                  </h2>
                )}
              </div>

              {/* Attributes List */}
              <div className="space-y-2 mb-6">
                {/* Status */}
                <div className="flex items-center gap-3 h-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-32">
                    <Circle className="h-4 w-4" />
                    <span>Status</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="outline-none">
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-accent transition-colors h-6"
                          style={task.status.color ? { borderColor: task.status.color, color: task.status.color } : undefined}
                        >
                          <Circle className="h-2.5 w-2.5 mr-1.5 fill-current" />
                          {task.status.name}
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {statuses.map((status) => (
                        <DropdownMenuItem
                          key={status.id}
                          onClick={() => handleStatusChange(status.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: status.color || "#6B7280" }}
                            />
                            {status.name}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-3 h-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-32">
                    <Flag className="h-4 w-4" />
                    <span>Priority</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="outline-none">
                        <Badge
                          variant="outline"
                          className={`cursor-pointer hover:bg-accent transition-colors h-6 ${PRIORITY_INFO[task.priority].color}`}
                        >
                          {PRIORITY_INFO[task.priority].label}
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(Object.keys(PRIORITY_INFO) as TaskPriority[]).map((p) => (
                        <DropdownMenuItem
                          key={p}
                          onClick={() => handlePriorityChange(p)}
                        >
                          {PRIORITY_INFO[p].label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-3 h-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-32">
                    <User className="h-4 w-4" />
                    <span>Assigned to</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 outline-none hover:bg-accent/50 px-2 py-1 rounded transition-colors">
                        {task.assignee ? (
                          <>
                            <Avatar className="h-6 w-6">
                              {task.assignee.name && (
                                <AvatarFallback className="text-xs">
                                  {task.assignee.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <span className="text-sm">{task.assignee.name || task.assignee.email}</span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px]">
                      <DropdownMenuItem onClick={() => handleAssigneeChange(null)}>
                        <span className="text-muted-foreground">Unassigned</span>
                      </DropdownMenuItem>
                      {members.map((member) => (
                        <DropdownMenuItem
                          key={member.id}
                          onClick={() => handleAssigneeChange(member.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {member.name && (
                                <AvatarFallback className="text-xs">
                                  {member.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <span>{member.name || member.email}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-3 h-8">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground w-32">
                    <Calendar className="h-4 w-4" />
                    <span>Due Date</span>
                  </div>
                  <button 
                    className="text-sm outline-none hover:bg-accent/50 px-2 py-1 rounded transition-colors text-left"
                    onClick={() => setDueDateDialogOpen(true)}
                  >
                    {task.dueDate
                      ? new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false, // TODO: Use userTimeFormat when user preferences are implemented
                        }).format(new Date(task.dueDate))
                      : "No due date"}
                  </button>
                </div>

                {/* Category */}
                {task.category && (
                  <div className="flex items-center gap-3 h-8">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground w-32">
                      <Tag className="h-4 w-4" />
                      <span>Category</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="h-6"
                      style={task.category.color ? { borderColor: task.category.color, color: task.category.color } : undefined}
                    >
                      {task.category.name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="comments" className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                  <TabsTrigger
                    value="comments"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
                  >
                    Comments
                    <Badge variant="secondary" className="ml-2">
                      0
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="description"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
                  >
                    Description
                  </TabsTrigger>
                  <TabsTrigger
                    value="attachments"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
                  >
                    Attachments
                    <Badge variant="secondary" className="ml-2">
                      {attachments.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Comments Tab */}
                <TabsContent value="comments" className="mt-4 space-y-4">
                  {/* Comment Input */}
                  <div className="space-y-2">
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      className="resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Smile className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <AtSign className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Link2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        onClick={handleCommentSubmit}
                        disabled={!comment.trim()}
                        size="sm"
                      >
                        Submit
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4">
                    {/* Created by comment */}
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {task.reporter.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{task.reporter.name || task.reporter.email}</span>
                          <span className="text-muted-foreground">created this task</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">
                            {new Intl.RelativeTimeFormat("en", { style: "short" }).format(
                              Math.floor((new Date(task.createdAt).getTime() - Date.now()) / (1000 * 60 * 60)),
                              "hour"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Placeholder for future comments */}
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No comments yet. Be the first to comment!
                    </div>
                  </div>
                </TabsContent>

                {/* Description Tab */}
                <TabsContent value="description" className="mt-4">
                  {isEditingDescription ? (
                    <Textarea
                      ref={descriptionTextareaRef}
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      onBlur={handleDescriptionSave}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditedDescription(task.description || "");
                          setIsEditingDescription(false);
                        }
                        // Ctrl/Cmd+Enter to save
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleDescriptionSave();
                        }
                      }}
                      className="text-sm border-0 px-2 py-1 min-h-[200px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Add a description..."
                      autoFocus
                    />
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-accent/50 rounded px-2 py-1 min-h-[200px]"
                      onClick={() => setIsEditingDescription(true)}
                    >
                      {task.description ? (
                        <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Click to add a description...</p>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments" className="mt-4">
                  <div className="space-y-4">
                    {/* Upload Button */}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload File
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Attachments List */}
                    {attachments.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No attachments yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {attachments.map((attachment, index) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                          >
                            <div 
                              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                              onClick={() => handleAttachmentClick(index)}
                            >
                              <div className="text-muted-foreground group-hover:text-primary transition-colors">
                                {getFileIcon(attachment.media.contentType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                  {attachment.media.originalName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatFileSize(attachment.media.sizeBytes)}</span>
                                  <span>•</span>
                                  <span>
                                    {new Date(attachment.createdAt).toLocaleDateString()}
                                  </span>
                                  <span>•</span>
                                  <span>{attachment.uploader.name || attachment.uploader.email}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(viewerFiles[index]);
                                }}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteAttachmentMutation.mutate(attachment.id);
                                }}
                                disabled={deleteAttachmentMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Due Date Picker Dialog */}
      <Dialog open={dueDateDialogOpen} onOpenChange={setDueDateDialogOpen}>
        <DialogContent className="w-auto max-w-none p-0 gap-0 shadow-none" showCloseButton={false}>
          <DialogTitle className="sr-only">Set Due Date</DialogTitle>
          <DialogDescription className="sr-only">Select date and time</DialogDescription>

          <Card className="border-0 shadow-none py-0">
            <CardContent className="px-4 pt-4 pb-0">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="bg-transparent p-0"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t px-4 pt-4 pb-4">
              <div className="flex w-full flex-col gap-2">
                <Label htmlFor="due-time" className="text-sm">Time</Label>
                <div className="relative flex w-full items-center">
                  <Clock className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="due-time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex w-full gap-2">
                {task?.dueDate && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      handleDueDateChange(null);
                      setDueDateDialogOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleDueDateSave}
                  disabled={!selectedDate}
                >
                  Save
                </Button>
              </div>
            </CardFooter>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Media Viewer Modal */}
      <MediaViewerModal
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        files={viewerFiles}
        currentIndex={viewerIndex}
        onNavigate={setViewerIndex}
        onDownload={handleDownload}
      />
    </>
  );
}

