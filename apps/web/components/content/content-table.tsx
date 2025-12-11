"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SocialPlatformIcon } from "@/components/social-platform-icon"
import { format } from "date-fns"
import type { SocialPlatform } from "@brint/shared-config/platform-rules"

type Content = {
  id: string
  title: string | null
  baseCaption: string | null
  formFactor: string
  status: string
  scheduledAt: string | null
  createdAt: string
  updatedAt: string
  contentAccounts: Array<{
    socialAccount: {
      platform: string
      displayName: string | null
      username: string | null
    }
  }>
  tags: Array<{
    id: string
    name: string
    slug: string
    color: string | null
  }>
  publicationStatuses?: Array<{
    id: string
    status: string
    platform: string
  }>
}

interface ContentTableProps {
  contents: Content[]
  onContentClick?: (contentId: string) => void
  statusMap?: Record<string, string>
  formFactorMap?: Record<string, string>
}

export function ContentTable({ 
  contents, 
  onContentClick,
  statusMap = {},
  formFactorMap = {},
}: ContentTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "secondary"
      case "SCHEDULED":
        return "default"
      case "PUBLISHING":
        return "default" // Show as active/default when publishing
      case "PUBLISHED":
        return "default"
      case "PARTIALLY_PUBLISHED":
        return "outline"
      case "FAILED":
        return "destructive"
      case "ARCHIVED":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const getStatusLabel = (content: Content, statusMap: Record<string, string>) => {
    if (content.status === "PUBLISHING") {
      return statusMap["PUBLISHING"] || "Publishing"
    }
    return statusMap[content.status] || content.status
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm")
    } catch {
      return "-"
    }
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[300px]">Title</TableHead>
            <TableHead className="min-w-[120px]">Type</TableHead>
            <TableHead className="min-w-[120px]">Status</TableHead>
            <TableHead className="min-w-[150px]">Platforms</TableHead>
            <TableHead className="min-w-[120px]">Tags</TableHead>
            <TableHead className="min-w-[150px]">Scheduled</TableHead>
            <TableHead className="min-w-[150px]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No contents found
              </TableCell>
            </TableRow>
          ) : (
            contents.map((content) => (
              <TableRow
                key={content.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onContentClick?.(content.id)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    <div className="line-clamp-1">
                      {content.title || content.baseCaption || "Untitled"}
                    </div>
                    {content.baseCaption && content.title && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {content.baseCaption}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {formFactorMap[content.formFactor] || content.formFactor}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusColor(content.status)}>
                    {getStatusLabel(content, statusMap)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap">
                    {content.contentAccounts.length === 0 ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      content.contentAccounts.map((ca, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <SocialPlatformIcon
                            platform={ca.socialAccount.platform as SocialPlatform}
                            size={16}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap">
                    {content.tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      content.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="secondary"
                          className="text-xs"
                          style={
                            tag.color
                              ? {
                                  backgroundColor: tag.color,
                                  color: "white",
                                }
                              : undefined
                          }
                        >
                          {tag.name}
                        </Badge>
                      ))
                    )}
                    {content.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{content.tags.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {content.scheduledAt ? formatDate(content.scheduledAt) : "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(content.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}