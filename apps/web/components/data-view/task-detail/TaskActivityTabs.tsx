"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { IconMessageCircle, IconActivity, IconClock } from "@tabler/icons-react"
import { TaskComments } from "./TaskComments"
import { TaskActivityFeed } from "./TaskActivityFeed"
import type { TaskActivityTabsProps } from "./types"

export function TaskActivityTabs({
    task,
    workspaceId,
    comments,
    onCommentsUpdate,
    activities,
    onActivitiesUpdate,
    onTaskUpdate,
}: TaskActivityTabsProps) {
    const t = useTranslations("tasks")
    const [activeTab, setActiveTab] = useState("comments")

    return (
        <div className="flex flex-col gap-2 md:gap-3 mt-2 md:mt-4 h-auto md:h-full flex-1 min-h-0 px-0 md:px-0">
            <div className="flex items-center gap-2 px-0 md:px-0">
                <IconActivity className="h-4 w-4" />
                <h3 className="text-sm font-medium">{t("activity.title")}</h3>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-visible">
                <TabsList className="w-full md:w-fit flex-shrink-0 grid grid-cols-3 md:inline-flex mx-0 md:mx-0">
                    <TabsTrigger value="comments" className="text-xs md:text-sm">
                        <IconMessageCircle className="h-3.5 w-3.5" />
                        <span className="ml-1">{t("activity.comments")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs md:text-sm">
                        <IconActivity className="h-3.5 w-3.5" />
                        <span className="ml-1">{t("activity.activity")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="worklog" className="text-xs md:text-sm">
                        <IconClock className="h-3.5 w-3.5" />
                        <span className="ml-1">{t("activity.workLog")}</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="flex-1 flex flex-col min-h-[400px] md:min-h-0 overflow-visible px-0 md:px-0">
                    <TaskComments
                        task={task}
                        workspaceId={workspaceId}
                        comments={comments}
                        onCommentsUpdate={onCommentsUpdate}
                        onTaskUpdate={onTaskUpdate}
                    />
                </TabsContent>

                <TabsContent value="activity" className="flex-1 flex flex-col min-h-[200px] md:min-h-0 overflow-hidden px-0 md:px-0">
                    <TaskActivityFeed
                        task={task}
                        workspaceId={workspaceId}
                        activities={activities}
                        onActivitiesUpdate={onActivitiesUpdate}
                    />
                </TabsContent>

                <TabsContent value="worklog" className="flex-1 flex flex-col min-h-[200px] md:min-h-0 overflow-hidden px-0 md:px-0">
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        {t("activity.workLogComingSoon")}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

