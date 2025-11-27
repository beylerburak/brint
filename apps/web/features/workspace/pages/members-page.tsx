"use client";

interface MembersPageProps {
  workspace: string;
}

export function MembersPage({ workspace }: MembersPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Workspace Members</h1>
        <p className="text-muted-foreground">
          Manage workspace members and their roles
        </p>
      </div>
      {/* Members management will be implemented here */}
    </div>
  );
}

