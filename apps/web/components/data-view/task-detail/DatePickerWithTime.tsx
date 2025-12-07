"use client"

import React from "react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { IconCalendar, IconClock } from "@tabler/icons-react"
import type { DatePickerProps } from "./types"

export function DatePickerWithTime({
    value,
    onDateChange,
}: DatePickerProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
    const [selectedTime, setSelectedTime] = React.useState<string>(() => {
        if (value) {
            return `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`
        }
        return '00:00'
    })
    const [includeTime, setIncludeTime] = React.useState<boolean>(() => {
        if (value) {
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

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open)

        if (!open) {
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
                        // Create UTC midnight date to signal "Date Only"
                        const year = selectedDate.getFullYear()
                        const month = selectedDate.getMonth()
                        const day = selectedDate.getDate()
                        const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
                        onDateChange?.(utcDate.toISOString())
                    }
                } else {
                    onDateChange?.(null)
                }

                initialDateRef.current = selectedDate
                initialTimeRef.current = selectedTime
                initialIncludeTimeRef.current = includeTime
            }
        } else {
            initialDateRef.current = selectedDate
            initialTimeRef.current = selectedTime
            initialIncludeTimeRef.current = includeTime
        }
    }

    const formattedDate = selectedDate
        ? (() => {
            const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            if (includeTime) {
                return `${dateStr} at ${selectedTime}`
            }
            return dateStr
        })()
        : 'No due date'

    const handleDateSelect = (date: Date | undefined) => {
        setSelectedDate(date)
        isInternalUpdateRef.current = true
    }

    const handleTimeChange = (time: string) => {
        setSelectedTime(time)
        isInternalUpdateRef.current = true
    }

    const handleIncludeTimeChange = (checked: boolean) => {
        setIncludeTime(checked)
        includeTimeRef.current = checked
        isInternalUpdateRef.current = true
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
