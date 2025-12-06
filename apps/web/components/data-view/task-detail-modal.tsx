"use client"

import React, { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { IconSquareCheck, IconX, IconChevronDown, IconFlagFilled, IconCalendar, IconUser, IconClock, IconPlus, IconTrash, IconCheck, IconGripVertical, IconListCheck, IconPaperclip, IconFile, IconDownload, IconUpload } from "@tabler/icons-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { BaseTask } from "./types"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Status, StatusIndicator, StatusLabel } from "@/components/kibo-ui/status"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface SortableChecklistItemProps {
  item: { id: string; title: string; isCompleted: boolean; sortOrder: number }
  task: BaseTask | null
  workspaceId: string
  checklistItems: Array<{ id: string; title: string; isCompleted: boolean; sortOrder: number }>
  onUpdate: (items: Array<{ id: string; title: string; isCompleted: boolean; sortOrder: number }>) => void
  onDelete: (itemId: string) => void
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string | undefined }) => void
}

function SortableChecklistItem({
  item,
  task,
  workspaceId,
  checklistItems,
  onUpdate,
  onDelete,
  onTaskUpdate,
}: SortableChecklistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState(item.title)

  useEffect(() => {
    setEditedTitle(item.title)
  }, [item.title])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = async () => {
    if (!task) return
    
    if (editedTitle.trim() === item.title.trim()) {
      setIsEditing(false)
      return
    }
    
    if (!editedTitle.trim()) {
      setEditedTitle(item.title)
      setIsEditing(false)
      return
    }
    
    try {
      const updatedItems = checklistItems.map((i) =>
        i.id === item.id ? { ...i, title: editedTitle.trim() } : i
      )
      onUpdate(updatedItems)
      
      const response = await apiClient.updateTask(workspaceId, String(task.id), {
        checklistItems: updatedItems.map((i) => ({
          id: i.id,
          title: i.title,
          isCompleted: i.isCompleted,
          sortOrder: i.sortOrder,
        })),
      })
      
      // Update from response
      if (response?.task?.checklistItems) {
        onUpdate(response.task.checklistItems)
      }
      
      // Don't call onTaskUpdate here - it might cause priority/attachments to reset
      // The task will be updated when modal is closed or refreshed
      
      setIsEditing(false)
    } catch (error: any) {
      console.error("Failed to update checklist item title:", error)
      setEditedTitle(item.title)
      setIsEditing(false)
      toast.error(error?.message || "Failed to update checklist item")
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-accent/50 hover:border-border/70 transition-colors group"
    >
      <button
        onClick={async () => {
          if (!task) return
          
          try {
            const updatedItems = checklistItems.map((i) =>
              i.id === item.id ? { ...i, isCompleted: !i.isCompleted } : i
            )
            onUpdate(updatedItems)
            
            const response = await apiClient.updateTask(workspaceId, String(task.id), {
              checklistItems: updatedItems.map((i) => ({
                id: i.id,
                title: i.title,
                isCompleted: i.isCompleted,
                sortOrder: i.sortOrder,
              })),
            })
            
            // Update from response
            if (response?.task?.checklistItems) {
              onUpdate(response.task.checklistItems)
            }
            
            // Don't call onTaskUpdate here - it might cause priority/attachments to reset
            // The task will be updated when modal is closed or refreshed
          } catch (error: any) {
            console.error("Failed to update checklist item:", error)
            toast.error(error?.message || "Failed to update checklist item")
          }
        }}
        className="flex-shrink-0"
      >
        {item.isCompleted ? (
          <div className="h-4 w-4 rounded-md border-2 border-primary bg-primary flex items-center justify-center">
            <IconCheck className="h-3 w-3 text-primary-foreground" />
          </div>
        ) : (
          <div className="h-4 w-4 rounded-md border-2 border-muted-foreground/30" />
        )}
      </button>
      {isEditing ? (
        <Input
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur()
            } else if (e.key === "Escape") {
              setEditedTitle(item.title)
              setIsEditing(false)
            }
          }}
          className={`flex-1 text-sm font-medium h-auto py-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 ${
            item.isCompleted
              ? "line-through text-muted-foreground"
              : "text-foreground"
          }`}
          autoFocus
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 text-sm font-medium cursor-text ${
            item.isCompleted
              ? "line-through text-muted-foreground"
              : "text-foreground"
          }`}
        >
          {item.title}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={async () => {
          if (!task) return
          
          try {
            const updatedItems = checklistItems.filter((i) => i.id !== item.id)
            onUpdate(updatedItems)
            
            const response = await apiClient.updateTask(workspaceId, String(task.id), {
              checklistItems: updatedItems.map((i) => ({
                id: i.id,
                title: i.title,
                isCompleted: i.isCompleted,
                sortOrder: i.sortOrder,
              })),
            })
            
            // Update from response
            if (response?.task?.checklistItems) {
              onUpdate(response.task.checklistItems)
            }
            
            // Don't call onTaskUpdate here - it might cause priority/attachments to reset
            // The task will be updated when modal is closed or refreshed
          } catch (error: any) {
            console.error("Failed to delete checklist item:", error)
            toast.error(error?.message || "Failed to delete checklist item")
          }
        }}
      >
        <IconTrash className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
      >
        <IconGripVertical className="h-4 w-4" />
      </button>
    </div>
  )
}

function DatePickerComponent({
  value,
  onDateChange,
}: {
  value: Date | undefined
  onDateChange?: (newDate: string | null) => void
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [selectedTime, setSelectedTime] = React.useState<string>(() => {
    if (value) {
      return `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`
    }
    return '00:00'
  })
  const [includeTime, setIncludeTime] = React.useState<boolean>(() => {
    // If value has time (not midnight UTC), include time is true
    if (value) {
      // Check UTC time to avoid timezone issues
      return value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0
    }
    return false
  })
  const includeTimeRef = React.useRef(includeTime)
  const isInternalUpdateRef = React.useRef(false)
  const initialDateRef = React.useRef<Date | undefined>(value)
  const getInitialTime = () => {
    if (value) {
      return `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`
    }
    return '00:00'
  }
  const initialTimeRef = React.useRef<string>(getInitialTime())
  const getInitialIncludeTime = () => {
    if (value) {
      return value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0
    }
    return false
  }
  const initialIncludeTimeRef = React.useRef<boolean>(getInitialIncludeTime())

  // Update state when value prop changes (only from external changes)
  React.useEffect(() => {
    // Skip if this is an internal update
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false
      return
    }

    if (value) {
      setSelectedDate(value)
      const hours = value.getHours()
      const minutes = value.getMinutes()
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      setSelectedTime(timeStr)
      // Check UTC time to determine if time is included
      const hasTime = value.getUTCHours() !== 0 || value.getUTCMinutes() !== 0
      setIncludeTime(hasTime)
      includeTimeRef.current = hasTime
      initialDateRef.current = value
      initialTimeRef.current = timeStr
      initialIncludeTimeRef.current = hasTime
    } else {
      setSelectedDate(undefined)
      setSelectedTime('00:00')
      setIncludeTime(false)
      includeTimeRef.current = false
      initialDateRef.current = undefined
      initialTimeRef.current = '00:00'
      initialIncludeTimeRef.current = false
    }
  }, [value])

  // Save changes when popover closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    
    if (!open) {
      // Popover is closing, check if there are changes and save
      const hasDateChanged = selectedDate?.getTime() !== initialDateRef.current?.getTime()
      const hasTimeChanged = selectedTime !== initialTimeRef.current
      const hasIncludeTimeChanged = includeTime !== initialIncludeTimeRef.current
      
      if (hasDateChanged || hasTimeChanged || hasIncludeTimeChanged) {
        if (selectedDate) {
          if (includeTimeRef.current) {
            const [hours, minutes] = selectedTime.split(':')
            const newDate = new Date(selectedDate)
            newDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0)
            onDateChange?.(newDate.toISOString())
          } else {
            // Send ISO string with midnight UTC when time is not included
            const newDate = new Date(selectedDate)
            newDate.setUTCHours(0, 0, 0, 0)
            onDateChange?.(newDate.toISOString())
          }
        } else {
          onDateChange?.(null)
        }
        
        // Update initial refs
        initialDateRef.current = selectedDate
        initialTimeRef.current = selectedTime
        initialIncludeTimeRef.current = includeTime
      }
    } else {
      // Popover is opening, reset to current value
      initialDateRef.current = selectedDate
      initialTimeRef.current = selectedTime
      initialIncludeTimeRef.current = includeTime
    }
  }

  const formattedDate = selectedDate 
    ? (() => {
        const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        if (includeTime) {
          const timeStr = selectedTime
          return `${dateStr} at ${timeStr}`
        }
        return dateStr
      })()
    : 'No due date'

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    isInternalUpdateRef.current = true
    // Don't call onDateChange here, wait for popover to close
  }

  const handleTimeChange = (time: string) => {
    setSelectedTime(time)
    isInternalUpdateRef.current = true
    // Don't call onDateChange here, wait for popover to close
  }

  const handleIncludeTimeChange = (checked: boolean) => {
    setIncludeTime(checked)
    includeTimeRef.current = checked
    isInternalUpdateRef.current = true
    // Don't call onDateChange here, wait for popover to close
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity w-full text-left">
          <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">{formattedDate}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Card className="w-fit py-4 border-0 shadow-none">
          <CardContent className="px-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="bg-transparent p-0"
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t px-4 !pt-4">
            <div className="flex w-full items-center justify-between">
              <Label htmlFor="include-time" className="text-xs cursor-pointer">Include time</Label>
              <Switch
                id="include-time"
                checked={includeTime}
                onCheckedChange={handleIncludeTimeChange}
              />
            </div>
            {includeTime && (
              <div className="flex w-full flex-col gap-2">
                <Label htmlFor="time" className="text-xs">Time</Label>
                <div className="relative flex w-full items-center gap-2">
                  <IconClock className="text-muted-foreground pointer-events-none absolute left-2.5 h-4 w-4 select-none" />
                  <Input
                    id="time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="appearance-none pl-8"
                  />
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setSelectedDate(undefined)
                setSelectedTime('00:00')
                setIncludeTime(false)
                includeTimeRef.current = false
                // Clear immediately when button is clicked
                onDateChange?.(null)
                setIsOpen(false)
              }}
            >
              Clear
            </Button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

interface PropertyItemProps {
  label: string
  value: string
  type: 'status' | 'priority' | 'date' | 'assignee' | 'text'
  onStatusChange?: (newStatus: string) => void
  onPriorityChange?: (newPriority: string) => void
  onDateChange?: (newDate: string | null) => void
  onAssigneeChange?: (newAssigneeId: string | null) => void
  workspaceMembers?: Array<{ id: string; name: string | null; email: string; avatarMediaId: string | null; avatarUrl: string | null }>
}

function PropertyItem({ 
  label, 
  value, 
  type, 
  onStatusChange, 
  onPriorityChange, 
  onDateChange, 
  onAssigneeChange, 
  workspaceMembers = [],
}: PropertyItemProps) {
  const renderValue = () => {
    switch (type) {
      case 'status':
        // Handle both string and object values
        const statusValue = typeof value === 'object' && value !== null && 'label' in value 
          ? (value as any).label 
          : String(value)
        
        const statusMap: Record<string, "online" | "offline" | "maintenance" | "degraded"> = {
          "Done": "online",
          "In Progress": "maintenance",
          "Not Started": "offline",
        }
        const status = statusMap[statusValue] || "offline"
        const availableStatuses = ["Not Started", "In Progress", "Done"]

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <Status status={status}>
                  <StatusIndicator />
                  <StatusLabel>{statusValue}</StatusLabel>
                </Status>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availableStatuses.map((statusOption) => (
                <DropdownMenuItem
                  key={statusOption}
                  onClick={() => onStatusChange?.(statusOption)}
                  className={statusValue === statusOption ? "bg-muted" : ""}
                >
                  <Status status={statusMap[statusOption] || "offline"}>
                    <StatusIndicator />
                    <StatusLabel>{statusOption}</StatusLabel>
                  </Status>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      case 'priority':
        const priorityMap: Record<string, { label: string; color: string }> = {
          "Low": { label: "Low", color: "text-green-500" },
          "Medium": { label: "Medium", color: "text-yellow-500" },
          "High": { label: "High", color: "text-red-500" },
        }
        const priority = priorityMap[value] || priorityMap["Medium"]
        const availablePriorities = ["Low", "Medium", "High"]

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <Badge variant="outline" className="text-muted-foreground px-1.5">
                  <IconFlagFilled className={`h-3.5 w-3.5 ${priority.color}`} />
                  <span>{priority.label}</span>
                </Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {availablePriorities.map((priorityOption) => {
                const p = priorityMap[priorityOption]
                return (
                  <DropdownMenuItem
                    key={priorityOption}
                    onClick={() => onPriorityChange?.(priorityOption)}
                    className={value === priorityOption ? "bg-muted" : ""}
                  >
                    <Badge variant="outline" className="text-muted-foreground px-1.5">
                      <IconFlagFilled className={`h-3.5 w-3.5 ${p.color}`} />
                      <span>{p.label}</span>
                    </Badge>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      case 'date':
        const dateValue = value && value !== 'null' ? new Date(value) : undefined

        return (
          <DatePickerComponent
            value={dateValue}
            onDateChange={onDateChange}
            key={dateValue?.toISOString() || 'no-date'} // Force re-mount when value changes
          />
        )
      case 'assignee':
        const assigneeValue = value && value !== 'null' && value !== 'Unassigned' ? value : 'Unassigned'
        // Find current assignee ID and object from workspaceMembers
        const currentAssigneeId = workspaceMembers.find(m => m.name === value || m.email === value)?.id || null
        const currentAssignee = currentAssigneeId ? workspaceMembers.find(m => m.id === currentAssigneeId) : null
        
        const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = React.useState(false)
        
        return (
          <Popover open={isAssigneePopoverOpen} onOpenChange={setIsAssigneePopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity w-full text-left">
                {currentAssignee?.avatarUrl ? (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={currentAssignee.avatarUrl} alt={currentAssignee.name || ""} />
                    <AvatarFallback className="text-xs">
                      {currentAssignee.name
                        ? currentAssignee.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : currentAssignee.email?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <IconUser className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-sm">{assigneeValue}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search members..." />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        onAssigneeChange?.(null)
                        setIsAssigneePopoverOpen(false)
                      }}
                      className={!value || value === 'Unassigned' ? "bg-muted" : ""}
                    >
                      <IconUser className="h-4 w-4" />
                      Unassigned
                    </CommandItem>
                    {workspaceMembers.map((member) => (
                      <CommandItem
                        key={member.id}
                        onSelect={() => {
                          onAssigneeChange?.(member.id)
                          setIsAssigneePopoverOpen(false)
                        }}
                        className={currentAssigneeId === member.id ? "bg-muted" : ""}
                      >
                        {member.avatarUrl ? (
                          <Avatar className="h-4 w-4 mr-2">
                            <AvatarImage src={member.avatarUrl} alt={member.name || ""} />
                            <AvatarFallback className="text-xs">
                              {member.name
                                ? member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)
                                : member.email?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <IconUser className="h-4 w-4 mr-2" />
                        )}
                        {member.name || member.email}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )
      case 'text':
        return <span className="text-sm">{value}</span>
      default:
        return <span className="text-sm">{value}</span>
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-32 flex-shrink-0 p-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="flex-1 p-2 rounded hover:bg-accent/50 transition-colors">
        {renderValue()}
      </div>
    </div>
  )
}

interface TaskDetailModalProps {
  task: BaseTask | null
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  brandSlug?: string
  brandName?: string
  brandLogoUrl?: string | null
  onTaskUpdate?: (taskId: string, updates: { title?: string; description?: string }) => void
}

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  workspaceId,
  brandSlug,
  brandName,
  brandLogoUrl,
  onTaskUpdate,
}: TaskDetailModalProps) {
  const t = useTranslations("tasks")
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedTitle, setEditedTitle] = useState(task?.title || "")
  const [editedDescription, setEditedDescription] = useState(task?.description || "")
  const [currentStatus, setCurrentStatus] = useState(() => {
    const statusValue = typeof task?.status === 'object' && task?.status !== null && 'label' in task.status
      ? (task.status as any).label
      : (task?.status || "Not Started")
    return statusValue
  })
  const [currentPriority, setCurrentPriority] = useState<"High" | "Medium" | "Low">(task?.priority as "High" | "Medium" | "Low" || "Medium")
  const [currentDueDate, setCurrentDueDate] = useState(task?.dueDate || null)
  const [currentAssigneeId, setCurrentAssigneeId] = useState<string | null>(null)
  const [currentAssigneeName, setCurrentAssigneeName] = useState<string | null>(null)
  const [isStatusChanging, setIsStatusChanging] = useState(false)
  const [isPriorityChanging, setIsPriorityChanging] = useState(false)
  const [isAssigneeChanging, setIsAssigneeChanging] = useState(false)
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; title: string; isCompleted: boolean; sortOrder: number }>>([])
  const [newChecklistItemTitle, setNewChecklistItemTitle] = useState("")
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false)
  const [workspaceMembers, setWorkspaceMembers] = useState<Array<{ id: string; name: string | null; email: string; avatarMediaId: string | null; avatarUrl: string | null }>>([])
  const [attachments, setAttachments] = useState<Array<{ id: string; mediaId: string; title: string | null; sizeBytes?: number }>>([])
  const [attachmentDetails, setAttachmentDetails] = useState<Map<string, { sizeBytes: number; originalFilename: string }>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Cache for workspace members by workspaceId
  const membersCacheRef = useRef<Map<string, Array<{ id: string; name: string | null; email: string; avatarMediaId: string | null; avatarUrl: string | null }>>>(new Map())
  const membersLoadingRef = useRef<Set<string>>(new Set())

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch workspace members with cache
  useEffect(() => {
    async function fetchMembers() {
      if (!workspaceId) return
      
      // Check cache first
      if (membersCacheRef.current.has(workspaceId)) {
        setWorkspaceMembers(membersCacheRef.current.get(workspaceId)!)
        return
      }
      
      // Prevent duplicate requests
      if (membersLoadingRef.current.has(workspaceId)) {
        return
      }
      
      membersLoadingRef.current.add(workspaceId)
      
      try {
        const response = await apiClient.listWorkspaceMembers(workspaceId)
        
        // Cache the result (avatarUrl is already included from backend)
        membersCacheRef.current.set(workspaceId, response.members)
        setWorkspaceMembers(response.members)
      } catch (error) {
        console.error("Failed to fetch workspace members:", error)
      } finally {
        membersLoadingRef.current.delete(workspaceId)
      }
    }
    
    fetchMembers()
  }, [workspaceId])

  // Fetch full task details when modal opens or task changes
  useEffect(() => {
    async function fetchTaskDetails() {
      if (!open || !task?.id || !workspaceId) return
      
      try {
        const fullTask = await apiClient.getTask(workspaceId, String(task.id))
        if (fullTask?.task?.checklistItems) {
          setChecklistItems(fullTask.task.checklistItems)
        } else {
          setChecklistItems(task?.checklistItems || [])
        }
        if (fullTask?.task?.attachments) {
          // Fetch media details for all attachments to get size, filename, and extension
          const detailsMap = new Map<string, { sizeBytes: number; originalFilename: string }>()
          const mediaPromises = fullTask.task.attachments.map(async (attachment: any) => {
            if (!attachment.mediaId || attachment.mediaId.startsWith('temp-')) return
            
            try {
              const mediaResponse = await apiClient.getMedia(workspaceId, attachment.mediaId)
              if (mediaResponse?.media) {
                detailsMap.set(attachment.mediaId, {
                  sizeBytes: mediaResponse.media.sizeBytes,
                  originalFilename: mediaResponse.media.originalFilename,
                })
              }
            } catch (error) {
              console.error(`Failed to fetch media details for ${attachment.mediaId}:`, error)
            }
          })
          
          await Promise.all(mediaPromises)
          setAttachmentDetails(detailsMap)
          
          // Update attachments with media details
          const attachmentsWithDetails = fullTask.task.attachments.map((attachment: any) => {
            const details = detailsMap.get(attachment.mediaId)
            return {
              ...attachment,
              title: details?.originalFilename || attachment.title,
              sizeBytes: details?.sizeBytes,
            }
          })
          setAttachments(attachmentsWithDetails)
        } else {
          setAttachments(task?.attachments || [])
        }
      } catch (error) {
        console.error("Failed to fetch task details:", error)
        setChecklistItems(task?.checklistItems || [])
        setAttachments(task?.attachments || [])
      }
    }
    
    fetchTaskDetails()
  }, [open, task?.id, workspaceId])

  // Update edited values when task changes
  useEffect(() => {
    setEditedTitle(task?.title || "")
    setEditedDescription(task?.description || "")
    // Only update status if we're not in the middle of a status change
    if (!isStatusChanging) {
      // Handle both string and object status values
      const statusValue = typeof task?.status === 'object' && task?.status !== null && 'label' in task.status
        ? (task.status as any).label
        : (task?.status || "Not Started")
      setCurrentStatus(statusValue)
    }
    // Only update priority if we're not in the middle of a priority change
    if (!isPriorityChanging) {
      setCurrentPriority((task?.priority as "High" | "Medium" | "Low") || "Medium")
    }
    setCurrentDueDate(task?.dueDate || null)
    // Only update assignee if we're not in the middle of an assignee change
    if (!isAssigneeChanging) {
      // Get assignee from task.assignedTo
      if (task?.assignedTo && task.assignedTo.length > 0) {
        const assigneeId = task.assignedTo[0].id
        setCurrentAssigneeId(assigneeId)
        // Find assignee in workspaceMembers to get name/email
        const assignee = workspaceMembers.find(m => m.id === assigneeId)
        setCurrentAssigneeName(assignee?.name || assignee?.email || task.assignedTo[0].name || null)
      } else {
        setCurrentAssigneeId(null)
        setCurrentAssigneeName(null)
      }
    }
    // Update attachments - preserve existing details
    if (task?.attachments) {
      setAttachments(task.attachments)
      // Preserve existing attachment details when task updates
      setAttachmentDetails(prev => {
        const newMap = new Map(prev)
        // Keep existing details for attachments that still exist
        task.attachments?.forEach((att: any) => {
          if (!newMap.has(att.mediaId) && att.title) {
            // If we don't have details but have title, we can at least preserve the title
            // Size will be 0 but that's okay
          }
        })
        return newMap
      })
    } else {
      setAttachments([])
    }
  }, [task, isStatusChanging, isPriorityChanging, isAssigneeChanging, workspaceMembers])

  const handleSaveTitle = async () => {
    if (!task || editedTitle === task.title) {
      setIsEditingTitle(false)
      return
    }

    try {
      console.log('[TaskModal] Saving title:', { taskId: task.id, newTitle: editedTitle })
      const response = await apiClient.updateTask(workspaceId, String(task.id), {
        title: editedTitle,
      })
      console.log('[TaskModal] API response:', response)
      // Use the task from API response to update state
      if (response?.task) {
        onTaskUpdate?.(String(response.task.id), { 
          title: response.task.title,
          description: response.task.description 
        })
      } else {
        // Fallback to edited value if response doesn't have task
        onTaskUpdate?.(String(task.id), { title: editedTitle })
      }
      // Also update local state for immediate UI feedback
      setEditedTitle(response?.task?.title || editedTitle)
    } catch (error: any) {
      console.error("Failed to save title:", error)
      // Revert on error
      setEditedTitle(task.title || "")
      toast.error(error?.message || "Failed to save title")
    } finally {
      setIsEditingTitle(false)
    }
  }

  const handleSaveDescription = async () => {
    if (!task || editedDescription === (task.description || "")) {
      setIsEditingDescription(false)
      return
    }

    try {
      console.log('[TaskModal] Saving description:', { taskId: task.id })
      const response = await apiClient.updateTask(workspaceId, String(task.id), {
        description: editedDescription || undefined,
      })
      console.log('[TaskModal] API response:', response)
      // Use the task from API response to update state
      if (response?.task) {
        onTaskUpdate?.(String(response.task.id), { 
          title: response.task.title,
          description: response.task.description 
        })
      } else {
        // Fallback to edited value if response doesn't have task
        onTaskUpdate?.(String(task.id), { description: editedDescription })
      }
      // Also update local state for immediate UI feedback
      setEditedDescription(response?.task?.description || editedDescription)
    } catch (error: any) {
      console.error("Failed to save description:", error)
      // Revert on error
      setEditedDescription(task.description || "")
      toast.error(error?.message || "Failed to save description")
    } finally {
      setIsEditingDescription(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-full h-full max-w-full max-h-full md:w-[70vw] md:h-[80vh] md:max-w-none md:max-h-none flex flex-col p-0 overflow-hidden rounded-none md:rounded-lg top-0 left-0 translate-x-0 translate-y-0 md:top-[50%] md:left-[50%] md:translate-x-[-50%] md:translate-y-[-50%]"
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
              {task?.taskNumber ? `TAS-${task.taskNumber}` : `TAS-${task?.id || ""}`}
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

        {/* Task Title and Description */}
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
                className={`text-sm text-muted-foreground break-words cursor-pointer w-full hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 whitespace-pre-wrap ${
                  isDescriptionExpanded ? "" : "line-clamp-2"
                }`}
                onClick={() => {
                  if (!isDescriptionExpanded) {
                    // First click: expand
                    setIsDescriptionExpanded(true)
                  } else {
                    // Second click: edit
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
        <div className="px-6 py-0 flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row h-full">
          <div className="flex gap-4 items-stretch flex-1 min-h-0 overflow-hidden md:flex-row flex-col-reverse md:flex-row h-full">
            {/* Right side - Properties and Attachments (Mobile: shown first) (%30 width) */}
            <div className="w-full md:w-[36%] border-t md:border-t-0 md:border-l border-muted-foreground/20 min-h-0 h-full overflow-y-auto overflow-x-hidden pl-0 md:pl-2 pt-4 md:pt-0 order-1 md:order-2">
              <div className="flex flex-col gap-1 pl-0 md:pl-2">
                <PropertyItem
                  label="Status"
                  value={currentStatus}
                  type="status"
                  onStatusChange={async (newStatus) => {
                    if (!task) return

                    setIsStatusChanging(true)

                    try {
                      console.log('[StatusChange] Changing status to:', newStatus)

                      // Optimistically update UI
                      setCurrentStatus(newStatus)

                      // Fetch available statuses to get the correct status ID
                      const statusesResponse = await apiClient.listTaskStatuses(workspaceId)
                      const allStatuses = Object.values(statusesResponse.statuses).flat()
                      const statusObj = allStatuses.find((s: any) => s.label === newStatus)

                      if (!statusObj) {
                        // Revert on error
                        const statusValue = typeof task?.status === 'object' && task?.status !== null && 'label' in task.status
                          ? (task.status as any).label
                          : (task?.status || "Not Started")
                        setCurrentStatus(statusValue)
                        setIsStatusChanging(false)
                        throw new Error(`Status "${newStatus}" not found`)
                      }

                      const response = await apiClient.updateTask(workspaceId, String(task.id), {
                        statusId: statusObj.id,
                      })
                      console.log('[StatusChange] API response:', response)

                      // Update local state with response
                      if (response?.task) {
                        // Status is already updated optimistically, just confirm it
                        setCurrentStatus(newStatus)

                        onTaskUpdate?.(String(response.task.id), {
                          title: response.task.title,
                          description: response.task.description
                        })

                        // Wait a bit for WebSocket event to arrive, then allow updates
                        setTimeout(() => {
                          setIsStatusChanging(false)
                        }, 2000)
                      } else {
                        setIsStatusChanging(false)
                      }
                    } catch (error: any) {
                      console.error("Failed to change status:", error)
                      // Revert on error
                      const statusValue = typeof task?.status === 'object' && task?.status !== null && 'label' in task.status
                        ? (task.status as any).label
                        : (task?.status || "Not Started")
                      setCurrentStatus(statusValue)
                      setIsStatusChanging(false)
                      toast.error(error?.message || "Failed to change status")
                    }
                  }}
                />
                <PropertyItem
                  label="Priority"
                  value={currentPriority}
                  type="priority"
                  onPriorityChange={async (newPriority) => {
                    if (!task) return

                    setIsPriorityChanging(true)

                    try {
                      const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
                        "Low": "LOW",
                        "Medium": "MEDIUM",
                        "High": "HIGH",
                      }
                      const apiPriority = priorityMap[newPriority] || "MEDIUM"

                      // Optimistically update UI
                      setCurrentPriority(newPriority as "High" | "Medium" | "Low")

                      const response = await apiClient.updateTask(workspaceId, String(task.id), {
                        priority: apiPriority,
                      })

                      if (response?.task) {
                        setCurrentPriority(newPriority as "High" | "Medium" | "Low")
                        onTaskUpdate?.(String(response.task.id), {
                          title: response.task.title,
                          description: response.task.description
                        })

                        // Wait a bit for WebSocket event to arrive, then allow updates
                        setTimeout(() => {
                          setIsPriorityChanging(false)
                        }, 2000)
                      } else {
                        setIsPriorityChanging(false)
                      }
                    } catch (error: any) {
                      console.error("Failed to change priority:", error)
                      setCurrentPriority((task?.priority as "High" | "Medium" | "Low") || "Medium")
                      setIsPriorityChanging(false)
                      toast.error(error?.message || "Failed to change priority")
                    }
                  }}
                />
                <PropertyItem
                  label="Due Date"
                  value={currentDueDate || 'null'}
                  type="date"
                  onDateChange={async (newDate) => {
                    if (!task) return

                    try {
                      // Optimistically update UI
                      setCurrentDueDate(newDate)

                      const response = await apiClient.updateTask(workspaceId, String(task.id), {
                        dueDate: newDate || undefined,
                      })

                      if (response?.task) {
                        setCurrentDueDate(newDate)
                        onTaskUpdate?.(String(response.task.id), {
                          title: response.task.title,
                          description: response.task.description
                        })
                      }
                    } catch (error: any) {
                      console.error("Failed to change due date:", error)
                      setCurrentDueDate(task?.dueDate || null)
                      toast.error(error?.message || "Failed to change due date")
                    }
                  }}
                />
                <PropertyItem
                  label="Assigned To"
                  value={currentAssigneeName || 'Unassigned'}
                  type="assignee"
                  workspaceMembers={workspaceMembers}
                  onAssigneeChange={async (newAssigneeId) => {
                    if (!task) return

                    setIsAssigneeChanging(true)
                    try {
                      // Optimistically update UI
                      const assignee = newAssigneeId ? workspaceMembers.find(m => m.id === newAssigneeId) : null
                      setCurrentAssigneeId(newAssigneeId)
                      setCurrentAssigneeName(assignee?.name || assignee?.email || null)

                      const response = await apiClient.updateTask(workspaceId, String(task.id), {
                        assigneeUserId: newAssigneeId || undefined,
                      })

                      if (response?.task) {
                        const updatedAssigneeId = response.task.assigneeUserId || null
                        const updatedAssignee = updatedAssigneeId ? workspaceMembers.find(m => m.id === updatedAssigneeId) : null
                        setCurrentAssigneeId(updatedAssigneeId)
                        setCurrentAssigneeName(updatedAssignee?.name || updatedAssignee?.email || null)
                        onTaskUpdate?.(String(response.task.id), {
                          title: response.task.title,
                          description: response.task.description
                        })

                        // Wait a bit for WebSocket event to arrive, then allow updates
                        setTimeout(() => {
                          setIsAssigneeChanging(false)
                        }, 2000)
                      } else {
                        setIsAssigneeChanging(false)
                      }
                    } catch (error: any) {
                      console.error("Failed to change assignee:", error)
                      const originalAssignee = task?.assignedTo && task.assignedTo.length > 0 ? task.assignedTo[0] : null
                      setCurrentAssigneeId(originalAssignee?.id || null)
                      setCurrentAssigneeName(originalAssignee?.name || null)
                      setIsAssigneeChanging(false)
                      toast.error(error?.message || "Failed to change assignee")
                    }
                  }}
                />
              </div>
              
              {/* Attachments Section */}
              <div className="flex flex-col gap-3 pl-0 md:pl-2 pt-6 border-t border-muted-foreground/20 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <IconPaperclip className="h-4 w-4" />
                    Attachments
                    {attachments.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {attachments.length}
                      </Badge>
                    )}
                  </h3>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length === 0 || !task?.id || !workspaceId) return
                      
                      const currentAttachments = attachments // Snapshot of current attachments
                      
                      try {
                        // Optimistically add attachments to UI immediately
                        const tempIds = files.map((_, index) => `temp-upload-${Date.now()}-${index}-${Math.random()}`)
                        const optimisticAttachments = files.map((file, index) => ({
                          id: tempIds[index],
                          mediaId: tempIds[index],
                          title: file.name,
                          sizeBytes: file.size,
                        }))
                        setAttachments([...currentAttachments, ...optimisticAttachments])
                        
                        // Store media details optimistically
                        const optimisticDetailsMap = new Map(attachmentDetails)
                        files.forEach((file, index) => {
                          optimisticDetailsMap.set(tempIds[index], {
                            sizeBytes: file.size,
                            originalFilename: file.name
                          })
                        })
                        setAttachmentDetails(optimisticDetailsMap)
                        
                        const uploadPromises = files.map((file) => apiClient.uploadMedia(workspaceId, file))
                        const uploadResults = await Promise.all(uploadPromises)
                        
                        const newMediaIds = uploadResults.map((result) => result.media.id)
                        // Use currentAttachments (before optimistic update) to get real media IDs
                        const existingRealMediaIds = currentAttachments.filter((a) => !a.mediaId.startsWith('temp-')).map((a) => a.mediaId)
                        const allMediaIds = [...existingRealMediaIds, ...newMediaIds]
                        
                        // Create a map with all current details plus new upload results
                        const allDetailsMap = new Map(attachmentDetails)
                        uploadResults.forEach((result) => {
                          allDetailsMap.set(result.media.id, {
                            sizeBytes: result.media.sizeBytes,
                            originalFilename: result.media.originalFilename
                          })
                        })
                        tempIds.forEach((tempId) => {
                          allDetailsMap.delete(tempId)
                        })
                        
                        const response = await apiClient.updateTask(workspaceId, String(task.id), {
                          attachmentMediaIds: allMediaIds,
                        })
                        
                        // Always update details map first
                        setAttachmentDetails(allDetailsMap)
                        
                        // Create a map of existing attachments by mediaId for quick lookup
                        const existingAttachmentsMap = new Map(
                          currentAttachments
                            .filter((a) => !a.mediaId.startsWith('temp-'))
                            .map((a) => [a.mediaId, a])
                        )
                        
                        // Create new attachments from upload results
                        const newAttachments = uploadResults.map((result) => ({
                          id: result.media.id,
                          mediaId: result.media.id,
                          title: result.media.originalFilename || null,
                          sizeBytes: result.media.sizeBytes,
                        }))
                        
                        // Always merge: combine existing attachments with new ones
                        // Response might not include all attachments, so we merge intelligently
                        const responseAttachmentMap = new Map(
                          (response?.task?.attachments || []).map((att: any) => [att.mediaId, att])
                        )
                        
                        // Combine: use response data when available, otherwise use existing
                        const currentMediaIds = currentAttachments.filter((a) => !a.mediaId.startsWith('temp-')).map((a) => a.mediaId)
                        const allAttachmentMediaIds = new Set([...currentMediaIds, ...newMediaIds])
                        const mergedAttachments: Array<{ id: string; mediaId: string; title: string | null; sizeBytes?: number }> = []
                        
                        for (const mediaId of allAttachmentMediaIds) {
                          // Check if this is a newly uploaded file
                          const uploadResult = uploadResults.find((r) => r.media.id === mediaId)
                          if (uploadResult) {
                            // Use upload result data
                            const responseAtt = responseAttachmentMap.get(mediaId) as { id?: string; title?: string | null } | undefined
                            mergedAttachments.push({
                              id: responseAtt?.id || uploadResult.media.id,
                              mediaId: uploadResult.media.id,
                              title: uploadResult.media.originalFilename || responseAtt?.title || null,
                              sizeBytes: uploadResult.media.sizeBytes,
                            })
                            continue
                          }
                          
                          // Check response for this attachment
                          const responseAtt = responseAttachmentMap.get(mediaId) as { id: string; mediaId: string; title?: string | null } | undefined
                          if (responseAtt && responseAtt.mediaId) {
                            // Use response data but preserve size and title from existing
                            const existingAttachment = existingAttachmentsMap.get(mediaId)
                            const existingDetails = allDetailsMap.get(mediaId)
                            mergedAttachments.push({
                              id: responseAtt.id,
                              mediaId: responseAtt.mediaId,
                              sizeBytes: existingDetails?.sizeBytes || existingAttachment?.sizeBytes,
                              title: existingDetails?.originalFilename || existingAttachment?.title || responseAtt.title || null,
                            })
                            continue
                          }
                          
                          // Fallback: use existing attachment
                          const existingAttachment = existingAttachmentsMap.get(mediaId)
                          if (existingAttachment) {
                            mergedAttachments.push(existingAttachment)
                          }
                        }
                        
                        setAttachments(mergedAttachments)
                        
                        // Don't call onTaskUpdate here - it might cause priority to reset
                        // The task will be updated when modal is closed or refreshed
                        
                        toast.success(`Successfully uploaded ${files.length} file(s)`)
                      } catch (error: any) {
                        console.error("Failed to upload attachment:", error)
                        // Revert optimistic update on error
                        setAttachments(attachments)
                        toast.error(error?.message || "Failed to upload attachment")
                      } finally {
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconUpload className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Attachments list */}
                {attachments.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {attachments.map((attachment) => {
                      const details = attachmentDetails.get(attachment.mediaId)
                      const sizeBytes = attachment.sizeBytes || details?.sizeBytes || 0
                      const formatFileSize = (bytes: number): string => {
                        if (bytes === 0) return '0 B'
                        const k = 1024
                        const sizes = ['B', 'KB', 'MB', 'GB']
                        const i = Math.floor(Math.log(bytes) / Math.log(k))
                        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
                      }
                      
                      const fileName = attachment.title || details?.originalFilename || `Attachment ${attachment.id.slice(0, 8)}`
                      const getFileExtension = (filename: string): string => {
                        const parts = filename.split('.')
                        return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
                      }
                      const fileExtension = getFileExtension(fileName)
                      
                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-2 p-2.5 rounded-md border border-border/60 hover:bg-accent/50 hover:border-border/70 transition-colors group"
                        >
                          <IconFile className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" title={fileName}>
                              {fileName}
                            </div>
                            {(fileExtension || sizeBytes > 0) && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                {fileExtension && (
                                  <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                                    {fileExtension}
                                  </span>
                                )}
                                {sizeBytes > 0 && (
                                  <span>{formatFileSize(sizeBytes)}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <a
                              href={apiClient.getMediaUrl(workspaceId, attachment.mediaId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              >
                                <IconDownload className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                              </Button>
                            </a>
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                               onClick={async (e) => {
                                 e.stopPropagation()
                                 if (!task?.id || !workspaceId) return
                                 
                                 // Optimistically remove from UI
                                 const updatedAttachments = attachments.filter((a) => a.id !== attachment.id)
                                 setAttachments(updatedAttachments)
                                 
                                 try {
                                   // Delete from task attachments
                                   const response = await apiClient.updateTask(workspaceId, String(task.id), {
                                     attachmentMediaIds: updatedAttachments.filter((a) => !a.mediaId.startsWith('temp-')).map((a) => a.mediaId),
                                   })
                                   
                                   // Delete media from S3 and database (only if not a temp ID)
                                   if (!attachment.mediaId.startsWith('temp-')) {
                                     try {
                                       await apiClient.deleteMedia(workspaceId, attachment.mediaId)
                                     } catch (mediaError: any) {
                                       console.error("Failed to delete media file:", mediaError)
                                       // Continue even if media deletion fails - at least task is updated
                                     }
                                   }
                                   
                                   // Update attachments from response, but preserve size and filename from existing data
                                   if (response?.task?.attachments && response.task.attachments.length > 0) {
                                     // Get current attachmentDetails before removing
                                     const currentDetails = new Map(attachmentDetails)
                                     currentDetails.delete(attachment.mediaId)
                                     
                                     const preservedAttachments = response.task.attachments.map((att: any) => {
                                       // Find existing attachment to preserve size and title
                                       const existingAttachment = updatedAttachments.find((a) => a.mediaId === att.mediaId)
                                       const existingDetails = currentDetails.get(att.mediaId)
                                       return {
                                         ...att,
                                         sizeBytes: existingDetails?.sizeBytes || existingAttachment?.sizeBytes,
                                         title: existingDetails?.originalFilename || existingAttachment?.title || att.title,
                                       }
                                     })
                                     setAttachments(preservedAttachments)
                                     
                                     // Update details map after setting attachments
                                     setAttachmentDetails(currentDetails)
                                   } else {
                                     // If no response attachments, keep the optimistic update (already filtered)
                                     // Remove from details map
                                     setAttachmentDetails(prev => {
                                       const newMap = new Map(prev)
                                       newMap.delete(attachment.mediaId)
                                       return newMap
                                     })
                                     // updatedAttachments is already set above via setAttachments
                                   }
                                   
                                   // Don't call onTaskUpdate here - it might cause priority to reset
                                   // The task will be updated when modal is closed or refreshed
                                   
                                   toast.success("Attachment deleted successfully")
                                 } catch (error: any) {
                                   console.error("Failed to delete attachment:", error)
                                   toast.error(error?.message || "Failed to delete attachment")
                                   // Revert on error - restore original attachments
                                   setAttachments(attachments)
                                 }
                               }}
                             >
                               <IconTrash className="h-3.5 w-3.5 text-destructive" />
                             </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Left side - Title and Description (Desktop) / Checklist (Mobile) (%70 width) */}
            <div className="flex-1 w-full md:w-[70%] min-h-0 h-full overflow-y-auto overflow-x-hidden pr-2 md:pr-4 order-2 md:order-1">
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
                      className={`text-sm text-muted-foreground break-words cursor-pointer w-full hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 whitespace-pre-wrap ${
                        isDescriptionExpanded ? "" : "line-clamp-2"
                      }`}
                      onClick={() => {
                        if (!isDescriptionExpanded) {
                          // First click: expand
                          setIsDescriptionExpanded(true)
                        } else {
                          // Second click: edit
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
                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-1.5">
                      <IconListCheck className="h-4 w-4" />
                      Checklist
                    </h3>
                    {!isAddingChecklistItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setIsAddingChecklistItem(true)
                          setNewChecklistItemTitle("")
                        }}
                      >
                        <IconPlus className="h-3.5 w-3.5" />
                        Add item
                      </Button>
                    )}
                  </div>
                  
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={async (event: DragEndEvent) => {
                      const { active, over } = event
                      
                      if (!over || active.id === over.id || !task) {
                        return
                      }
                      
                      const sortedItems = checklistItems.sort((a, b) => a.sortOrder - b.sortOrder)
                      const oldIndex = sortedItems.findIndex((item) => item.id === active.id)
                      const newIndex = sortedItems.findIndex((item) => item.id === over.id)
                      
                      if (oldIndex !== -1 && newIndex !== -1) {
                        const reorderedItems = arrayMove(sortedItems, oldIndex, newIndex)
                        const updatedItems = reorderedItems.map((item, index) => ({
                          ...item,
                          sortOrder: index,
                        }))
                        
                        setChecklistItems(updatedItems)
                        
                        try {
                          const response = await apiClient.updateTask(workspaceId, String(task.id), {
                            checklistItems: updatedItems.map((i) => ({
                              id: i.id,
                              title: i.title,
                              isCompleted: i.isCompleted,
                              sortOrder: i.sortOrder,
                            })),
                          })
                          
                          // Update from response
                          if (response?.task?.checklistItems) {
                            setChecklistItems(response.task.checklistItems)
                          }
                          
                          // Don't call onTaskUpdate here - it might cause priority/attachments to reset
                          // The task will be updated when modal is closed or refreshed
                        } catch (error: any) {
                          console.error("Failed to reorder checklist items:", error)
                          setChecklistItems(task?.checklistItems || [])
                          toast.error(error?.message || "Failed to reorder checklist items")
                        }
                      }
                    }}
                  >
                    <SortableContext
                      items={checklistItems.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col gap-2">
                        {checklistItems
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((item) => (
                            <SortableChecklistItem
                              key={item.id}
                              item={item}
                              task={task}
                              workspaceId={workspaceId}
                              checklistItems={checklistItems}
                              onUpdate={(items) => setChecklistItems(items)}
                              onDelete={(itemId) => {
                                const updatedItems = checklistItems.filter((i) => i.id !== itemId)
                                setChecklistItems(updatedItems)
                              }}
                              onTaskUpdate={onTaskUpdate}
                            />
                          ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  
                  {isAddingChecklistItem && (
                      <div className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-accent/50 hover:border-border/70 transition-colors group">
                        <div className="h-4 w-4 rounded-md border-2 border-muted-foreground/30 flex-shrink-0" />
                        <Input
                          value={newChecklistItemTitle}
                          onChange={(e) => setNewChecklistItemTitle(e.target.value)}
                          onBlur={async () => {
                            if (!task) {
                              setIsAddingChecklistItem(false)
                              setNewChecklistItemTitle("")
                              return
                            }
                            
                            if (!newChecklistItemTitle.trim()) {
                              setIsAddingChecklistItem(false)
                              setNewChecklistItemTitle("")
                              return
                            }
                            
                            try {
                              const response = await apiClient.updateTask(workspaceId, String(task.id), {
                                checklistItems: [
                                  ...checklistItems.map((i) => ({
                                    id: i.id,
                                    title: i.title,
                                    isCompleted: i.isCompleted,
                                    sortOrder: i.sortOrder,
                                  })),
                                  {
                                    title: newChecklistItemTitle.trim(),
                                    isCompleted: false,
                                    sortOrder: checklistItems.length,
                                  },
                                ],
                              })
                              
                              // Update from response
                              if (response?.task?.checklistItems) {
                                setChecklistItems(response.task.checklistItems)
                              } else {
                                // Fallback: add optimistically
                                const newItem = {
                                  id: `temp-${Date.now()}`,
                                  title: newChecklistItemTitle.trim(),
                                  isCompleted: false,
                                  sortOrder: checklistItems.length,
                                }
                                setChecklistItems([...checklistItems, newItem])
                              }
                              
                              setNewChecklistItemTitle("")
                              setIsAddingChecklistItem(false)
                              
                              // Don't call onTaskUpdate here - it might cause priority/attachments to reset
                              // The task will be updated when modal is closed or refreshed
                            } catch (error: any) {
                              console.error("Failed to add checklist item:", error)
                              setChecklistItems(task?.checklistItems || [])
                              toast.error(error?.message || "Failed to add checklist item")
                              setIsAddingChecklistItem(false)
                              setNewChecklistItemTitle("")
                            }
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur()
                            } else if (e.key === "Escape") {
                              setNewChecklistItemTitle("")
                              setIsAddingChecklistItem(false)
                            }
                          }}
                          placeholder="Add checklist item..."
                          className="flex-1 text-sm font-medium h-auto py-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0 text-foreground"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setNewChecklistItemTitle("")
                            setIsAddingChecklistItem(false)
                          }}
                        >
                          <IconTrash className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
