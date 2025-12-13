"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { LoaderIcon, Mail, MoreHorizontal, UserPlus, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { useWorkspace } from "@/contexts/workspace-context"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

interface Member {
  id: string
  name: string | null
  email: string
  avatarMediaId: string | null
  avatarUrl: string | null
  role: string
}

export const WorkspaceMembersContent = React.memo(() => {
  const t = useTranslations('settings')
  const { currentWorkspace, user } = useWorkspace()
  const [members, setMembers] = React.useState<Member[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviteRole, setInviteRole] = React.useState<WorkspaceRole>('VIEWER')
  const [isInviting, setIsInviting] = React.useState(false)
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(null)
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null)

  const loadMembers = React.useCallback(async () => {
    if (!currentWorkspace) return
    
    setIsLoading(true)
    try {
      const response = await apiClient.listWorkspaceMembers(currentWorkspace.id, { skipCache: true })
      setMembers(response.members)
    } catch (error) {
      console.error('Failed to load members:', error)
      toast.error(t('failedToLoadMembers') || 'Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspace, t])

  React.useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const handleInvite = React.useCallback(async () => {
    if (!currentWorkspace || !inviteEmail.trim()) return

    setIsInviting(true)
    try {
      await apiClient.inviteWorkspaceMember(currentWorkspace.id, inviteEmail.trim(), inviteRole)
      toast.success(t('memberInvited') || 'Member invited successfully')
      setIsInviteDialogOpen(false)
      setInviteEmail('')
      setInviteRole('VIEWER')
      await loadMembers()
    } catch (error: any) {
      console.error('Failed to invite member:', error)
      const errorMessage = error.message || error.error?.message || ''
      
      if (errorMessage.includes('not found') || errorMessage.includes('not registered')) {
        toast.error(t('userNotFound') || 'This user is not registered in the system. They need to sign up first.')
      } else if (errorMessage.includes('already exists') || errorMessage.includes('already a member')) {
        toast.error(t('memberAlreadyExists') || 'This user is already a member of this workspace.')
      } else {
        toast.error(t('failedToInviteMember') || 'Failed to invite member')
      }
    } finally {
      setIsInviting(false)
    }
  }, [currentWorkspace, inviteEmail, inviteRole, t, loadMembers])

  const handleRemoveMember = React.useCallback(async (memberId: string, memberName: string | null) => {
    if (!currentWorkspace) return

    setRemovingMemberId(memberId)
    try {
      await apiClient.removeWorkspaceMember(currentWorkspace.id, memberId)
      toast.success(t('memberRemoved') || 'Member removed successfully')
      await loadMembers()
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast.error(t('failedToRemoveMember') || 'Failed to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }, [currentWorkspace, t, loadMembers])

  const handleUpdateRole = React.useCallback(async (memberId: string, newRole: WorkspaceRole) => {
    if (!currentWorkspace) return

    setUpdatingMemberId(memberId)
    try {
      await apiClient.updateWorkspaceMemberRole(currentWorkspace.id, memberId, newRole)
      toast.success(t('roleUpdated') || 'Role updated successfully')
      await loadMembers()
    } catch (error) {
      console.error('Failed to update role:', error)
      toast.error(t('failedToUpdateRole') || 'Failed to update role')
    } finally {
      setUpdatingMemberId(null)
    }
  }, [currentWorkspace, t, loadMembers])

  const roleOptions: Array<{ value: WorkspaceRole; label: string }> = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'EDITOR', label: 'Editor' },
    { value: 'VIEWER', label: 'Viewer' },
  ]

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'OWNER':
        return 'Owner'
      case 'ADMIN':
        return 'Admin'
      case 'EDITOR':
        return 'Editor'
      case 'VIEWER':
        return 'Viewer'
      default:
        return role
    }
  }

  const getInitials = (name: string | null, email: string): string => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const currentUserMember = members.find(m => m.id === user?.id)
  const canManageMembers = currentUserMember?.role === 'OWNER' || currentUserMember?.role === 'ADMIN'
  const isOwner = currentUserMember?.role === 'OWNER'

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('workspaceMembers') || 'Workspace Members'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('workspaceMembersDesc') || 'People who have access to this workspace'}
          </p>
        </div>
        {canManageMembers && (
          <Button
            onClick={() => setIsInviteDialogOpen(true)}
            className="w-full sm:w-auto"
            size="sm"
          >
            <UserPlus className="size-4 mr-2" />
            {t('inviteMember') || 'Invite Member'}
          </Button>
        )}
      </div>

      {/* Members Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderIcon className="animate-spin size-6 text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UserPlus className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('noMembers') || 'No members found'}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[400px] px-4">{t('member') || 'Member'}</TableHead>
                <TableHead className="px-4">{t('role') || 'Role'}</TableHead>
                <TableHead className="w-[100px] px-4 text-right">{t('actions') || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isCurrentUser = member.id === user?.id
                const isRemoving = removingMemberId === member.id
                const isUpdating = updatingMemberId === member.id
                const canEdit = canManageMembers && !isCurrentUser && member.role !== 'OWNER'
                const canRemove = isOwner && !isCurrentUser && member.role !== 'OWNER'

                return (
                  <TableRow key={member.id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarImage src={member.avatarUrl || undefined} alt={member.name || member.email} />
                          <AvatarFallback className="text-xs">{getInitials(member.name, member.email)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{member.name || member.email}</p>
                            {isCurrentUser && (
                              <span className="text-xs text-muted-foreground shrink-0">({t('you') || 'You'})</span>
                            )}
                          </div>
                          {member.name && (
                            <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {canEdit ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleUpdateRole(member.id, value as WorkspaceRole)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {member.role === 'OWNER' && (
                              <SelectItem value="OWNER">{getRoleLabel('OWNER')}</SelectItem>
                            )}
                            {roleOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isUpdating && <LoaderIcon className="animate-spin size-4" />}
                          <span className="text-sm">{getRoleLabel(member.role)}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      {canRemove && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isRemoving || isUpdating}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              disabled={isRemoving}
                              className="text-destructive"
                            >
                              <Trash2 className="size-4 mr-2" />
                              {isRemoving ? (
                                <>
                                  <LoaderIcon className="animate-spin size-4 mr-2" />
                                  {t('removing') || 'Removing...'}
                                </>
                              ) : (
                                t('removeMember') || 'Remove Member'
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{t('inviteMember') || 'Invite Member'}</DialogTitle>
          <DialogDescription>
            {t('inviteMemberDesc') || 'Invite a user to this workspace by email address'}
          </DialogDescription>
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">{t('email') || 'Email'}</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isInviting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inviteEmail.trim() && !isInviting) {
                    handleInvite()
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">{t('role') || 'Role'}</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as WorkspaceRole)}
                disabled={isInviting}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsInviteDialogOpen(false)
                  setInviteEmail('')
                  setInviteRole('VIEWER')
                }}
                disabled={isInviting}
              >
                {t('cancel') || 'Cancel'}
              </Button>
              <Button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || isInviting}
              >
                {isInviting ? (
                  <>
                    <LoaderIcon className="animate-spin size-4 mr-2" />
                    {t('inviting') || 'Inviting...'}
                  </>
                ) : (
                  <>
                    <Mail className="size-4 mr-2" />
                    {t('invite') || 'Invite'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})

WorkspaceMembersContent.displayName = "WorkspaceMembersContent"
