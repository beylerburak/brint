import { httpClient } from "@/shared/http";

// ======================
// Task Category Types
// ======================

export interface TaskCategory {
  id: string;
  workspaceId: string;
  brandId: string | null;
  name: string;
  slug: string;
  color: string | null;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskCategoryRequest {
  name: string;
  slug?: string;
  color?: string | null;
  isDefault?: boolean;
  order?: number;
  brandId?: string | null;
}

export interface UpdateTaskCategoryRequest {
  name?: string;
  slug?: string;
  color?: string | null;
  isDefault?: boolean;
  order?: number;
}

export interface TaskCategoryListQuery {
  brandId?: string | null;
}

// ======================
// Task Status Types (User-Defined)
// ======================

export type TaskStatusGroup = "TODO" | "IN_PROGRESS" | "DONE";

export interface TaskStatus {
  id: string;
  workspaceId: string;
  brandId: string | null;
  name: string;
  slug: string;
  group: TaskStatusGroup;
  color: string | null;
  icon: string | null;
  description: string | null;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskStatusRequest {
  name: string;
  slug?: string;
  group: TaskStatusGroup;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  isDefault?: boolean;
  order?: number;
  brandId?: string | null;
}

export interface UpdateTaskStatusRequest {
  name?: string;
  slug?: string;
  group?: TaskStatusGroup;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  isDefault?: boolean;
  order?: number;
}

export interface TaskStatusListQuery {
  brandId?: string | null;
  group?: TaskStatusGroup;
}

// ======================
// Task Types
// ======================

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskSource = "MANUAL" | "AUTOMATION";

export interface Task {
  id: string;
  workspaceId: string;
  brandId: string | null;
  title: string;
  description: string | null;
  categoryId: string | null;
  statusId: string;
  priority: TaskPriority;
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  source: TaskSource;
  sourceMeta: unknown;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  } | null;
  status: {
    id: string;
    name: string;
    slug: string;
    group: TaskStatusGroup;
    color: string | null;
    icon: string | null;
  };
  assignee?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  reporter: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  statusId?: string | null; // If not provided, backend uses default "Backlog"
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  brandId?: string | null;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  statusId?: string; // Change to user-defined status
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
}

export interface TaskListQuery {
  brandId?: string | null;
  statusId?: string; // Filter by specific status
  statusGroup?: TaskStatusGroup; // Filter by status group
  categoryId?: string | null;
  assigneeId?: string | null;
  search?: string;
}

// ======================
// Task Status API Functions
// ======================

/**
 * List task statuses
 */
export async function listTaskStatuses(
  workspaceId: string,
  query?: TaskStatusListQuery
): Promise<TaskStatus[]> {
  const params = new URLSearchParams();
  if (query?.brandId !== undefined) {
    params.append("brandId", String(query.brandId));
  }
  if (query?.group) {
    params.append("group", query.group);
  }
  
  const url = params.toString() ? `task-statuses?${params}` : "task-statuses";
  
  const response = await httpClient.get<{ data: TaskStatus[] }>(url, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });

  return response.data.data;
}

/**
 * Create task status
 */
export async function createTaskStatus(
  workspaceId: string,
  data: CreateTaskStatusRequest
): Promise<TaskStatus> {
  // Remove null values from request body
  const cleanData: any = {
    name: data.name,
    group: data.group,
  };
  
  if (data.slug) cleanData.slug = data.slug;
  if (data.color) cleanData.color = data.color;
  if (data.icon) cleanData.icon = data.icon;
  if (data.description) cleanData.description = data.description;
  if (data.isDefault !== undefined) cleanData.isDefault = data.isDefault;
  if (data.order !== undefined) cleanData.order = data.order;
  if (data.brandId) cleanData.brandId = data.brandId;

  const response = await httpClient.post<{ data: TaskStatus }>(
    "task-statuses",
    cleanData,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  workspaceId: string,
  statusId: string,
  data: UpdateTaskStatusRequest
): Promise<TaskStatus> {
  const response = await httpClient.patch<{ data: TaskStatus }>(
    `task-statuses/${statusId}`,
    data,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Delete task status
 */
export async function deleteTaskStatus(
  workspaceId: string,
  statusId: string
): Promise<void> {
  await httpClient.delete(`task-statuses/${statusId}`, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });
}

// ======================
// Task Category API Functions
// ======================

/**
 * List task categories
 */
export async function listTaskCategories(
  workspaceId: string,
  query?: TaskCategoryListQuery
): Promise<TaskCategory[]> {
  const params = new URLSearchParams();
  if (query?.brandId !== undefined) {
    params.append("brandId", String(query.brandId));
  }
  
  const url = params.toString() ? `task-categories?${params}` : "task-categories";
  
  const response = await httpClient.get<{ data: TaskCategory[] }>(url, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });

  return response.data.data;
}

/**
 * Create task category
 */
export async function createTaskCategory(
  workspaceId: string,
  data: CreateTaskCategoryRequest
): Promise<TaskCategory> {
  const response = await httpClient.post<{ data: TaskCategory }>(
    "task-categories",
    data,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Update task category
 */
export async function updateTaskCategory(
  workspaceId: string,
  categoryId: string,
  data: UpdateTaskCategoryRequest
): Promise<TaskCategory> {
  const response = await httpClient.patch<{ data: TaskCategory }>(
    `task-categories/${categoryId}`,
    data,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Delete task category
 */
export async function deleteTaskCategory(
  workspaceId: string,
  categoryId: string
): Promise<void> {
  await httpClient.delete(`task-categories/${categoryId}`, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });
}

// ======================
// Task API Functions
// ======================

/**
 * List tasks
 */
export async function listTasks(
  workspaceId: string,
  query?: TaskListQuery
): Promise<Task[]> {
  const params = new URLSearchParams();
  if (query?.brandId !== undefined) {
    params.append("brandId", String(query.brandId));
  }
  if (query?.statusId) {
    params.append("statusId", query.statusId);
  }
  if (query?.statusGroup) {
    params.append("statusGroup", query.statusGroup);
  }
  if (query?.categoryId !== undefined) {
    params.append("categoryId", String(query.categoryId));
  }
  if (query?.assigneeId !== undefined) {
    params.append("assigneeId", String(query.assigneeId));
  }
  if (query?.search) {
    params.append("search", query.search);
  }
  
  const url = params.toString() ? `tasks?${params}` : "tasks";
  
  const response = await httpClient.get<{ data: Task[] }>(url, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });

  return response.data.data;
}

/**
 * Get task by ID
 */
export async function getTaskById(
  workspaceId: string,
  taskId: string
): Promise<Task> {
  const response = await httpClient.get<{ data: Task }>(
    `tasks/${taskId}`,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Create task
 */
export async function createTask(
  workspaceId: string,
  data: CreateTaskRequest
): Promise<Task> {
  const response = await httpClient.post<{ data: Task }>("tasks", data, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });

  return response.data.data;
}

/**
 * Update task
 */
export async function updateTask(
  workspaceId: string,
  taskId: string,
  data: UpdateTaskRequest
): Promise<Task> {
  const response = await httpClient.patch<{ data: Task }>(
    `tasks/${taskId}`,
    data,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Delete task
 */
export async function deleteTask(
  workspaceId: string,
  taskId: string
): Promise<void> {
  await httpClient.delete(`tasks/${taskId}`, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });
}

// ======================
// Task Attachment Types & API Functions
// ======================

export interface TaskAttachment {
  id: string;
  taskId: string;
  mediaId: string;
  uploadedBy: string;
  createdAt: string;
  media: {
    id: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    objectKey: string;
    createdAt: string;
  };
  uploader: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * List task attachments
 */
export async function listTaskAttachments(
  workspaceId: string,
  taskId: string
): Promise<TaskAttachment[]> {
  const response = await httpClient.get<{ data: TaskAttachment[] }>(
    `tasks/${taskId}/attachments`,
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Add task attachment
 */
export async function addTaskAttachment(
  workspaceId: string,
  taskId: string,
  mediaId: string
): Promise<TaskAttachment> {
  const response = await httpClient.post<{ data: TaskAttachment }>(
    `tasks/${taskId}/attachments`,
    { mediaId },
    {
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    }
  );

  return response.data.data;
}

/**
 * Delete task attachment
 */
export async function deleteTaskAttachment(
  workspaceId: string,
  taskId: string,
  attachmentId: string
): Promise<void> {
  await httpClient.delete(`tasks/${taskId}/attachments/${attachmentId}`, {
    headers: {
      "X-Workspace-Id": workspaceId,
    },
  });
}

