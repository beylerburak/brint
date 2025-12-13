"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { BaseTask } from "@/components/data-view/types"
import {
    ChecklistItem,
    AttachmentItem,
    AttachmentDetails,
    WorkspaceMember,
    CommentItem,
    ActivityItem,
    API_PRIORITY_MAP
} from "../types"

interface UseTaskDetailProps {
    task: BaseTask | null
    workspaceId: string
    brandId?: string
    open: boolean
    isCreateMode?: boolean
    onTaskUpdate?: (taskId: string, updates: {
        title?: string;
        description?: string;
        status?: any;
        priority?: string;
        dueDate?: string | null;
        assigneeUserId?: string | null;
        assignedTo?: any[];
    }) => void
    onTaskCreate?: (task: BaseTask) => void
}

interface UseTaskDetailReturn {
    // State
    editedTitle: string
    setEditedTitle: (title: string) => void
    editedDescription: string
    setEditedDescription: (desc: string) => void
    currentStatus: string
    currentPriority: "High" | "Medium" | "Low"
    currentDueDate: string | null
    currentAssigneeId: string | null
    currentAssigneeName: string | null
    checklistItems: ChecklistItem[]
    setChecklistItems: (items: ChecklistItem[]) => void
    attachments: AttachmentItem[]
    setAttachments: (attachments: AttachmentItem[]) => void
    attachmentDetails: Map<string, AttachmentDetails>
    setAttachmentDetails: React.Dispatch<React.SetStateAction<Map<string, AttachmentDetails>>>
    comments: CommentItem[]
    setComments: (comments: CommentItem[]) => void
    activities: ActivityItem[]
    setActivities: (activities: ActivityItem[]) => void
    workspaceMembers: WorkspaceMember[]

    // Editing state
    isEditingTitle: boolean
    setIsEditingTitle: (editing: boolean) => void
    isEditingDescription: boolean
    setIsEditingDescription: (editing: boolean) => void
    isDescriptionExpanded: boolean
    setIsDescriptionExpanded: (expanded: boolean) => void

    // Handlers
    handleSaveTitle: () => Promise<void>
    handleSaveDescription: () => Promise<void>
    handleStatusChange: (newStatus: string) => Promise<void>
    handlePriorityChange: (newPriority: string) => Promise<void>
    handleDateChange: (newDate: string | null) => Promise<void>
    handleAssigneeChange: (newAssigneeId: string | null) => Promise<void>

    // Create mode
    isCreateMode: boolean
    createdTaskId: string | null
}

export function useTaskDetail({
    task,
    workspaceId,
    brandId,
    open,
    isCreateMode = false,
    onTaskUpdate,
    onTaskCreate,
}: UseTaskDetailProps): UseTaskDetailReturn {
    // Previous property values refs to prevent unnecessary updates
    const prevStatusRef = useRef<string | null>(null)
    const prevPriorityRef = useRef<string | null>(null)
    const prevDueDateRef = useRef<string | null>(null)
    const prevAssigneeIdRef = useRef<string | null>(null)
    const prevTitleRef = useRef<string>("")
    const prevDescriptionRef = useRef<string>("")

    // Editing states
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [isEditingDescription, setIsEditingDescription] = useState(false)
    const [editedTitle, setEditedTitle] = useState(() => {
        const title = task?.title || ""
        prevTitleRef.current = title
        return title
    })
    const [editedDescription, setEditedDescription] = useState(() => {
        const description = task?.description || ""
        prevDescriptionRef.current = description
        return description
    })

    // Task property states
    const [currentStatus, setCurrentStatus] = useState(() => {
        const statusValue = typeof task?.status === 'object' && task?.status !== null && 'label' in task.status
            ? (task.status as any).label
            : (task?.status || "Not Started")
        prevStatusRef.current = statusValue
        return statusValue
    })
    const [currentPriority, setCurrentPriority] = useState<"High" | "Medium" | "Low">(() => {
        const p = task?.priority as string
        let priority: "High" | "Medium" | "Low" = "Medium"
        if (p === 'HIGH' || p === 'High') priority = 'High'
        if (p === 'LOW' || p === 'Low') priority = 'Low'
        prevPriorityRef.current = priority
        return priority
    })
    const [currentDueDate, setCurrentDueDate] = useState(() => {
        const dueDate = task?.dueDate || null
        prevDueDateRef.current = dueDate
        return dueDate
    })
    const [currentAssigneeId, setCurrentAssigneeId] = useState<string | null>(() => {
        const assigneeId = task?.assignedTo && task.assignedTo.length > 0 ? task.assignedTo[0].id : null
        prevAssigneeIdRef.current = assigneeId
        return assigneeId
    })
    const [currentAssigneeName, setCurrentAssigneeName] = useState<string | null>(null)

    // Changing flags
    const [isStatusChanging, setIsStatusChanging] = useState(false)
    const [isPriorityChanging, setIsPriorityChanging] = useState(false)
    const [isAssigneeChanging, setIsAssigneeChanging] = useState(false)

    // Create mode state - tracks the ID of a newly created task
    const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

    // Data states
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
    const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])
    const [attachments, setAttachments] = useState<AttachmentItem[]>([])
    const [attachmentDetails, setAttachmentDetails] = useState<Map<string, AttachmentDetails>>(new Map())
    const [comments, setComments] = useState<CommentItem[]>([])
    const [activities, setActivities] = useState<ActivityItem[]>([])

    // Cache refs
    const membersCacheRef = useRef<Map<string, WorkspaceMember[]>>(new Map())
    const membersLoadingRef = useRef<Set<string>>(new Set())

    // Task fetching deduplication refs
    const taskFetchingRef = useRef(false)
    const taskFetchedForRef = useRef<string | null>(null)
    
    // Track previous task to detect which properties actually changed
    const prevTaskRef = useRef<BaseTask | null>(null)

    // Fetch workspace members with cache
    useEffect(() => {
        async function fetchMembers() {
            if (!workspaceId) return

            if (membersCacheRef.current.has(workspaceId)) {
                setWorkspaceMembers(membersCacheRef.current.get(workspaceId)!)
                return
            }

            if (membersLoadingRef.current.has(workspaceId)) {
                return
            }

            membersLoadingRef.current.add(workspaceId)

            try {
                const response = await apiClient.listWorkspaceMembers(workspaceId)
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

    // Fetch full task details when modal opens
    useEffect(() => {
        async function fetchTaskDetails() {
            if (!open || !task?.id || !workspaceId) return

            // Create unique key for this fetch
            const fetchKey = `${workspaceId}:${task.id}`

            // Skip if already fetching or already fetched for this task
            if (taskFetchingRef.current) {
                console.log('[useTaskDetail] Skipping - already fetching')
                return
            }
            if (taskFetchedForRef.current === fetchKey) {
                console.log('[useTaskDetail] Skipping - already fetched for this key')
                return
            }

            taskFetchingRef.current = true

            try {
                const fullTask = await apiClient.getTask(workspaceId, String(task.id))
                if (fullTask?.task?.checklistItems) {
                    setChecklistItems(fullTask.task.checklistItems)
                } else {
                    setChecklistItems(task?.checklistItems || [])
                }
                if (fullTask?.task?.attachments) {
                    const detailsMap = new Map<string, AttachmentDetails>()
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

                // Fetch comments
                try {
                    const commentsResponse = await apiClient.listTaskComments(workspaceId, String(task.id))
                    if (commentsResponse?.comments) {
                        const commentsList: CommentItem[] = commentsResponse.comments.map((comment: any) => {
                            // Get avatar URL from avatarMediaId if avatarUrl is not available
                            let avatarUrl = comment.author.avatarUrl
                            if (!avatarUrl && comment.author.avatarMediaId) {
                                // Try without variant first (some media might not have variants)
                                avatarUrl = apiClient.getMediaUrl(workspaceId, comment.author.avatarMediaId, 'thumbnail')
                            }

                            return {
                                id: comment.id,
                                body: comment.body,
                                authorUserId: comment.authorUserId,
                                parentId: comment.parentId,
                                isEdited: comment.isEdited,
                                createdAt: comment.createdAt,
                                updatedAt: comment.updatedAt || comment.createdAt,
                                author: {
                                    id: comment.author.id,
                                    name: comment.author.name,
                                    email: comment.author.email,
                                    avatarUrl,
                                    avatarMediaId: comment.author.avatarMediaId,
                                },
                            }
                        })
                        setComments(commentsList)
                    }
                } catch (error) {
                    console.error("Failed to fetch comments:", error)
                    setComments([])
                }

                // Fetch activity logs
                try {
                    const activitiesResponse = await apiClient.listTaskActivityLogs(workspaceId, String(task.id))
                    if (activitiesResponse?.activities) {
                        const activitiesList: ActivityItem[] = activitiesResponse.activities.map((activity: any) => {
                            // Get avatar URL from avatarMediaId if avatarUrl is not available
                            let avatarUrl = activity.actor?.avatarUrl || null
                            if (activity.actor && !avatarUrl && activity.actor.avatarMediaId) {
                                avatarUrl = apiClient.getMediaUrl(workspaceId, activity.actor.avatarMediaId, 'thumbnail')
                            }

                            return {
                                id: activity.id,
                                eventKey: activity.eventKey,
                                message: activity.message,
                                context: activity.context,
                                actorType: activity.actorType,
                                actorUserId: activity.actorUserId,
                                actorLabel: activity.actorLabel,
                                actor: activity.actor ? {
                                    id: activity.actor.id,
                                    name: activity.actor.name,
                                    email: activity.actor.email,
                                    avatarUrl,
                                    avatarMediaId: activity.actor.avatarMediaId,
                                } : null,
                                payload: activity.payload,
                                severity: activity.severity,
                                visibility: activity.visibility,
                                createdAt: activity.createdAt,
                            }
                        })
                        setActivities(activitiesList)
                    }
                } catch (error) {
                    console.error("Failed to fetch activity logs:", error)
                    setActivities([])
                }

                // Mark as fetched for this key
                taskFetchedForRef.current = fetchKey
            } catch (error) {
                console.error("Failed to fetch task details:", error)
                setChecklistItems(task?.checklistItems || [])
                setAttachments(task?.attachments || [])
            } finally {
                taskFetchingRef.current = false
            }
        }

        fetchTaskDetails()

        // Reset fetched key when modal closes so we refetch next time
        return () => {
            if (!open) {
                taskFetchedForRef.current = null
            }
        }
    }, [open, task?.id, workspaceId])

    // Reset all states when modal closes or task becomes null (unless in create mode)
    useEffect(() => {
        if (!open || (!task && !isCreateMode)) {
            // Reset all states when modal closes or task is null (and not creating)
            if (!open) {
                // Modal closed - reset everything
                setEditedTitle("")
                setEditedDescription("")
                setCurrentStatus("Not Started")
                setCurrentPriority("Medium")
                setCurrentDueDate(null)
                setCurrentAssigneeId(null)
                setCurrentAssigneeName(null)
                setChecklistItems([])
                setAttachments([])
                setAttachmentDetails(new Map())
                setComments([])
                setActivities([])
                setIsEditingTitle(false)
                setIsEditingDescription(false)
                setIsDescriptionExpanded(false)
                setCreatedTaskId(null)
                prevTaskRef.current = null
                prevTitleRef.current = ""
                prevDescriptionRef.current = ""
                prevStatusRef.current = "Not Started"
                prevPriorityRef.current = "Medium"
                prevDueDateRef.current = null
                prevAssigneeIdRef.current = null
                taskFetchedForRef.current = null
            } else if (!task && !isCreateMode) {
                // Task is null but modal is open and not in create mode - reset
                setEditedTitle("")
                setEditedDescription("")
                setCurrentStatus("Not Started")
                setCurrentPriority("Medium")
                setCurrentDueDate(null)
                setCurrentAssigneeId(null)
                setCurrentAssigneeName(null)
                prevTaskRef.current = null
            }
            return
        }

        // Early return if task is null
        if (!task) {
            return
        }

        const prevTask = prevTaskRef.current
        
        // If prevTask is null or task ID changed, this is initial load - initialize all properties
        const isInitialLoad = prevTask === null || (prevTask.id !== task.id)
        
        if (isInitialLoad) {
            // Initialize prevTaskRef with current task
            prevTaskRef.current = { ...task }
        }

        // Update title only if it actually changed and not currently editing
        if (!isEditingTitle && (isInitialLoad || prevTask?.title !== task.title)) {
            const newTitle = task.title || ""
            if (newTitle !== prevTitleRef.current) {
                setEditedTitle(newTitle)
                prevTitleRef.current = newTitle
            }
        }

        // Update description only if it actually changed and not currently editing
        if (!isEditingDescription && (isInitialLoad || prevTask?.description !== task.description)) {
            const newDescription = task.description || ""
            if (newDescription !== prevDescriptionRef.current) {
                setEditedDescription(newDescription)
                prevDescriptionRef.current = newDescription
            }
        }

        // Update status only if it actually changed and not currently changing
        if (!isStatusChanging) {
            const prevStatusLabel = prevTask?.status 
                ? (typeof prevTask.status === 'object' && prevTask.status !== null && 'label' in prevTask.status
                    ? (prevTask.status as any).label
                    : prevTask.status)
                : null
            const currentStatusLabel = typeof task.status === 'object' && task.status !== null && 'label' in task.status
                ? (task.status as any).label
                : (task.status || "Not Started")
            
            // Only update if status actually changed (not on initial load unless different)
            if (isInitialLoad || prevStatusLabel !== currentStatusLabel) {
                if (currentStatusLabel !== prevStatusRef.current) {
                    setCurrentStatus(currentStatusLabel)
                    prevStatusRef.current = currentStatusLabel
                }
            }
        }

        // Update priority only if it actually changed and not currently changing
        if (!isPriorityChanging) {
            const prevPriority = prevTask?.priority
            const currentPriority = task.priority
            
            // Only update if priority actually changed (not on initial load unless different)
            if (isInitialLoad || prevPriority !== currentPriority) {
                const p = currentPriority as string
                let newPriority: "High" | "Medium" | "Low" = "Medium"
                if (p === 'HIGH' || p === 'High') newPriority = 'High'
                else if (p === 'LOW' || p === 'Low') newPriority = 'Low'

                if (newPriority !== prevPriorityRef.current) {
                    setCurrentPriority(newPriority)
                    prevPriorityRef.current = newPriority
                }
            }
        }

        // Update due date only if it actually changed
        // On initial load, always update. Otherwise, only update if it changed
        if (isInitialLoad) {
            // Initial load - always set due date
            const newDueDate = task.dueDate || null
            setCurrentDueDate(newDueDate)
            prevDueDateRef.current = newDueDate
        } else if (prevTask?.dueDate !== task.dueDate) {
            // Only update if dueDate actually changed
            const newDueDate = task.dueDate || null
            if (newDueDate !== prevDueDateRef.current) {
                setCurrentDueDate(newDueDate)
                prevDueDateRef.current = newDueDate
            }
        }

        // Update assignee only if it actually changed and not currently changing
        if (!isAssigneeChanging) {
            const prevAssigneeId = prevTask?.assignedTo && prevTask.assignedTo.length > 0 
                ? prevTask.assignedTo[0].id 
                : null
            const currentAssigneeId = task.assignedTo && task.assignedTo.length > 0 
                ? task.assignedTo[0].id 
                : null
            
            // Only update if assignee actually changed (not on initial load unless different)
            if (isInitialLoad || prevAssigneeId !== currentAssigneeId) {
                if (currentAssigneeId !== prevAssigneeIdRef.current) {
                    setCurrentAssigneeId(currentAssigneeId)
                    if (currentAssigneeId) {
                        const assignee = workspaceMembers.find(m => m.id === currentAssigneeId)
                        setCurrentAssigneeName(assignee?.name || assignee?.email || task.assignedTo?.[0]?.name || null)
                    } else {
                        setCurrentAssigneeName(null)
                    }
                    prevAssigneeIdRef.current = currentAssigneeId
                }
            }
        }
        
        // Update prevTaskRef for next comparison
        // Always update to track the current state
        prevTaskRef.current = { ...task }
        
        // NOTE: Attachments are intentionally NOT reset here
        // They are managed by the modal's fetchTaskDetails and attachment update handlers
        // Resetting them on task prop change would cause data loss after any update
    }, [task, isStatusChanging, isPriorityChanging, isAssigneeChanging, isEditingTitle, isEditingDescription, workspaceMembers])

    // Handlers
    const handleSaveTitle = useCallback(async () => {
        // Create mode: create new task when title is saved
        if (isCreateMode && !task && !createdTaskId) {
            if (!editedTitle.trim()) {
                setIsEditingTitle(false)
                return
            }

            if (!brandId) {
                toast.error("Brand ID is required to create a task")
                setIsEditingTitle(false)
                return
            }

            try {
                const response = await apiClient.createTask(workspaceId, {
                    brandId,
                    title: editedTitle.trim(),
                    priority: API_PRIORITY_MAP[currentPriority] || 'MEDIUM',
                })
                if (response?.task) {
                    setCreatedTaskId(String(response.task.id))
                    // Notify parent about new task
                    onTaskCreate?.({
                        id: response.task.id,
                        taskNumber: response.task.taskNumber,
                        title: response.task.title,
                        description: response.task.description,
                        priority: currentPriority,
                        status: response.task.status?.label || 'Not Started',
                        dueDate: response.task.dueDate || '',
                        assignedTo: [],
                        commentCount: 0,
                    })
                    toast.success("Task created")
                }
            } catch (error: any) {
                console.error("Failed to create task:", error)
                toast.error(error?.message || "Failed to create task")
            } finally {
                setIsEditingTitle(false)
            }
            return
        }

        // Get task ID (from prop or newly created)
        const taskId = task?.id || createdTaskId
        if (!taskId || editedTitle === (task?.title || '')) {
            setIsEditingTitle(false)
            return
        }

        try {
            const response = await apiClient.updateTask(workspaceId, String(taskId), {
                title: editedTitle,
            })
            const savedTitle = response?.task?.title || editedTitle
            setEditedTitle(savedTitle)
            prevTitleRef.current = savedTitle
            // Only pass the changed property to onTaskUpdate
            if (response?.task) {
                onTaskUpdate?.(String(response.task.id), {
                    title: savedTitle
                })
            } else {
                onTaskUpdate?.(String(taskId), { title: savedTitle })
            }
        } catch (error: any) {
            console.error("Failed to save title:", error)
            setEditedTitle(task?.title || "")
            toast.error(error?.message || "Failed to save title")
        } finally {
            setIsEditingTitle(false)
        }
    }, [task, editedTitle, workspaceId, brandId, isCreateMode, createdTaskId, currentPriority, onTaskUpdate, onTaskCreate])

    const handleSaveDescription = useCallback(async () => {
        if (!task || editedDescription === (task.description || "")) {
            setIsEditingDescription(false)
            return
        }

        try {
            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                description: editedDescription || undefined,
            })
            const savedDescription = response?.task?.description || editedDescription
            setEditedDescription(savedDescription)
            prevDescriptionRef.current = savedDescription
            // Only pass the changed property to onTaskUpdate
            if (response?.task) {
                onTaskUpdate?.(String(response.task.id), {
                    description: savedDescription
                })
            } else {
                onTaskUpdate?.(String(task.id), { description: savedDescription })
            }
        } catch (error: any) {
            console.error("Failed to save description:", error)
            setEditedDescription(task.description || "")
            toast.error(error?.message || "Failed to save description")
        } finally {
            setIsEditingDescription(false)
        }
    }, [task, editedDescription, workspaceId, onTaskUpdate])

    const handleStatusChange = useCallback(async (newStatus: string) => {
        if (!task) return

        setIsStatusChanging(true)

        try {
            setCurrentStatus(newStatus)

            // Fetch statuses with brandId if available
            const statusesResponse = await apiClient.listTaskStatuses(workspaceId, brandId)
            const allStatuses = Object.values(statusesResponse.statuses).flat()
            
            // newStatus might be a translated value (e.g., "Tamamlandı" in Turkish)
            // or a translation key (e.g., "Done" in English)
            // Try to find by label first
            let statusObj = allStatuses.find((s: any) => s.label === newStatus)
            
            // If not found, try to map from translation keys to actual status labels
            if (!statusObj) {
                // Map translation keys to status groups
                const statusGroupMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
                    "Not Started": "TODO",
                    "In Progress": "IN_PROGRESS",
                    "Done": "DONE",
                    // Turkish translations
                    "Başlanmadı": "TODO",
                    "Devam Ediyor": "IN_PROGRESS",
                    "Tamamlandı": "DONE",
                }
                
                const targetGroup = statusGroupMap[newStatus]
                if (targetGroup && statusesResponse.statuses[targetGroup]?.length > 0) {
                    // Use the first/default status in the target group
                    const groupStatuses = statusesResponse.statuses[targetGroup]
                    statusObj = groupStatuses.find((s: any) => s.isDefault) || groupStatuses[0]
                }
            }

            if (!statusObj) {
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

            if (response?.task) {
                // Use the actual status label from the found status object (e.g., "Completed" instead of "Done")
                const actualStatusLabel = statusObj.label
                setCurrentStatus(actualStatusLabel)
                prevStatusRef.current = actualStatusLabel
                // Ensure we pass the correct status object with the actual label
                const statusUpdate = response.task.status 
                    ? {
                        ...response.task.status,
                        label: actualStatusLabel
                    }
                    : { label: actualStatusLabel }
                // Only pass the changed property to onTaskUpdate
                onTaskUpdate?.(String(response.task.id), {
                    status: statusUpdate
                })
                setTimeout(() => {
                    setIsStatusChanging(false)
                }, 2000)
            } else {
                setIsStatusChanging(false)
            }
        } catch (error: any) {
            console.error("Failed to change status:", error)
            const statusValue = typeof task?.status === 'object' && task?.status !== null && 'label' in task.status
                ? (task.status as any).label
                : (task?.status || "Not Started")
            setCurrentStatus(statusValue)
            setIsStatusChanging(false)
            toast.error(error?.message || "Failed to change status")
        }
    }, [task, workspaceId, brandId, onTaskUpdate])

    const handlePriorityChange = useCallback(async (newPriority: string) => {
        if (!task) return

        setIsPriorityChanging(true)

        try {
            const apiPriority = API_PRIORITY_MAP[newPriority] || "MEDIUM"
            setCurrentPriority(newPriority as "High" | "Medium" | "Low")

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                priority: apiPriority,
            })

            if (response?.task) {
                setCurrentPriority(newPriority as "High" | "Medium" | "Low")
                prevPriorityRef.current = newPriority
                // Only pass the changed property to onTaskUpdate
                onTaskUpdate?.(String(response.task.id), {
                    priority: newPriority
                })
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
    }, [task, workspaceId, onTaskUpdate])

    const handleDateChange = useCallback(async (newDate: string | null) => {
        if (!task) return

        try {
            setCurrentDueDate(newDate)

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                dueDate: newDate || undefined,
            })

            if (response?.task) {
                setCurrentDueDate(newDate)
                prevDueDateRef.current = newDate
                // Only pass the changed property to onTaskUpdate
                onTaskUpdate?.(String(response.task.id), {
                    dueDate: newDate
                })
            }
        } catch (error: any) {
            console.error("Failed to change due date:", error)
            setCurrentDueDate(task?.dueDate || null)
            toast.error(error?.message || "Failed to change due date")
        }
    }, [task, workspaceId, onTaskUpdate])

    const handleAssigneeChange = useCallback(async (newAssigneeId: string | null) => {
        if (!task) return

        setIsAssigneeChanging(true)
        try {
            const assignee = newAssigneeId ? workspaceMembers.find(m => m.id === newAssigneeId) : null
            setCurrentAssigneeId(newAssigneeId)
            setCurrentAssigneeName(assignee?.name || assignee?.email || null)

            const response = await apiClient.updateTask(workspaceId, String(task.id), {
                assigneeUserId: newAssigneeId,
            })

            if (response?.task) {
                const updatedAssigneeId = response.task.assigneeUserId || null
                const updatedAssignee = updatedAssigneeId ? workspaceMembers.find(m => m.id === updatedAssigneeId) : null
                setCurrentAssigneeId(updatedAssigneeId)
                setCurrentAssigneeName(updatedAssignee?.name || updatedAssignee?.email || null)
                prevAssigneeIdRef.current = updatedAssigneeId
                // Only pass the changed property to onTaskUpdate
                onTaskUpdate?.(String(response.task.id), {
                    assigneeUserId: updatedAssigneeId,
                    assignedTo: updatedAssignee ? [updatedAssignee] : []
                })
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
    }, [task, workspaceId, workspaceMembers, onTaskUpdate])

    return {
        // State
        editedTitle,
        setEditedTitle,
        editedDescription,
        setEditedDescription,
        currentStatus,
        currentPriority,
        currentDueDate,
        currentAssigneeId,
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
        isCreateMode,
        createdTaskId,
    }
}
