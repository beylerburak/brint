-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "taskNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_workspaceId_taskNumber_key" ON "tasks"("workspaceId", "taskNumber");

-- Update existing tasks with sequential numbers per workspace
DO $$
DECLARE
    workspace_record RECORD;
    task_record RECORD;
    task_num INTEGER;
BEGIN
    FOR workspace_record IN SELECT DISTINCT "workspaceId" FROM "tasks" LOOP
        task_num := 1;
        FOR task_record IN 
            SELECT id FROM "tasks" 
            WHERE "workspaceId" = workspace_record."workspaceId" 
            ORDER BY "createdAt" ASC
        LOOP
            UPDATE "tasks" 
            SET "taskNumber" = task_num 
            WHERE id = task_record.id;
            task_num := task_num + 1;
        END LOOP;
    END LOOP;
END $$;

