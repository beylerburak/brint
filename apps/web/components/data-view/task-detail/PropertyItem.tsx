"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
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
import { Badge } from "@/components/ui/badge"
import { Status, StatusIndicator, StatusLabel } from "@/components/kibo-ui/status"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { IconFlagFilled, IconUser } from "@tabler/icons-react"
import { DatePickerWithTime } from "./DatePickerWithTime"
import {
    PropertyItemProps,
    STATUS_MAP,
    AVAILABLE_STATUSES,
    PRIORITY_MAP,
    AVAILABLE_PRIORITIES,
} from "./types"

export function PropertyItem({
    label,
    value,
    type,
    onStatusChange,
    onPriorityChange,
    onDateChange,
    onAssigneeChange,
    workspaceMembers = [],
    availableStatuses,
}: PropertyItemProps) {
    const t = useTranslations("tasks")
    // Move useState outside of render function to fix React hooks violation
    const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false)

    const renderValue = () => {
        switch (type) {
            case 'status': {
                const statusValue = typeof value === 'object' && value !== null && 'label' in value
                    ? (value as any).label
                    : String(value)

                // Use available statuses from API if provided, otherwise fall back to AVAILABLE_STATUSES
                const statusesToUse = availableStatuses && availableStatuses.length > 0
                    ? availableStatuses.map(s => s.label)
                    : AVAILABLE_STATUSES

                // Display status: if using API statuses, show the actual label, otherwise translate
                const isUsingApiStatuses = availableStatuses && availableStatuses.length > 0
                
                // If statusValue is a translation key (e.g., "Done"), find the actual label from API statuses
                let displayStatus = statusValue
                if (isUsingApiStatuses) {
                    // Check if statusValue is a translation key (one of the standard statuses)
                    const isTranslationKey = AVAILABLE_STATUSES.includes(statusValue as any)
                    if (isTranslationKey) {
                        // Map translation key to status group and find the actual label
                        const statusGroupMap: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
                            "Not Started": "TODO",
                            "In Progress": "IN_PROGRESS",
                            "Done": "DONE",
                            // Also check translated versions
                            [t("status.Not Started")]: "TODO",
                            [t("status.In Progress")]: "IN_PROGRESS",
                            [t("status.Done")]: "DONE",
                        }
                        const targetGroup = statusGroupMap[statusValue]
                        if (targetGroup) {
                            const groupStatuses = availableStatuses.filter(s => s.group === targetGroup)
                            if (groupStatuses.length > 0) {
                                // Use default status if available, otherwise first one
                                displayStatus = groupStatuses.find(s => s.isDefault)?.label || groupStatuses[0].label
                            }
                        } else {
                            // Try to find by label directly
                            const foundStatus = availableStatuses.find(s => s.label === statusValue)
                            if (foundStatus) {
                                displayStatus = foundStatus.label
                            }
                        }
                    } else {
                        // statusValue is already the actual label (e.g., "Completed")
                        displayStatus = statusValue
                    }
                } else {
                    // Fallback to translation if API statuses not available
                    displayStatus = AVAILABLE_STATUSES.includes(statusValue as any) ? t(`status.${statusValue}`) : statusValue
                }

                // Determine status color based on status group
                const getStatusColor = (label: string, group?: 'TODO' | 'IN_PROGRESS' | 'DONE'): "online" | "offline" | "maintenance" | "degraded" => {
                    // If group is available, use it directly
                    if (group) {
                        const groupColorMap: Record<'TODO' | 'IN_PROGRESS' | 'DONE', "online" | "offline" | "maintenance" | "degraded"> = {
                            TODO: "offline",
                            IN_PROGRESS: "maintenance",
                            DONE: "online",
                        }
                        return groupColorMap[group]
                    }
                    
                    // Map label to English key if it's a translation
                    const translatedNotStarted = t("status.Not Started")
                    const translatedInProgress = t("status.In Progress")
                    const translatedDone = t("status.Done")
                    
                    // Try to map from label (supports both English and translated values)
                    const statusGroupMap: Record<string, "online" | "offline" | "maintenance" | "degraded"> = {
                        // Translated values
                        [translatedNotStarted]: "offline",
                        [translatedInProgress]: "maintenance",
                        [translatedDone]: "online",
                        // English keys
                        "Not Started": "offline",
                        "In Progress": "maintenance",
                        "Done": "online",
                    }
                    
                    // Check if label matches any translation or English key
                    if (statusGroupMap[label]) {
                        return statusGroupMap[label]
                    }
                    
                    // Fallback: try to match with statusValue
                    if (statusGroupMap[statusValue]) {
                        return statusGroupMap[statusValue]
                    }
                    
                    // Default fallback
                    return "offline"
                }
                
                // Find status group for current status value
                const currentStatusObj = availableStatuses?.find(s => s.label === statusValue)
                const currentStatusGroup = currentStatusObj?.group

                const status = getStatusColor(statusValue, currentStatusGroup)

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                                <Status status={status}>
                                    <StatusIndicator />
                                    <StatusLabel>{displayStatus}</StatusLabel>
                                </Status>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {statusesToUse.map((statusOption) => {
                                // If using API statuses, use the label directly (e.g., "Completed"), otherwise translate
                                const isUsingApiStatuses = availableStatuses && availableStatuses.length > 0
                                const displayLabel = isUsingApiStatuses
                                    ? statusOption  // Direct API label (e.g., "Completed")
                                    : t(`status.${statusOption}`)  // Translate standard statuses
                                
                                // Find status group for this option
                                const statusOptionObj = availableStatuses?.find(s => s.label === statusOption)
                                const statusOptionGroup = statusOptionObj?.group
                                const statusColor = getStatusColor(statusOption, statusOptionGroup)
                                
                                return (
                                    <DropdownMenuItem
                                        key={statusOption}
                                        onClick={() => onStatusChange?.(statusOption)}
                                        className={statusValue === statusOption ? "bg-muted" : ""}
                                    >
                                        <Status status={statusColor}>
                                            <StatusIndicator />
                                            <StatusLabel>{displayLabel}</StatusLabel>
                                        </Status>
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            }
            case 'priority': {
                // Map value to English key if it's a translation
                const translatedLow = t("priority.Low")
                const translatedMedium = t("priority.Medium")
                const translatedHigh = t("priority.High")
                
                // Check if value is a translation and map to English key
                let priorityKey = value
                if (value === translatedLow) {
                    priorityKey = "Low"
                } else if (value === translatedMedium) {
                    priorityKey = "Medium"
                } else if (value === translatedHigh) {
                    priorityKey = "High"
                }
                
                const priority = PRIORITY_MAP[priorityKey] || PRIORITY_MAP["Medium"]

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                                <Badge variant="outline" className="text-muted-foreground px-1.5">
                                    <IconFlagFilled className={`h-3.5 w-3.5 ${priority.color}`} />
                                    <span>{t(`priority.${priority.label}`) || priority.label}</span>
                                </Badge>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {AVAILABLE_PRIORITIES.map((priorityOption) => {
                                const p = PRIORITY_MAP[priorityOption]
                                // Check if current value matches this option (considering translations)
                                const isSelected = value === priorityOption || 
                                    (value === translatedLow && priorityOption === "Low") ||
                                    (value === translatedMedium && priorityOption === "Medium") ||
                                    (value === translatedHigh && priorityOption === "High")
                                
                                return (
                                    <DropdownMenuItem
                                        key={priorityOption}
                                        onClick={() => onPriorityChange?.(priorityOption)}
                                        className={isSelected ? "bg-muted" : ""}
                                    >
                                        <Badge variant="outline" className="text-muted-foreground px-1.5">
                                            <IconFlagFilled className={`h-3.5 w-3.5 ${p.color}`} />
                                            <span>{t(`priority.${p.label}`) || p.label}</span>
                                        </Badge>
                                    </DropdownMenuItem>
                                )
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            }
            case 'date': {
                // Validate date value before creating Date object
                let dateValue: Date | undefined = undefined
                if (value && value !== 'null' && value !== 'undefined') {
                    const parsed = new Date(value)
                    // Check if the date is valid
                    if (!isNaN(parsed.getTime())) {
                        dateValue = parsed
                    }
                }

                return (
                    <DatePickerWithTime
                        value={dateValue}
                        onDateChange={onDateChange}
                        key={dateValue ? dateValue.toISOString() : 'no-date'}
                    />
                )
            }
            case 'assignee': {
                const assigneeValue = value && value !== 'null' && value !== 'Unassigned' ? value : t("detail.unassigned")
                const currentAssigneeId = workspaceMembers.find(m => m.name === value || m.email === value)?.id || null
                const currentAssignee = currentAssigneeId ? workspaceMembers.find(m => m.id === currentAssigneeId) : null

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
                                <CommandInput placeholder={t("detail.searchMembers")} />
                                <CommandList>
                                    <CommandEmpty>{t("detail.noMembers")}</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                            onSelect={() => {
                                                onAssigneeChange?.(null)
                                                setIsAssigneePopoverOpen(false)
                                            }}
                                            className={!value || value === 'Unassigned' ? "bg-muted" : ""}
                                        >
                                            <IconUser className="h-4 w-4" />
                                            {t("detail.unassigned")}
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
            }
            case 'text':
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
