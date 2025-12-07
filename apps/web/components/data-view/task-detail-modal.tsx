"use client"

import React from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { IconSquareCheck, IconX } from "@tabler/icons-react"
import { BaseTask } from "./types"
import {
  TaskProperties,
  TaskAttachments,
  TaskChecklist,
  TaskActivityTabs,
  useTaskDetail,
  TaskDetailModalProps,
} from "./task-detail"

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  workspaceId,
  brandId,
  brandSlug,
  brandName,
  brandLogoUrl,
  isCreateMode = false,
  onTaskUpdate,
  onTaskCreate,
}: TaskDetailModalProps) {
  const t = useTranslations("tasks")

  const {
    // State
    editedTitle,
    setEditedTitle,
    editedDescription,
    setEditedDescription,
    currentStatus,
    currentPriority,
    currentDueDate,
    currentAssigneeName,
    checklistItems,
    setChecklistItems,
    attachments,
    setAttachments,
    attachmentDetails,
    setAttachmentDetails,
    comments,
    setComments,
    activities,
    setActivities,
    workspaceMembers,

    // Editing state
    isEditingTitle,
    setIsEditingTitle,
    isEditingDescription,
    setIsEditingDescription,
    isDescriptionExpanded,
    setIsDescriptionExpanded,

    // Handlers
    handleSaveTitle,
    handleSaveDescription,
    handleStatusChange,
    handlePriorityChange,
    handleDateChange,
    handleAssigneeChange,

    // Create mode
    isCreateMode: isInCreateMode,
    createdTaskId,
  } = useTaskDetail({
    task,
    workspaceId,
    brandId,
    open,
    isCreateMode,
    onTaskUpdate,
    onTaskCreate,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full h-full max-w-full max-h-full md:w-[70vw] md:h-[90vh] md:max-w-none md:max-h-none flex flex-col p-0 overflow-hidden rounded-none md:rounded-lg top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Task Details</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 flex-shrink-0">
          {/* Left side */}
          <div className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium hover:bg-accent transition-colors cursor-default">
              <IconSquareCheck className="h-3.5 w-3.5" />
              {t("title")}
            </div>
            <div className="h-5 w-px bg-border"></div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium hover:bg-accent transition-colors cursor-default">
              {isCreateMode && !createdTaskId
                ? t("newTask")
                : task?.taskNumber
                  ? `TAS-${task.taskNumber}`
                  : createdTaskId
                    ? `TAS-${createdTaskId.slice(-4)}`
                    : `TAS-${task?.id || ""}`}
            </div>
          </div>

          {/* Right side */}
          <div className="flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Brand Info */}
        <div className="flex items-center justify-between px-4 py-0 flex-shrink-0">
          {/* Left side */}
          <div className="flex items-center gap-2 flex-1">
            {brandSlug && (
              <div className="flex items-center gap-1.5 px-1 pr-2 py-1 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors cursor-default">
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
            )}
          </div>

          {/* Right side */}
          <div className="flex-shrink-0">
            {/* Empty for now */}
          </div>
        </div>

        {/* Task Title and Description - Mobile */}
        <div className="px-6 py-2 flex-shrink-0 md:hidden">
          <div className="flex flex-col gap-2">
            {isEditingTitle ? (
              <Textarea
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditedTitle(task?.title || "")
                    setIsEditingTitle(false)
                  }
                }}
                className="!text-xl font-semibold min-h-0 h-auto py-0.5 px-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-none break-words"
                autoFocus
                rows={1}
              />
            ) : (
              <h2
                className="text-xl font-semibold break-words cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5"
                onClick={() => {
                  setEditedTitle(task?.title || "")
                  setIsEditingTitle(true)
                }}
              >
                {editedTitle || task?.title || "Untitled Task"}
              </h2>
            )}
            {isEditingDescription ? (
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onBlur={handleSaveDescription}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setEditedDescription(task?.description || "")
                    setIsEditingDescription(false)
                  }
                }}
                className="text-sm text-muted-foreground min-h-[60px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-none"
                autoFocus
              />
            ) : (
              <div
                className={`text-sm text-muted-foreground break-words cursor-pointer w-full hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 whitespace-pre-wrap ${isDescriptionExpanded ? "" : "line-clamp-2"
                  }`}
                onClick={() => {
                  if (!isDescriptionExpanded) {
                    setIsDescriptionExpanded(true)
                  } else {
                    setEditedDescription(task?.description || "")
                    setIsEditingDescription(true)
                  }
                }}
              >
                {editedDescription || task?.description || "No description"}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="px-6 py-0 flex-1 min-h-0 overflow-visible flex flex-col md:flex-row h-full">
          <div className="flex items-stretch flex-1 min-h-0 overflow-visible md:flex-row flex-col-reverse md:flex-row h-full">
            {/* Right side - Properties and Attachments (Mobile: shown first) */}
            <div className="w-full md:w-[36%] border-t md:border-t-0 md:border-l border-muted-foreground/20 min-h-0 h-full overflow-y-auto overflow-x-visible scrollbar-hide pl-0 md:pl-2 pt-4 md:pt-0 order-1 md:order-2">
              <TaskProperties
                task={task}
                workspaceId={workspaceId}
                currentStatus={currentStatus}
                currentPriority={currentPriority}
                currentDueDate={currentDueDate}
                currentAssigneeName={currentAssigneeName}
                workspaceMembers={workspaceMembers}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                onDateChange={handleDateChange}
                onAssigneeChange={handleAssigneeChange}
              />

              <TaskAttachments
                task={task}
                workspaceId={workspaceId}
                attachments={attachments}
                attachmentDetails={attachmentDetails}
                onAttachmentsUpdate={setAttachments}
                onAttachmentDetailsUpdate={setAttachmentDetails}
              />

              {/* Activity Tabs - Mobile only (shown after attachments) */}
              <div className="md:hidden mt-4">
                <TaskActivityTabs
                  task={task}
                  workspaceId={workspaceId}
                  comments={comments}
                  onCommentsUpdate={setComments}
                  activities={activities}
                  onActivitiesUpdate={setActivities}
                  onTaskUpdate={onTaskUpdate}
                />
              </div>
            </div>

            {/* Left side - Title and Description (Desktop) / Checklist */}
            <div className="flex-1 w-full md:w-[70%] min-h-0 h-full overflow-y-auto overflow-x-visible scrollbar-hide pr-2 md:pr-4 order-2 md:order-1">
              <div className="flex flex-col gap-2">
                {/* Title and Description - Desktop only */}
                <div className="hidden md:flex flex-col gap-2">
                  {isEditingTitle ? (
                    <Textarea
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditedTitle(task?.title || "")
                          setIsEditingTitle(false)
                        }
                      }}
                      className="!text-xl font-semibold min-h-0 h-auto py-0.5 px-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-none break-words"
                      autoFocus
                      rows={1}
                    />
                  ) : (
                    <h2
                      className="text-xl font-semibold break-words cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5"
                      onClick={() => {
                        setEditedTitle(task?.title || "")
                        setIsEditingTitle(true)
                      }}
                    >
                      {editedTitle || task?.title || "Untitled Task"}
                    </h2>
                  )}
                  {isEditingDescription ? (
                    <Textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      onBlur={handleSaveDescription}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditedDescription(task?.description || "")
                          setIsEditingDescription(false)
                        }
                      }}
                      className="text-sm text-muted-foreground min-h-[60px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-none"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={`text-sm text-muted-foreground break-words cursor-pointer w-full hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 whitespace-pre-wrap ${isDescriptionExpanded ? "" : "line-clamp-2"
                        }`}
                      onClick={() => {
                        if (!isDescriptionExpanded) {
                          setIsDescriptionExpanded(true)
                        } else {
                          setEditedDescription(task?.description || "")
                          setIsEditingDescription(true)
                        }
                      }}
                    >
                      {editedDescription || task?.description || "No description"}
                    </div>
                  )}
                </div>

                {/* Checklist */}
                <TaskChecklist
                  task={task}
                  workspaceId={workspaceId}
                  checklistItems={checklistItems}
                  onChecklistUpdate={setChecklistItems}
                  onTaskUpdate={onTaskUpdate}
                />

                {/* Activity Tabs (Comments, Activity, Work Log) - Desktop only */}
                <div className="hidden md:block">
                  <TaskActivityTabs
                    task={task}
                    workspaceId={workspaceId}
                    comments={comments}
                    onCommentsUpdate={setComments}
                    activities={activities}
                    onActivitiesUpdate={setActivities}
                    onTaskUpdate={onTaskUpdate}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
