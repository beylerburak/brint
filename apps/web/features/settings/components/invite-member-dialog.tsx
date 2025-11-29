"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import {
  getWorkspaceMembers,
  type WorkspaceMember,
} from "@/features/space/api/members-api";
import {
  createWorkspaceInvite,
  getWorkspaceInvites,
  type WorkspaceInvite,
} from "@/features/space/api/invites-api";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { toast } from "sonner";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteSent?: () => void;
}

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

export function InviteMemberDialog({
  open,
  onOpenChange,
  onInviteSent,
}: InviteMemberDialogProps) {
  const t = useTranslations("common");
  const { workspace } = useWorkspace();
  const [email, setEmail] = React.useState("");
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = React.useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !workspace?.id) return;

    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);
        const [membersData, invitesData] = await Promise.all([
          getWorkspaceMembers(workspace.id),
          getWorkspaceInvites(workspace.id),
        ]);
        if (!cancelled) {
          setMembers(membersData);
          setInvites(invitesData);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
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
  }, [open, workspace?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !workspace?.id) return;

    try {
      const invite = await createWorkspaceInvite(workspace.id, { email });
      
      // Show success toast
      toast.success(t("settings.workspace.people.inviteSent", { email }));
      
      // Clear email input
      setEmail("");
      
      // Reload all data to ensure consistency
      const [membersData, invitesData] = await Promise.all([
        getWorkspaceMembers(workspace.id),
        getWorkspaceInvites(workspace.id),
      ]);
      
      setMembers(membersData);
      setInvites(invitesData);
      
      // Notify parent to refresh members table
      if (onInviteSent) {
        onInviteSent();
      }
    } catch (error) {
      console.error("[InviteDialog] Error creating invite:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings.workspace.people.inviteError")
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-semibold text-foreground">
            {t("settings.workspace.people.inviteDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted-foreground">
            {t("settings.workspace.people.inviteDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite}>
          <div className="flex w-full items-center space-x-2">
            <div className="relative flex-1">
              <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="inviteEmail"
                className="h-10 pl-9"
                placeholder={t("settings.workspace.people.inviteDialog.emailPlaceholder")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="h-10" disabled={!email}>
              {t("settings.workspace.people.inviteButton")}
            </Button>
          </div>
        </form>
        <h4 className="mt-4 text-sm font-medium text-foreground">
          {t("settings.workspace.people.inviteDialog.existingAccessTitle")}
        </h4>
        {loading ? (
          <div className="py-4 text-sm text-muted-foreground">
            {t("settings.workspace.people.loadingMembers")}
          </div>
        ) : (
          <ul className="divide-y">
            {/* Show members */}
            {members.map((member) => {
              const displayName = member.user.name || member.user.email;
              const initials = getInitials(member.user.name, member.user.email);
              return (
                <li
                  key={member.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-9 w-9">
                      {member.user.avatarUrl && (
                        <AvatarImage
                          src={member.user.avatarUrl}
                          alt={displayName}
                        />
                      )}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">
                      {displayName}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-background text-xs font-medium"
                  >
                    {t(getRoleTranslationKey(member.role))}
                  </Badge>
                </li>
              );
            })}
            {/* Show pending invites */}
            {invites
              .filter((invite) => invite.status === "PENDING")
              .map((invite) => {
                const initials = getInitials(null, invite.email);
                return (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">
                        {invite.email}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-background text-xs font-medium"
                    >
                      {t("settings.workspace.people.table.status.pending")}
                    </Badge>
                  </li>
                );
              })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

