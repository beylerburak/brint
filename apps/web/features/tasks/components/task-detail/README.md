# Task Detail Components

Task-specific components for displaying and managing task details.

## Components

- **TaskDetailModal**: Main modal component for viewing/editing task details
- **TaskProperties**: Task property editor (status, priority, assignee, due date)
- **TaskComments**: Comments section with reply functionality
- **TaskChecklist**: Checklist management with drag-and-drop
- **TaskAttachments**: File attachments display and management
- **TaskActivityTabs**: Activity feed and history tabs
- **TaskActivityFeed**: Activity log display
- **CommentInput**: Comment input component
- **PropertyItem**: Individual property editor item
- **SortableChecklistItem**: Draggable checklist item
- **DatePickerWithTime**: Date and time picker component

## Hooks

- **useTaskDetail**: Main hook for task detail state management and API calls

## Types

All types are exported from `./types`:
- `TaskDetailModalProps`
- `TaskPropertiesProps`
- `TaskCommentsProps`
- `TaskChecklistProps`
- `TaskAttachmentsProps`
- `TaskActivityTabsProps`
- And more...

## Usage

```tsx
import { TaskDetailModal } from "@/features/tasks/components/task-detail"

<TaskDetailModal
  task={task}
  open={isOpen}
  onOpenChange={setIsOpen}
  workspaceId={workspaceId}
  brandId={brandId}
  brandSlug={brandSlug}
  brandName={brandName}
  brandLogoUrl={brandLogoUrl}
  onTaskUpdate={handleUpdate}
  taskStatuses={statuses}
/>
```

## Note

This is a task-specific feature module. For generic data view components (table, kanban, toolbar), see `@/components/data-view`.
