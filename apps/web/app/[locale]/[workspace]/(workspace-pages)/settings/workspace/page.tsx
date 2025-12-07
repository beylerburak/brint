"use client"

import { useEffect, useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/contexts/workspace-context"
import { Skeleton } from "@/components/ui/skeleton"
import { IconCheck, IconX, IconLoader2, IconTrash } from "@tabler/icons-react"
import { apiClient } from "@/lib/api-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getPlanLimits, PLAN_TYPES, type PlanType, canAddTeamMember } from "@brint/shared-config/plans"
import { UpgradeDialog } from "@/features/workspace/upgrade-dialog"
import { IconUserPlus } from "@tabler/icons-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function WorkspaceSettingsPage() {
  const t = useTranslations('settings')
  const router = useRouter()
  const { currentWorkspace, isLoadingWorkspace, refreshWorkspace, user } = useWorkspace()
  
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const lastWorkspaceIdRef = useRef<string | null>(null)
  const [members, setMembers] = useState<Array<{
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: string
  }>>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)
  const [memberToUpdateRole, setMemberToUpdateRole] = useState<{ userId: string; newRole: string } | null>(null)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('VIEWER')
  const [isInviting, setIsInviting] = useState(false)

  // Load workspace details (including memberCount) when workspace changes
  useEffect(() => {
    if (currentWorkspace?.id && currentWorkspace.id !== lastWorkspaceIdRef.current) {
      // Load workspace details to get memberCount
      refreshWorkspace(currentWorkspace.id)
      lastWorkspaceIdRef.current = currentWorkspace.id
    }
  }, [currentWorkspace?.id, refreshWorkspace])

  // Load workspace members
  useEffect(() => {
    if (currentWorkspace?.id) {
      loadMembers()
    }
  }, [currentWorkspace?.id])

  const loadMembers = async () => {
    if (!currentWorkspace?.id) return
    setIsLoadingMembers(true)
    try {
      const response = await apiClient.listWorkspaceMembers(currentWorkspace.id)
      setMembers(response.members)
    } catch (error) {
      console.error('Failed to load members:', error)
      toast.error(t('failedToLoadMembers') || 'Failed to load members')
    } finally {
      setIsLoadingMembers(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!currentWorkspace?.id) return
    try {
      await apiClient.removeWorkspaceMember(currentWorkspace.id, userId)
      toast.success(t('memberRemoved'))
      await loadMembers()
      await refreshWorkspace(currentWorkspace.id) // Refresh member count
      setMemberToRemove(null)
    } catch (error: any) {
      console.error('Failed to remove member:', error)
      toast.error(error?.error?.message || t('failedToRemoveMember'))
    }
  }

  const handleUpdateRole = async (userId: string, newRole: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER') => {
    if (!currentWorkspace?.id) return
    try {
      await apiClient.updateWorkspaceMemberRole(currentWorkspace.id, userId, newRole)
      toast.success(t('roleUpdated'))
      await loadMembers()
      setMemberToUpdateRole(null)
    } catch (error: any) {
      console.error('Failed to update role:', error)
      toast.error(error?.error?.message || t('failedToUpdateRole'))
    }
  }

  const handleInviteMember = async () => {
    if (!currentWorkspace?.id || !inviteEmail.trim()) return

    // Check plan limits
    const planType = currentWorkspace.plan || 'FREE'
    const plan: PlanType = PLAN_TYPES.includes(planType as PlanType) ? planType as PlanType : 'FREE'
    const currentMemberCount = currentWorkspace.memberCount || 0

    if (!canAddTeamMember(plan, currentMemberCount)) {
      setShowInviteDialog(false)
      setShowUpgradeDialog(true)
      return
    }

    setIsInviting(true)
    try {
      await apiClient.inviteWorkspaceMember(currentWorkspace.id, inviteEmail.trim(), inviteRole)
      toast.success(t('memberInvited') || 'Member invited successfully')
      await loadMembers()
      await refreshWorkspace(currentWorkspace.id) // Refresh member count
      setShowInviteDialog(false)
      setInviteEmail('')
      setInviteRole('VIEWER')
    } catch (error: any) {
      console.error('Failed to invite member:', error)
      const errorCode = error?.code || error?.error?.code
      if (errorCode === 'MEMBER_LIMIT_REACHED') {
        setShowInviteDialog(false)
        setShowUpgradeDialog(true)
      } else if (errorCode === 'USER_NOT_FOUND') {
        toast.error(t('userNotFound') || 'This user is not registered in the system. They need to sign up first.')
      } else if (errorCode === 'MEMBER_ALREADY_EXISTS') {
        toast.error(t('memberAlreadyExists') || 'This user is already a member of this workspace.')
      } else {
        toast.error(error?.message || error?.error?.message || t('failedToInviteMember') || 'Failed to invite member')
      }
    } finally {
      setIsInviting(false)
    }
  }

  const canManageMembers = currentWorkspace?.userRole === 'OWNER' || currentWorkspace?.userRole === 'ADMIN'
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  // Initialize form values
  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setSlug(currentWorkspace.slug)
    }
  }, [currentWorkspace])

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug === currentWorkspace?.slug) {
      setSlugAvailable(null)
      return
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3) {
      setSlugAvailable(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true)
      try {
        const response = await fetch(
          `http://localhost:3001/workspaces/slug/${slug}/available?excludeWorkspaceId=${currentWorkspace?.id}`,
          { credentials: 'include' }
        )
        const data = await response.json()
        setSlugAvailable(data.available)
      } catch (error) {
        console.error('Slug check failed:', error)
        setSlugAvailable(false)
      } finally {
        setIsCheckingSlug(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [slug, currentWorkspace?.slug, currentWorkspace?.id])

  // Track changes
  useEffect(() => {
    const changed = 
      name !== currentWorkspace?.name ||
      (slug !== currentWorkspace?.slug && slugAvailable === true)
    setHasChanges(changed)
  }, [name, slug, slugAvailable, currentWorkspace])

  const handleSave = async () => {
    if (!currentWorkspace?.id || !hasChanges) return

    setIsSaving(true)
    try {
      const response = await fetch(
        `http://localhost:3001/workspaces/${currentWorkspace.id}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name !== currentWorkspace.name ? name : undefined,
            slug: slug !== currentWorkspace.slug ? slug : undefined,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Update failed')
      }

      toast.success(t('workspaceUpdated'))
      
      // If slug changed, redirect to new URL
      if (slug !== currentWorkspace.slug) {
        const locale = window.location.pathname.split('/')[1]
        router.push(`/${locale}/${slug}/settings/workspace`)
      } else {
        await refreshWorkspace(currentWorkspace.id)
      }
    } catch (error) {
      console.error('Workspace update failed:', error)
      toast.error(t('workspaceUpdateFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setSlug(currentWorkspace.slug)
      setHasChanges(false)
    }
  }

  if (isLoadingWorkspace) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('workspaceTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('workspaceDescription')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('workspaceInfo')}</CardTitle>
          <CardDescription>
            {t('workspaceInfoDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('workspaceName')}</Label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('workspaceNamePlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('workspaceNameDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('workspaceSlug')}</Label>
            <InputGroup>
              <InputGroupAddon>
                <span className="text-muted-foreground font-mono">@</span>
              </InputGroupAddon>
              <InputGroupInput 
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={t('workspaceSlugPlaceholder')}
              />
              <InputGroupAddon align="inline-end">
                {isCheckingSlug && <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!isCheckingSlug && slugAvailable === true && slug !== currentWorkspace?.slug && (
                  <IconCheck className="h-4 w-4 text-green-600" />
                )}
                {!isCheckingSlug && slugAvailable === false && slug !== currentWorkspace?.slug && (
                  <IconX className="h-4 w-4 text-red-600" />
                )}
              </InputGroupAddon>
            </InputGroup>
            <p className="text-xs text-muted-foreground">
              {slug === currentWorkspace?.slug && t('currentSlug')}
              {slug !== currentWorkspace?.slug && slugAvailable === true && (
                <span className="text-green-600">{t('slugAvailable')}</span>
              )}
              {slug !== currentWorkspace?.slug && slugAvailable === false && (
                <span className="text-red-600">{t('slugTaken')}</span>
              )}
              {slug !== currentWorkspace?.slug && slugAvailable === null && t('workspaceSlugDesc')}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t('plan')}</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {currentWorkspace?.plan}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('planDesc')}
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!hasChanges || isSaving || (slug !== currentWorkspace?.slug && !slugAvailable)}>
              {isSaving ? t('saving') : t('saveChanges')}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={!hasChanges || isSaving}>
              {t('cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('subscriptionPlan')}</CardTitle>
          <CardDescription>
            {t('subscriptionPlanDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('currentPlan')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('currentPlanDesc', { plan: currentWorkspace?.plan || 'FREE' })}
              </p>
            </div>
            <Badge variant="secondary" className="text-base">
              {currentWorkspace?.plan}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>{t('planLimits')}</Label>
            <div className="text-sm space-y-1">
              {(() => {
                const planType = currentWorkspace?.plan || 'FREE'
                // Ensure plan type is valid, fallback to FREE if not
                const plan: PlanType = PLAN_TYPES.includes(planType as PlanType) 
                  ? planType as PlanType 
                  : 'FREE'
                const limits = getPlanLimits(plan)
                const formatLimit = (value: number | undefined | null) => {
                  if (value === undefined || value === null) return 'N/A'
                  if (value === -1) return 'Unlimited'
                  if (value >= 1000) return value.toLocaleString()
                  return String(value)
                }
                return (
                  <>
                    <p className="text-muted-foreground">
                      • Max Brands: {formatLimit(limits?.maxBrands)}
                    </p>
                    <p className="text-muted-foreground">
                      • Max Members: {formatLimit(limits?.maxTeamMembers)}
                    </p>
                    <p className="text-muted-foreground">
                      • Monthly Posts: {formatLimit(limits?.maxMonthlyPosts)}
                    </p>
                  </>
                )
              })()}
            </div>
          </div>

          <Button disabled>{t('upgradePlan')}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('regionalSettings')}</CardTitle>
          <CardDescription>
            {t('regionalSettingsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('timezone')}</Label>
            <Select defaultValue={currentWorkspace?.timezone || 'Europe/Istanbul'} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Istanbul">Europe/Istanbul (UTC+3)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (UTC+0)</SelectItem>
                <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('locale')}</Label>
            <Select value={currentWorkspace?.locale || 'tr-TR'} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tr-TR">Türkçe (Turkey)</SelectItem>
                <SelectItem value="en-US">English (US)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('baseCurrency')}</Label>
            <Select defaultValue={currentWorkspace?.baseCurrency || 'TRY'} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRY">TRY (₺)</SelectItem>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button disabled>{t('saveChanges')}</Button>
            <Button variant="outline" disabled>{t('cancel')}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('workspaceMembers')}</CardTitle>
          <CardDescription>
            {t('workspaceMembersDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium">{t('totalMembers')}</p>
              <p className="text-2xl font-bold">{currentWorkspace?.memberCount || 0}</p>
            </div>
            {canManageMembers && (
              <Button
                onClick={() => {
                  const planType = currentWorkspace?.plan || 'FREE'
                  const plan: PlanType = PLAN_TYPES.includes(planType as PlanType) ? planType as PlanType : 'FREE'
                  const currentMemberCount = currentWorkspace?.memberCount || 0
                  
                  if (!canAddTeamMember(plan, currentMemberCount)) {
                    setShowUpgradeDialog(true)
                  } else {
                    setShowInviteDialog(true)
                  }
                }}
                size="sm"
              >
                <IconUserPlus className="h-4 w-4 mr-2" />
                {t('inviteMember')}
              </Button>
            )}
          </div>

          {isLoadingMembers ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('member')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  {canManageMembers && <TableHead className="text-right">{t('actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageMembers ? 4 : 3} className="text-center text-muted-foreground">
                      {t('noMembers')}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatarUrl || undefined} />
                            <AvatarFallback>{getInitials(member.name, member.email)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name || member.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        {canManageMembers && member.id !== user?.id ? (
                          <Select
                            value={member.role}
                            onValueChange={(newRole) => {
                              if (newRole !== member.role) {
                                setMemberToUpdateRole({ userId: member.id, newRole: newRole as 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' })
                              }
                            }}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OWNER">OWNER</SelectItem>
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                              <SelectItem value="EDITOR">EDITOR</SelectItem>
                              <SelectItem value="VIEWER">VIEWER</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={member.role === 'OWNER' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        )}
                      </TableCell>
                      {canManageMembers ? (
                        <TableCell className="text-right">
                          {member.id !== user?.id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToRemove(member.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* Remove Member Confirmation Dialog */}
          <AlertDialog open={memberToRemove !== null} onOpenChange={(open) => !open && setMemberToRemove(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('removeMember')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('removeMemberConfirm', { 
                    name: members.find(m => m.id === memberToRemove)?.name || 
                          members.find(m => m.id === memberToRemove)?.email 
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => memberToRemove && handleRemoveMember(memberToRemove)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('remove')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Update Role Confirmation Dialog */}
          <AlertDialog open={memberToUpdateRole !== null} onOpenChange={(open) => !open && setMemberToUpdateRole(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('changeRole')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('changeRoleConfirm', { 
                    name: memberToUpdateRole ? (members.find(m => m.id === memberToUpdateRole.userId)?.name || 
                          members.find(m => m.id === memberToUpdateRole.userId)?.email) : '',
                    role: memberToUpdateRole?.newRole
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => memberToUpdateRole && handleUpdateRole(memberToUpdateRole.userId, memberToUpdateRole.newRole as 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER')}
                >
                  {t('confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Invite Member Dialog */}
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('inviteMember')}</DialogTitle>
                <DialogDescription>
                  {t('inviteMemberDesc')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">{t('email')}</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isInviting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">{t('role')}</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as 'ADMIN' | 'EDITOR' | 'VIEWER')}
                    disabled={isInviting}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                      <SelectItem value="EDITOR">EDITOR</SelectItem>
                      <SelectItem value="VIEWER">VIEWER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteDialog(false)
                    setInviteEmail('')
                    setInviteRole('VIEWER')
                  }}
                  disabled={isInviting}
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleInviteMember}
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  {isInviting ? (
                    <>
                      <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('inviting')}
                    </>
                  ) : (
                    <>
                      <IconUserPlus className="h-4 w-4 mr-2" />
                      {t('invite')}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Upgrade Dialog */}
          <UpgradeDialog
            open={showUpgradeDialog}
            onOpenChange={setShowUpgradeDialog}
            currentPlan={(currentWorkspace?.plan || 'FREE') as 'FREE' | 'STARTER' | 'PRO' | 'AGENCY'}
            feature="members"
          />
        </CardContent>
      </Card>
    </div>
  )
}

