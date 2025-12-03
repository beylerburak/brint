-- Create Task enums
CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'AUTOMATION');

-- Create TaskCategory table
CREATE TABLE "task_categories" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "brandId" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "color" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);

-- Create Task table
CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "brandId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "categoryId" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "assigneeId" TEXT,
  "reporterId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "startDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
  "sourceMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for TaskCategory
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key constraints for Task
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "task_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create unique index for TaskCategory
CREATE UNIQUE INDEX "task_categories_workspaceId_brandId_slug_key" ON "task_categories"("workspaceId", "brandId", "slug");

-- Create indexes for TaskCategory
CREATE INDEX "task_categories_workspaceId_brandId_idx" ON "task_categories"("workspaceId", "brandId");

-- Create indexes for Task
CREATE INDEX "tasks_workspaceId_brandId_idx" ON "tasks"("workspaceId", "brandId");
CREATE INDEX "tasks_categoryId_idx" ON "tasks"("categoryId");
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

