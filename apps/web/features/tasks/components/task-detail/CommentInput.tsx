"use client"

import React, { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { IconPlus, IconMoodSmile, IconAt, IconBolt, IconCircleX, IconSend } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

interface CommentInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void
    placeholder?: string
    className?: string
}

export function CommentInput({
    value,
    onChange,
    onSubmit,
    placeholder,
    className,
}: CommentInputProps) {
    const t = useTranslations("tasks")
    const [isFocused, setIsFocused] = useState(false)
    const defaultPlaceholder = placeholder || t("comments.addCommentPlaceholder")
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Only expand when typing starts, not on focus
    const isExpanded = value.trim().length > 0

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current
        if (textarea) {
            if (isExpanded) {
                textarea.style.height = "auto"
                textarea.style.height = `${textarea.scrollHeight}px`
            } else {
                textarea.style.height = "auto"
            }
        }
    }, [value, isExpanded])

    // Scroll into view when typing starts
    useEffect(() => {
        if (isExpanded && containerRef.current) {
            // Small delay to ensure DOM is updated after expansion
            setTimeout(() => {
                containerRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                    inline: 'nearest'
                })
            }, 200)
        }
    }, [isExpanded])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
        }
    }

    const handleSubmit = () => {
        if (value.trim()) {
            onSubmit()
        }
    }

    const handleFocus = () => {
        setIsFocused(true)
        // Focus olduğunda textarea'yı genişlet
        const textarea = textareaRef.current
        if (textarea && !isExpanded) {
            setTimeout(() => {
                textarea.style.height = "auto"
                textarea.style.height = `${Math.max(80, textarea.scrollHeight)}px`
            }, 0)
        }
    }

    const handleBlur = () => {
        setIsFocused(false)
        // Blur olduğunda ve value yoksa küçült
        if (!value.trim()) {
            const textarea = textareaRef.current
            if (textarea) {
                textarea.style.height = "auto"
            }
        }
    }

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            <div
                className={cn(
                    "flex flex-col border border-border rounded-lg bg-background transition-all duration-200",
                    isFocused && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-sm mx-1 px-1"
                )}
            >
                {/* Textarea */}
                <div className="relative flex-1">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder={defaultPlaceholder}
                        className={cn(
                            "w-full max-h-[200px] px-4 text-sm bg-transparent border-0 resize-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground transition-all duration-200",
                            isExpanded ? "min-h-[80px] pt-3 pb-2 rounded-t-lg" : "h-10 py-2 rounded-lg"
                        )}
                        rows={1}
                    />
                </div>

                {/* Footer with actions and submit button */}
                {isExpanded && (
                    <div className="flex items-center justify-between px-3 py-2 border-t border-border rounded-b-lg">
                        {/* Left side - Action buttons */}
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-accent"
                                onClick={() => {
                                    // TODO: File attach functionality
                                }}
                            >
                                <IconPlus className="h-4 w-4" />
                            </Button>
                            <div className="h-4 w-px bg-border mx-1" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-accent"
                                onClick={() => {
                                    // TODO: Emoji picker
                                }}
                            >
                                <IconMoodSmile className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-accent"
                                onClick={() => {
                                    // TODO: Mention functionality
                                }}
                            >
                                <IconAt className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-accent"
                                onClick={() => {
                                    // TODO: Shortcuts/commands
                                }}
                            >
                                <IconBolt className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-accent"
                                onClick={() => {
                                    // TODO: Formatting options
                                }}
                            >
                                <IconCircleX className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Right side - Submit button */}
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!value.trim()}
                            className="h-8 px-4 text-sm"
                            variant={value.trim() ? "default" : "ghost"}
                        >
                            <IconSend className="h-3.5 w-3.5" />
                            {t("comments.comment")}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

