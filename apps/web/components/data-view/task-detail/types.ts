// Task Detail Modal Types
// Shared types for task detail components

import { BaseTask } from "../types"

// Checklist Item
export interface ChecklistItem {
    id: string
    title: string
    isCompleted: boolean
    sortOrder: number
}

// Attachment Item
export interface AttachmentItem {
    id: string
    mediaId: string
    title: string | null
    sizeBytes?: number
}

// Attachment with media details
export interface AttachmentDetails {
    sizeBytes: number
    originalFilename: string
}

// Comment Item
export interface CommentItem {
    id: string
    body: string
    authorUserId: string
    parentId: string | null
    isEdited: boolean
    createdAt: string
    updatedAt: string
    author: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
        avatarMediaId: string | null
    }
}

// Activity Log Item
export interface ActivityItem {
    id: string
    eventKey: string
    message: string | null
    context: string | null
    actorType: string
    actorUserId: string | null
    actorLabel: string | null
    actor: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
        avatarMediaId: string | null
    } | null
    payload: any
    severity: string
    visibility: string
    createdAt: string
}

// Workspace Member
export interface WorkspaceMember {
    id: string
    name: string | null
    email: string
    avatarMediaId: string | null
    avatarUrl: string | null
}

// Property Types
export type PropertyType = 'status' | 'priority' | 'date' | 'assignee' | 'text'

// Status Map
export const STATUS_MAP: Record<string, "online" | "offline" | "maintenance" | "degraded"> = {
    "Done": "online",
    "In Progress": "maintenance",
    "Not Started": "offline",
}

export const AVAILABLE_STATUSES = ["Not Started", "In Progress", "Done"] as const

// Priority Map
export const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
    "Low": { label: "Low", color: "text-green-500" },
    "Medium": { label: "Medium", color: "text-yellow-500" },
    "High": { label: "High", color: "text-red-500" },
}

export const AVAILABLE_PRIORITIES = ["Low", "Medium", "High"] as const

// API Priority Map
export const API_PRIORITY_MAP: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    "Low": "LOW",
    "Medium": "MEDIUM",
    "High": "HIGH",
}

// Task Detail Modal Props
export interface TaskDetailModalProps {
    task: BaseTask | null
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    brandId?: string
    brandSlug?: string
    brandName?: string
    brandLogoUrl?: string | null
    isCreateMode?: boolean
    onTaskUpdate?: (taskId: string, updates: {
        title?: string;
        description?: string;
        status?: any;
        statusId?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeUserId?: string | null;
        assignedTo?: any[];
    }) => void
    onTaskCreate?: (task: BaseTask) => void
}

// Property Item Props
export interface PropertyItemProps {
    label: string
    value: string
    type: PropertyType
    onStatusChange?: (newStatus: string) => void
    onPriorityChange?: (newPriority: string) => void
    onDateChange?: (newDate: string | null) => void
    onAssigneeChange?: (newAssigneeId: string | null) => void
    workspaceMembers?: WorkspaceMember[]
}

// Sortable Checklist Item Props
export interface SortableChecklistItemProps {
    item: ChecklistItem
    task: BaseTask | null
    workspaceId: string
    checklistItems: ChecklistItem[]
    onUpdate: (items: ChecklistItem[]) => void
    onDelete: (itemId: string) => void
    onTaskUpdate?: (taskId: string, updates: {
        title?: string;
        description?: string;
        status?: any;
        statusId?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeUserId?: string | null;
        assignedTo?: any[];
    }) => void
}

// Date Picker Props
export interface DatePickerProps {
    value: Date | undefined
    onDateChange?: (newDate: string | null) => void
}

// Task Checklist Props
export interface TaskChecklistProps {
    task: BaseTask | null
    workspaceId: string
    checklistItems: ChecklistItem[]
    onChecklistUpdate: (items: ChecklistItem[]) => void
    onTaskUpdate?: (taskId: string, updates: {
        title?: string;
        description?: string;
        status?: any;
        statusId?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeUserId?: string | null;
        assignedTo?: any[];
    }) => void
}

// Task Properties Props
export interface TaskPropertiesProps {
    task: BaseTask | null
    workspaceId: string
    currentStatus: string
    currentPriority: "High" | "Medium" | "Low"
    currentDueDate: string | null
    currentAssigneeName: string | null
    workspaceMembers: WorkspaceMember[]
    onStatusChange: (newStatus: string) => Promise<void>
    onPriorityChange: (newPriority: string) => Promise<void>
    onDateChange: (newDate: string | null) => Promise<void>
    onAssigneeChange: (newAssigneeId: string | null) => Promise<void>
}

// Task Attachments Props
export interface TaskAttachmentsProps {
    task: BaseTask | null
    workspaceId: string
    attachments: AttachmentItem[]
    attachmentDetails: Map<string, AttachmentDetails>
    onAttachmentsUpdate: (attachments: AttachmentItem[]) => void
    onAttachmentDetailsUpdate: (details: Map<string, AttachmentDetails> | ((prev: Map<string, AttachmentDetails>) => Map<string, AttachmentDetails>)) => void
}

// Task Comments Props
export interface TaskCommentsProps {
    task: BaseTask | null
    workspaceId: string
    comments: CommentItem[]
    onCommentsUpdate: (comments: CommentItem[]) => void
    onTaskUpdate?: (taskId: string, updates: {
        title?: string;
        description?: string;
        status?: any;
        statusId?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeUserId?: string | null;
        assignedTo?: any[];
    }) => void
}

// Task Activity Tabs Props
export interface TaskActivityTabsProps {
    task: BaseTask | null
    workspaceId: string
    comments: CommentItem[]
    onCommentsUpdate: (comments: CommentItem[]) => void
    activities: ActivityItem[]
    onActivitiesUpdate: (activities: ActivityItem[]) => void
    onTaskUpdate?: (taskId: string, updates: {
        title?: string;
        description?: string;
        status?: any;
        statusId?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeUserId?: string | null;
        assignedTo?: any[];
    }) => void
}
