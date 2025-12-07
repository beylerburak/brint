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

                const status = STATUS_MAP[statusValue] || "offline"

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                                <Status status={status}>
                                    <StatusIndicator />
                                    <StatusLabel>{t(`status.${statusValue}`) || statusValue}</StatusLabel>
                                </Status>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {AVAILABLE_STATUSES.map((statusOption) => (
                                <DropdownMenuItem
                                    key={statusOption}
                                    onClick={() => onStatusChange?.(statusOption)}
                                    className={statusValue === statusOption ? "bg-muted" : ""}
                                >
                                    <Status status={STATUS_MAP[statusOption] || "offline"}>
                                        <StatusIndicator />
                                        <StatusLabel>{t(`status.${statusOption}`)}</StatusLabel>
                                    </Status>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            }
            case 'priority': {
                const priority = PRIORITY_MAP[value] || PRIORITY_MAP["Medium"]

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
                                return (
                                    <DropdownMenuItem
                                        key={priorityOption}
                                        onClick={() => onPriorityChange?.(priorityOption)}
                                        className={value === priorityOption ? "bg-muted" : ""}
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
