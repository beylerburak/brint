"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CancelInviteDialog } from "./cancel-invite-dialog";
import {
  getWorkspaceMembers,
  updateWorkspaceMember,
  type WorkspaceMember,
} from "@/features/space/api/members-api";
import {
  getWorkspaceInvites,
  cancelWorkspaceInvite,
  type WorkspaceInvite,
} from "@/features/space/api/invites-api";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

function getRoleTranslationKey(role: "OWNER" | "ADMIN" | "MEMBER"): string {
  const roleMap = {
    OWNER: "owner",
    ADMIN: "admin",
    MEMBER: "member",
  };
  return `settings.workspace.role.${roleMap[role]}`;
}

function getStatusTranslation(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    PENDING: "pending",
  };
  const key = statusMap[status.toUpperCase()] || status.toLowerCase();
  return `settings.workspace.people.table.status.${key}`;
}

function createColumns(
  t: (key: string) => string
): ColumnDef<TableRow>[] {
  return [
  {
    accessorKey: "user",
    header: t("settings.workspace.people.table.columns.member"),
    cell: ({ row, table }) => {
      const member = row.original;
      
      // If it's an invite, show email with cancel chip
      if ("isInvite" in member && member.isInvite) {
        const initials = getInitials(null, member.inviteEmail);
        const handleCancelClick = () => {
          const openCancelDialog = (table.options.meta as any)?.openCancelDialog;
          if (openCancelDialog) {
            openCancelDialog(member.id, member.inviteEmail);
          }
        };

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">{member.inviteEmail}</span>
              <span className="text-sm text-muted-foreground">{t("settings.workspace.people.table.status.pending")}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
              onClick={handleCancelClick}
            >
              {t("settings.workspace.people.cancelInvite")}
            </Button>
          </div>
        );
      }
      
      const user = member.user;
      const displayName = user.name || user.email;
      const initials = getInitials(user.name, user.email);

      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{displayName}</span>
            <span className="text-sm text-muted-foreground">{user.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: t("settings.workspace.people.table.columns.role"),
    cell: ({ row, table }) => {
      const member = row.original;
      const role = member.role;
      
      // If it's an invite, show "Member" badge (readonly)
      if ("isInvite" in member && member.isInvite) {
        return (
          <Badge variant="outline">
            {t(getRoleTranslationKey("MEMBER"))}
          </Badge>
        );
      }
      
      // Get the update function from table meta
      const updateRole = (table.options.meta as any)?.updateRole;
      
      const handleRoleChange = async (newRole: "OWNER" | "ADMIN" | "MEMBER") => {
        if (newRole === role) return;
        
        if (!updateRole) return;
        
        try {
          await updateRole(member.userId, newRole);
          const roleLabel = t(getRoleTranslationKey(newRole));
          const message = t("settings.workspace.people.roleUpdateSuccess").replace("{role}", roleLabel);
          toast.success(message);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("settings.workspace.people.roleUpdateError")
          );
        }
      };

      const handleRemove = async () => {
        // TODO: Implement remove member functionality
        toast.info(t("settings.workspace.people.removeMemberComingSoon"));
      };

      const variant =
        role === "OWNER"
          ? "default"
          : role === "ADMIN"
          ? "secondary"
          : "outline";

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
              <Badge variant={variant}>{t(getRoleTranslationKey(role))}</Badge>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => handleRoleChange("OWNER")}
              disabled={role === "OWNER"}
            >
              {t(getRoleTranslationKey("OWNER"))}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleRoleChange("ADMIN")}
              disabled={role === "ADMIN"}
            >
              {t(getRoleTranslationKey("ADMIN"))}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleRoleChange("MEMBER")}
              disabled={role === "MEMBER"}
            >
              {t(getRoleTranslationKey("MEMBER"))}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleRemove}
              className="text-destructive focus:text-destructive"
            >
              {t("settings.workspace.remove")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  {
    accessorKey: "status",
    header: t("settings.workspace.people.table.columns.status"),
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <Badge variant="outline">
          {t(getStatusTranslation(status))}
        </Badge>
      );
    },
  },
  {
    accessorKey: "joinedAt",
    header: t("settings.workspace.people.table.columns.joined"),
    cell: ({ row }) => {
      const member = row.original;
      
      // If it's an invite, show invited date
      if ("isInvite" in member && member.isInvite) {
        const date = new Date(member.joinedAt);
        return (
          <span className="text-sm text-muted-foreground">
            {date.toLocaleDateString()}
          </span>
        );
      }
      
      const date = new Date(member.joinedAt);
      return (
        <span className="text-sm text-muted-foreground">
          {date.toLocaleDateString()}
        </span>
      );
    },
  },
  ];
}

interface WorkspaceMembersTableProps {
  refreshTrigger?: number;
}

type TableRow = WorkspaceMember | {
  id: string;
  userId: string;
  workspaceId: string;
  role: "MEMBER";
  status: "PENDING";
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: null;
    username: null;
    avatarUrl: null;
  };
  isInvite: true;
  inviteEmail: string;
};

export function WorkspaceMembersTable({ refreshTrigger }: WorkspaceMembersTableProps = {}) {
  const { workspace } = useWorkspace();
  const t = useTranslations("common");
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = React.useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [selectedInvite, setSelectedInvite] = React.useState<{ id: string; email: string } | null>(null);

  React.useEffect(() => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [membersData, invitesData] = await Promise.all([
          getWorkspaceMembers(workspace.id),
          getWorkspaceInvites(workspace.id),
        ]);
        console.log("[MembersTable] Loaded members:", membersData);
        console.log("[MembersTable] Loaded invites:", invitesData);
        console.log("[MembersTable] Pending invites:", invitesData.filter(i => i.status === "PENDING"));
        if (!cancelled) {
          setMembers(membersData);
          setInvites(invitesData);
        }
      } catch (err) {
        console.error("[MembersTable] Error loading data:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id, refreshTrigger]);

  const updateRole = React.useCallback(
    async (userId: string, newRole: "OWNER" | "ADMIN" | "MEMBER") => {
      if (!workspace?.id) return;

      // Optimistically update the UI
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === userId ? { ...member, role: newRole } : member
        )
      );

      try {
        await updateWorkspaceMember(workspace.id, userId, { role: newRole });
        // Reload to get fresh data
        const data = await getWorkspaceMembers(workspace.id);
        setMembers(data);
      } catch (error) {
        // Revert on error
        const data = await getWorkspaceMembers(workspace.id);
        setMembers(data);
        throw error;
      }
    },
    [workspace?.id]
  );

  const handleCancelInvite = React.useCallback(
    async (inviteId: string) => {
      if (!workspace?.id) return;

      await cancelWorkspaceInvite(workspace.id, inviteId);

      // Reload data
      const [membersData, invitesData] = await Promise.all([
        getWorkspaceMembers(workspace.id),
        getWorkspaceInvites(workspace.id),
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    },
    [workspace?.id]
  );

  const openCancelDialog = React.useCallback((inviteId: string, email: string) => {
    setSelectedInvite({ id: inviteId, email });
    setCancelDialogOpen(true);
  }, []);

  const handleConfirmCancel = React.useCallback(async () => {
    if (!selectedInvite) return;
    try {
      await handleCancelInvite(selectedInvite.id);
      setCancelDialogOpen(false);
      setSelectedInvite(null);
      // Show toast after dialog closes
      setTimeout(() => {
        toast.success(t("settings.workspace.people.inviteCancelled"));
      }, 100);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings.workspace.people.inviteCancelError")
      );
    }
  }, [selectedInvite, handleCancelInvite, t]);

  // Combine members and pending invites
  const tableData = React.useMemo<TableRow[]>(() => {
    const rows: TableRow[] = [...members];
    
    // Add pending invites as table rows
    const pendingInvites = invites.filter((invite) => invite.status === "PENDING");
    console.log("[MembersTable] Processing pending invites:", pendingInvites);
    
    pendingInvites.forEach((invite) => {
      rows.push({
        id: invite.id,
        userId: invite.email, // Use email as userId for invites
        workspaceId: invite.workspaceId,
        role: "MEMBER",
        status: "PENDING",
        joinedAt: invite.createdAt,
        user: {
          id: invite.id,
          email: invite.email,
          name: null,
          username: null,
          avatarUrl: null,
        },
        isInvite: true,
        inviteEmail: invite.email,
      });
    });
    
    console.log("[MembersTable] Final tableData:", rows);
    return rows;
  }, [members, invites]);

  const columns = React.useMemo(() => createColumns(t), [t]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateRole,
      openCancelDialog,
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-muted-foreground">Loading members...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-destructive">{error}</span>
      </div>
    );
  }

  if (tableData.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-muted-foreground">{t("settings.workspace.people.noMembersFound")}</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : typeof header.column.columnDef.header === "function"
                    ? header.column.columnDef.header({
                        column: header.column,
                        header: header,
                        table: table,
                      })
                    : header.column.columnDef.header}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {typeof cell.column.columnDef.cell === "function"
                    ? cell.column.columnDef.cell({
                        cell: cell,
                        column: cell.column,
                        row: row,
                        table: table,
                        getValue: cell.getValue,
                        renderValue: cell.renderValue,
                      })
                    : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
          </TableBody>
        </Table>
      </div>
      {selectedInvite && (
        <CancelInviteDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onConfirm={handleConfirmCancel}
          email={selectedInvite.email}
        />
      )}
    </>
  );
}

