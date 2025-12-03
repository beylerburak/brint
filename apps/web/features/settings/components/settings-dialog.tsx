"use client"

import * as React from "react"

import {
  Bell,
  Building2,
  CreditCard,
  FileText,
  HelpCircle,
  Link2,
  Lock,
  Plug,
  Plus,
  Settings,
  Share2,
  Shield,
  Sliders,
  User,
  UserRoundIcon,
  Users,
  X,
  Zap,
} from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/animate-ui/components/radix/sidebar"
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
  TabsHighlight,
  TabsHighlightItem,
} from "@/components/animate-ui/primitives/radix/tabs"
import { useTranslations, useLocale } from "next-intl"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useAuth } from "@/features/auth/context/auth-context"
import { useWorkspace } from "@/features/space/context/workspace-context"
import { useHasPermission, PERMISSIONS } from "@/permissions"
import { presignUpload, finalizeUpload, getMediaConfig, type MediaConfig } from "@/shared/api/media"
import { updateUserProfile, checkUsernameAvailability, disconnectGoogleConnection, type UserProfile } from "@/features/space/api/user-api"
import { getCurrentSession, refreshToken, getGoogleOAuthUrl } from "@/features/auth/api/auth-api"
import { apiCache } from "@/shared/api/cache"
import { getAccessToken } from "@/shared/auth/token-storage"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { logger } from "@/shared/utils/logger"
import { z } from "zod"
import { motion } from "motion/react"
import { useToast } from "@/components/ui/use-toast"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Cropper,
  CropperImage,
  CropperArea,
  useCropper,
  type CropperAreaData,
} from "@/components/ui/cropper"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CheckIcon, ChevronsUpDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ChevronDown } from "lucide-react"
import { locales, type Locale } from "@/shared/i18n/locales"
import { WorkspaceMembersTable } from "./workspace-members-table"
import { WorkspaceTaskStatusesManager } from "./workspace-task-statuses-manager"
import { InviteMemberDialog } from "./invite-member-dialog"
import { ConnectionCard } from "./connection-card"
import { DATE_FORMAT_LABELS, TIME_FORMAT_LABELS, type DateFormatKey, type TimeFormatKey } from "@/shared/lib/date-time-format"

// Memoized User Profile Menu Item to prevent unnecessary re-renders
const UserProfileMenuItem = React.memo<{
  user: { name: string | null; email: string; avatarUrl: string | null };
  initials: string;
  displayName: string;
  isActive: boolean;
  onItemClick: () => void;
}>(({ user, initials, displayName, isActive, onItemClick }) => {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        onClick={onItemClick}
        size="lg"
      >
        <a href="#">
          <Avatar className="h-8 w-8 rounded-lg">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={displayName} />
            )}
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if user data, initials, displayName, or isActive changes
  return (
    prevProps.user.name === nextProps.user.name &&
    prevProps.user.email === nextProps.user.email &&
    prevProps.user.avatarUrl === nextProps.user.avatarUrl &&
    prevProps.initials === nextProps.initials &&
    prevProps.displayName === nextProps.displayName &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.onItemClick === nextProps.onItemClick
  );
});
UserProfileMenuItem.displayName = "UserProfileMenuItem";

type NavItem = {
  id: string
  translationKey: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  id: string
  translationKey: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: "account",
    translationKey: "settings.group.account",
    items: [
      {
        id: "userProfile",
        translationKey: "settings.account.userProfile",
        icon: User,
      },
      {
        id: "preferences",
        translationKey: "settings.account.preferences",
        icon: Sliders,
      },
      {
        id: "notifications",
        translationKey: "settings.account.notifications",
        icon: Bell,
      },
      {
        id: "connections",
        translationKey: "settings.account.connectionsLabel",
        icon: Link2,
      },
    ],
  },
  {
    id: "workspace",
    translationKey: "settings.group.workspace",
    items: [
      {
        id: "general",
        translationKey: "settings.workspace.general",
        icon: Settings,
      },
      {
        id: "people",
        translationKey: "settings.workspace.people.title",
        icon: Users,
      },
      {
        id: "identity",
        translationKey: "settings.workspace.identity",
        icon: Shield,
      },
      {
        id: "tasks",
        translationKey: "settings.workspace.tasks",
        icon: CheckCircle2,
      },
      {
        id: "subscription",
        translationKey: "settings.workspace.subscription",
        icon: CreditCard,
      },
      {
        id: "integrations",
        translationKey: "settings.workspace.integrations",
        icon: Plug,
      },
      {
        id: "supportTickets",
        translationKey: "settings.workspace.supportTickets",
        icon: HelpCircle,
      },
    ],
  },
  {
    id: "brand",
    translationKey: "settings.group.brand",
    items: [
      {
        id: "brandProfile",
        translationKey: "settings.brand.brandProfile",
        icon: Building2,
      },
      {
        id: "socialAccounts",
        translationKey: "settings.brand.socialAccounts",
        icon: Share2,
      },
      {
        id: "publishingRules",
        translationKey: "settings.brand.publishingRules",
        icon: FileText,
      },
      {
        id: "automationReporting",
        translationKey: "settings.brand.automationReporting",
        icon: Zap,
      },
      {
        id: "integrations",
        translationKey: "settings.brand.integrations",
        icon: Plug,
      },
    ],
  },
]

interface SettingsDialogProps {
  children: React.ReactNode
  defaultActiveItem?: string | null
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

function ThemePreferenceSelect() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const t = useTranslations("common")

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-foreground opacity-50 cursor-not-allowed rounded-md"
        disabled
      >
        {t("settings.account.preferencesTheme") || "Theme"}
        <ChevronDown className="h-3 w-3" />
      </button>
    )
  }

  const currentTheme = theme || "system"
  const themeLabels = {
    light: t("settings.account.preferencesThemeLight") || "Light",
    dark: t("settings.account.preferencesThemeDark") || "Dark",
    system: t("settings.account.preferencesThemeSystem") || "System",
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
        >
          {themeLabels[currentTheme as keyof typeof themeLabels]}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[180px]" align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={currentTheme === "light" ? "bg-accent" : ""}
        >
          {themeLabels.light}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={currentTheme === "dark" ? "bg-accent" : ""}
        >
          {themeLabels.dark}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={currentTheme === "system" ? "bg-accent" : ""}
        >
          {themeLabels.system}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguagePreferenceSelect({ 
  currentLocale: initialLocale, 
  onLocaleChange,
  onBeforeNavigate
}: { 
  currentLocale: string | undefined
  onLocaleChange: (locale: string) => Promise<void>
  onBeforeNavigate?: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const currentLocale = (useLocale() as Locale) || (initialLocale as Locale) || "en"
  const [isSaving, setIsSaving] = React.useState(false)
  const t = useTranslations("common")

  const localeLabels: Record<Locale, string> = {
    en: "English",
    tr: "Türkçe",
  }

  const switchLocale = async (newLocale: Locale) => {
    setIsSaving(true)
    try {
      await onLocaleChange(newLocale)
      let pathWithoutLocale = pathname
      if (currentLocale !== "en" || pathname.startsWith(`/${currentLocale}`)) {
        pathWithoutLocale = pathname.replace(`/${currentLocale}`, "")
      }
      const newPath = newLocale === "en" 
        ? pathWithoutLocale || "/"
        : `/${newLocale}${pathWithoutLocale}`
      
      // Close dialog before navigation to prevent overlay from staying
      onBeforeNavigate?.()
      
      // Use setTimeout to ensure dialog closes before navigation
      setTimeout(() => {
        router.push(newPath)
      }, 0)
    } catch (error) {
      logger.error("Failed to update locale:", error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
          disabled={isSaving}
        >
          {isSaving ? (t("saving") || "Saving...") : localeLabels[currentLocale]}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[180px]" align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchLocale(locale)}
            className={currentLocale === locale ? "bg-accent" : ""}
          >
            {localeLabels[locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DateFormatPreferenceSelect({
  currentFormat,
  onFormatChange,
}: {
  currentFormat: string | undefined;
  onFormatChange: (format: string) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = React.useState(false);
  const t = useTranslations("common");

  const formatOptions: DateFormatKey[] = Object.keys(DATE_FORMAT_LABELS) as DateFormatKey[];
  const currentFormatKey = (currentFormat || "DD/MM/YYYY") as DateFormatKey;
  const currentLabel = DATE_FORMAT_LABELS[currentFormatKey] || DATE_FORMAT_LABELS["DD/MM/YYYY"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
          disabled={isSaving}
        >
          {isSaving ? (t("saving") || "Saving...") : currentLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" align="end">
        {formatOptions.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={async () => {
              if (format === currentFormatKey) return;
              setIsSaving(true);
              try {
                await onFormatChange(format);
              } catch (error) {
                logger.error("Failed to update date format:", error);
              } finally {
                setIsSaving(false);
              }
            }}
            className={currentFormatKey === format ? "bg-accent" : ""}
          >
            {DATE_FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimeFormatPreferenceSelect({
  currentFormat,
  onFormatChange,
}: {
  currentFormat: string | undefined;
  onFormatChange: (format: string) => Promise<void>;
}) {
  const [isSaving, setIsSaving] = React.useState(false);
  const t = useTranslations("common");

  const formatOptions: TimeFormatKey[] = Object.keys(TIME_FORMAT_LABELS) as TimeFormatKey[];
  const currentFormatKey = (currentFormat || "24h") as TimeFormatKey;
  const currentLabel = TIME_FORMAT_LABELS[currentFormatKey] || TIME_FORMAT_LABELS["24h"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
          disabled={isSaving}
        >
          {isSaving ? (t("saving") || "Saving...") : currentLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="end">
        {formatOptions.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={async () => {
              if (format === currentFormatKey) return;
              setIsSaving(true);
              try {
                await onFormatChange(format);
              } catch (error) {
                logger.error("Failed to update time format:", error);
              } finally {
                setIsSaving(false);
              }
            }}
            className={currentFormatKey === format ? "bg-accent" : ""}
          >
            {TIME_FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TimezonePreferenceSelect({ 
  currentTimezone, 
  onTimezoneChange 
}: { 
  currentTimezone: string | undefined
  onTimezoneChange: (timezone: string) => Promise<void>
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState<string>(currentTimezone || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const t = useTranslations("common")

  React.useEffect(() => {
    setValue(currentTimezone || "")
  }, [currentTimezone])

  // Fetch supported timezones
  const timezones = React.useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Istanbul', 'Asia/Tokyo']
    }
  }, [])

  const formattedTimezones = React.useMemo(() => {
    return timezones
      .map(timezone => {
        try {
          const formatter = new Intl.DateTimeFormat('en', {
            timeZone: timezone,
            timeZoneName: 'shortOffset'
          })
          const parts = formatter.formatToParts(new Date())
          const offset = parts.find(part => part.type === 'timeZoneName')?.value || ''
          const formattedOffset = offset === 'GMT' ? 'GMT+0' : offset
          return {
            value: timezone,
            label: `(${formattedOffset}) ${timezone.replace(/_/g, ' ')}`,
            numericOffset: parseInt(formattedOffset.replace('GMT', '').replace('+', '') || '0')
          }
        } catch {
          return {
            value: timezone,
            label: timezone.replace(/_/g, ' '),
            numericOffset: 0
          }
        }
      })
      .sort((a, b) => a.numericOffset - b.numericOffset) // Sort by numeric offset
  }, [timezones])

  const defaultTimezone = formattedTimezones.find(tz => tz.value === 'UTC') || formattedTimezones.find(tz => tz.value.toLowerCase().includes('utc')) || { label: '(GMT+0) UTC', value: 'UTC' }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors w-fit"
          disabled={isSaving}
        >
          <span>
            {isSaving ? (t("saving") || "Saving...") : (
              value ? (
                formattedTimezones.find(timezone => timezone.value === value)?.label
              ) : (
                defaultTimezone.label
              )
            )}
          </span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground/80 shrink-0 ml-1.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popper-anchor-width] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {formattedTimezones.map(({ value: itemValue, label }) => (
                <CommandItem
                  key={itemValue}
                  value={`${itemValue} ${label}`}
                  onSelect={async () => {
                    if (itemValue === value) {
                      setOpen(false)
                      return
                    }
                    setIsSaving(true)
                    try {
                      await onTimezoneChange(itemValue)
                      setValue(itemValue)
                      setOpen(false)
                    } catch (error) {
                      logger.error("Failed to update timezone:", error)
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                >
                  <span className="truncate">{label}</span>
                  {value === itemValue && <CheckIcon size={16} className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CookieSettingsPopover() {
  const [open, setOpen] = React.useState(false)
  const [accepted, setAccepted] = React.useState(false)
  const t = useTranslations("common")
  const { toast } = useToast()

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-[180px]">
          {t("settings.account.preferencesGroup.cookieSettings") || "Cookie Settings"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[300px] p-4">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">
              {t("settings.account.preferencesGroup.cookieSettings") || "Cookie Settings"}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t("settings.account.preferencesGroup.cookieSettingsDescription") || "Manage your cookie preferences."}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {t("settings.account.preferencesGroup.cookieAccepted") || "I accept cookies"}
            </span>
            <Switch
              checked={accepted}
              onCheckedChange={setAccepted}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // Save cookie preference
                setOpen(false)
                toast({
                  title: t("settings.account.preferencesGroup.cookieSettings") || "Cookie Settings",
                  description: t("settings.account.preferencesGroup.cookieSettingsSaved") || "Cookie preferences saved.",
                })
              }}
            >
              {t("save") || "Save"}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SettingsDialog({ children, defaultActiveItem }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [activeItem, setActiveItem] = React.useState<string | null>(defaultActiveItem ?? null)
  const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false)
  const [membersTableRefresh, setMembersTableRefresh] = React.useState(0)
  const [membersCount, setMembersCount] = React.useState<number>(0)
  const [isMobile, setIsMobile] = React.useState(false)
  const [disconnectGoogleDialogOpen, setDisconnectGoogleDialogOpen] = React.useState(false)
  const t = useTranslations("common")
  const pathname = usePathname()
  const { user: authUser, login } = useAuth()
  const [profileUser, setProfileUser] = React.useState<UserProfile | null>(null)
  const [usernameManuallyEdited, setUsernameManuallyEdited] = React.useState(false)
  const [usernameAvailability, setUsernameAvailability] = React.useState<boolean | null>(null)
  const [isCheckingUsername, setIsCheckingUsername] = React.useState(false)
  const usernameCheckTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  const userProfileSchema = z.object({
    name: z.string().min(1, "Name is required"),
    username: z.string().min(1, "Username is required").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
  })

  const [hasPassword, setHasPassword] = React.useState(false) // Static: false for now
  const [originalName, setOriginalName] = React.useState<string>("")
  const [isSavingName, setIsSavingName] = React.useState(false)
  const [originalUsername, setOriginalUsername] = React.useState<string>("")
  const [isSavingUsername, setIsSavingUsername] = React.useState(false)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false)
  const [mediaConfig, setMediaConfig] = React.useState<MediaConfig | null>(null)
  const [cropDialogOpen, setCropDialogOpen] = React.useState(false)
  const [selectedAvatarFile, setSelectedAvatarFile] = React.useState<File | null>(null)
  const [avatarImageSrc, setAvatarImageSrc] = React.useState<string | null>(null)
  const [isCropApplied, setIsCropApplied] = React.useState(false)
  const [cropState, setCropState] = React.useState({ x: 0, y: 0 })
  const [zoomState, setZoomState] = React.useState(1)
  const [rotationState, setRotationState] = React.useState(0)
  const [lastCropArea, setLastCropArea] = React.useState<CropperAreaData | null>(null)
  const [shouldApplyCrop, setShouldApplyCrop] = React.useState(false)
  const avatarFileInputRef = React.useRef<HTMLInputElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const { workspace, workspaceReady } = useWorkspace()
  const [isGoogleActionLoading, setIsGoogleActionLoading] = React.useState(false)
  const hasWorkspaceSettingsManage = useHasPermission(PERMISSIONS.WORKSPACE_SETTINGS_MANAGE)

  type UserProfileFormData = z.infer<typeof userProfileSchema>

  const form = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      phone: "",
    },
  })

  const watchedName = form.watch("name")
  const watchedUsername = form.watch("username")
  const googleConnected = !!((profileUser?.googleId ?? authUser?.googleId))
  
  // Track if name has changed
  const nameHasChanged = watchedName !== originalName && watchedName.trim() !== ""
  
  // Track if username has changed
  const usernameHasChanged = watchedUsername !== originalUsername && watchedUsername.trim() !== ""

  // Check if mobile
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Filter nav groups to exclude workspace group if user doesn't have workspace:settings.manage permission
  const visibleNavGroups = React.useMemo(() => {
    return navGroups.filter((group) => {
      if (group.id === "brand") {
        return false // Brand group removed
      }
      if (group.id === "workspace") {
        return hasWorkspaceSettingsManage
      }
      return true
    })
  }, [hasWorkspaceSettingsManage])

  // Load media config when dialog opens (used across multiple tabs)
  // Optimized: Check cache first, only fetch if not cached or stale
  React.useEffect(() => {
    if (open && !mediaConfig) {
      // Check cache first (5 minute TTL)
      const cachedConfig = apiCache.get<MediaConfig>("media:config", 300000)
      if (cachedConfig) {
        setMediaConfig(cachedConfig)
        return
      }

      // Only fetch if not in cache
      getMediaConfig()
        .then((config) => {
          setMediaConfig(config)
        })
        .catch((error) => {
          logger.error("Failed to load media config:", error)
          // Continue with default values if config fails to load
        })
    }
  }, [open, mediaConfig])

  React.useEffect(() => {
    if (!authUser) {
      setProfileUser(null)
      return
    }

    // Don't load if dialog is closed
    if (!open) {
      return
    }

    let cancelled = false

    const loadProfile = async () => {
      try {
        // Optimized: Check cache first (60 second TTL for user profile)
        // This prevents unnecessary /auth/me requests when dialog is reopened
        let profile: UserProfile | null = apiCache.get<UserProfile>("user:profile", 60000) ?? null
        
        // If cache is fresh, use it directly
        if (profile) {
          if (cancelled) return
          
          setProfileUser(profile)
          const nameValue = profile.name || ""
          const usernameValue = profile.username || ""
          setOriginalName(nameValue)
          setOriginalUsername(usernameValue)
          form.reset({
            name: nameValue,
            username: usernameValue,
            email: profile.email,
            phone: profile.phone || "",
          })
          if (profile.username) {
            setUsernameManuallyEdited(true)
          }
          return
        }
        
        // Cache miss or stale: fetch from session (this will populate cache)
        const session = await getCurrentSession()
        if (cancelled || !session) return
        
        // Read from cache again (getCurrentSession populates it)
        profile = apiCache.get<UserProfile>("user:profile", 60000) ?? null
        
        if (cancelled || !profile) {
          // Fallback to auth user data
          form.reset({
            name: authUser.name || "",
            username: "",
            email: authUser.email,
            phone: "",
          })
          return
        }

        setProfileUser(profile)
        const nameValue = profile.name || ""
        const usernameValue = profile.username || ""
        setOriginalName(nameValue)
        setOriginalUsername(usernameValue)
        form.reset({
          name: nameValue,
          username: usernameValue,
          email: profile.email,
          phone: profile.phone || "",
        })
        if (profile.username) {
          setUsernameManuallyEdited(true)
        }
      } catch (error) {
        if (!cancelled) {
          // Fallback to auth user data
          form.reset({
            name: authUser.name || "",
            username: "",
            email: authUser.email,
            phone: "",
          })
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [authUser, form, open])

  // Generate username from name (only if username hasn't been manually edited)
  React.useEffect(() => {
    if (watchedName && !usernameManuallyEdited && activeItem === "userProfile") {
      const generatedUsername = watchedName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
      form.setValue("username", generatedUsername)
    }
  }, [watchedName, usernameManuallyEdited, form, activeItem])

  // Check username availability when it changes
  React.useEffect(() => {
    if (activeItem !== "userProfile") return

    // Clear previous timeout
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current)
    }

    // Don't check if username is empty
    if (!watchedUsername?.trim()) {
      setUsernameAvailability(null)
      return
    }

    // Don't check if it's the same as current profile username
    if (profileUser?.username === watchedUsername.trim().toLowerCase()) {
      setUsernameAvailability(true)
      return
    }

    // Debounce username check
    setIsCheckingUsername(true)
    let cancelled = false
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(watchedUsername.trim().toLowerCase())
        if (!cancelled) {
          setUsernameAvailability(available)
          setIsCheckingUsername(false)
        }
      } catch (error) {
        if (!cancelled) {
          // Silently handle 401 errors - user might not be authenticated
          if (error instanceof Error && error.message.includes("401")) {
            setUsernameAvailability(null)
            setIsCheckingUsername(false)
            return
          }
          logger.error("Error checking username availability:", error)
          setUsernameAvailability(null)
          setIsCheckingUsername(false)
        }
      }
    }, 500)

    return () => {
      cancelled = true
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current)
      }
    }

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current)
      }
    }
  }, [watchedUsername, profileUser, activeItem])

  const handleSaveName = async () => {
    const currentName = watchedName.trim()
    if (!currentName) {
      toast({
        title: t("error") || "Error",
        description: t("fullName") + " " + (t("required") || "is required"),
        variant: "destructive",
      })
      return
    }

    setIsSavingName(true)
    try {
      const updated = await updateUserProfile({
        name: currentName,
      })

      setProfileUser(updated)
      setOriginalName(currentName)
      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("profileUpdatedDescription") || "Your profile has been updated successfully.",
      })
    } catch (err) {
      toast({
        title: t("error") || "Error",
        description: err instanceof Error ? err.message : t("profileUpdateError") || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSavingName(false)
    }
  }

  const handleSaveUsername = async () => {
    const currentUsername = watchedUsername.trim().toLowerCase()
    if (!currentUsername) {
      toast({
        title: t("error") || "Error",
        description: t("username") + " " + (t("required") || "is required"),
        variant: "destructive",
      })
      return
    }

    // Validate username availability before saving
    if (usernameAvailability === false) {
      toast({
        title: t("error") || "Error",
        description: t("usernameTaken") || "This username is already taken. Please choose a different one.",
        variant: "destructive",
      })
      return
    }

    setIsSavingUsername(true)
    try {
      const updated = await updateUserProfile({
        username: currentUsername,
      })

      setProfileUser(updated)
      setOriginalUsername(currentUsername)
      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("profileUpdatedDescription") || "Your profile has been updated successfully.",
      })
    } catch (err) {
      toast({
        title: t("error") || "Error",
        description: err instanceof Error ? err.message : t("profileUpdateError") || "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSavingUsername(false)
    }
  }

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Get limits from media config (default to 5MB per media-config.md if config not loaded)
    const avatarLimits = mediaConfig?.assets?.avatar?.limits
    const maxSizeBytes = avatarLimits?.maxFileSizeBytes || 5242880 // 5MB
    const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024))
    const allowedExtensions = avatarLimits?.allowedExtensions || ["jpg", "jpeg", "png", "webp"]
    const allowedMimeTypes = avatarLimits?.allowedMimeTypes || ["image/jpeg", "image/png", "image/webp"]

    // Check file size
    if (file.size > maxSizeBytes) {
      toast({
        title: t("error") || "Error",
        description: t("settings.account.avatarSizeError") || `File size exceeds ${maxSizeMB}MB limit`,
        variant: "destructive",
      })
      return
    }

    // Check file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase()
    if (fileExtension && !allowedExtensions.includes(fileExtension)) {
      toast({
        title: t("error") || "Error",
        description: t("settings.account.avatarExtensionError") || `File extension not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      toast({
        title: t("error") || "Error",
        description: t("settings.account.avatarMimeTypeError") || `File type not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Set file and open crop dialog
    setSelectedAvatarFile(file)
    setAvatarPreview(null)
    setIsCropApplied(false)
    setCropState({ x: 0, y: 0 })
    setZoomState(1)
    setRotationState(0)
    
    // Read file as data URL for cropper
    const reader = new FileReader()
    reader.onload = (event) => {
      setAvatarImageSrc(event.target?.result as string)
    setCropDialogOpen(true)
  }
    reader.readAsDataURL(file)
  }

  const handleCropUpload = React.useCallback(async (croppedDataUrl: string, croppedFile: File) => {
    // Set preview
    setAvatarPreview(croppedDataUrl)
    setIsCropApplied(true)
    setCropDialogOpen(false)

    // Upload avatar
    if (!workspaceReady || !workspace?.id) {
      toast({
        title: t("error") || "Error",
        description: t("settings.account.workspaceRequired") || "Workspace is required to upload avatar",
        variant: "destructive",
      })
      return
    }

    setIsUploadingAvatar(true)
    try {
      const presign = await presignUpload({
        workspaceId: workspace.id,
        fileName: croppedFile.name,
        contentType: croppedFile.type,
        sizeBytes: croppedFile.size,
        assetType: "avatar",
      })

      await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": croppedFile.type,
        },
        body: croppedFile,
      })

      const finalize = await finalizeUpload({
        objectKey: presign.objectKey,
        workspaceId: workspace.id,
        originalName: croppedFile.name,
        contentType: croppedFile.type,
        assetType: "avatar",
      })

      // Update user profile with avatarMediaId
      const updated = await updateUserProfile({
        avatarMediaId: finalize.media.id,
      })

      setProfileUser(updated)
      setAvatarPreview(null) // Clear preview after successful upload
      setSelectedAvatarFile(null)
      setAvatarImageSrc(null)
      setIsCropApplied(false)
      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("settings.account.avatarUploaded") || "Avatar uploaded successfully.",
      })
    } catch (err) {
      logger.error("Failed to upload avatar:", err)
      toast({
        title: t("error") || "Error",
        description: err instanceof Error ? err.message : t("settings.account.avatarUploadError") || "Failed to upload avatar",
        variant: "destructive",
      })
      setAvatarPreview(null)
      setSelectedAvatarFile(null)
      setAvatarImageSrc(null)
      setIsCropApplied(false)
    } finally {
      setIsUploadingAvatar(false)
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = ""
      }
    }
  }, [workspaceReady, workspace?.id, toast, t])

  const processCrop = React.useCallback((croppedAreaPixels: CropperAreaData) => {
    if (!avatarImageSrc || !canvasRef.current) return

    // Create image from source
    const image = new window.Image()
    image.src = avatarImageSrc
    image.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = croppedAreaPixels.width
      canvas.height = croppedAreaPixels.height

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Draw cropped portion
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      )

      const croppedDataUrl = canvas.toDataURL("image/png")
      
      // Convert cropped data URL to File
      fetch(croppedDataUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const croppedFile = new File([blob], "avatar.png", { type: "image/png" })
          handleCropUpload(croppedDataUrl, croppedFile)
        })
        .catch((error) => {
          logger.error("Failed to process cropped image:", error)
          toast({
            title: t("error") || "Error",
            description: t("settings.account.avatarCropError") || "Failed to process cropped image",
            variant: "destructive",
          })
        })
    }
  }, [avatarImageSrc, handleCropUpload, toast, t])

  const handleCropAreaChange = React.useCallback((
    croppedAreaPercentages: CropperAreaData,
    croppedAreaPixels: CropperAreaData,
  ) => {
    setLastCropArea(croppedAreaPixels)
    
    // If apply button was clicked, process the crop
    if (shouldApplyCrop && croppedAreaPixels) {
      setShouldApplyCrop(false)
      processCrop(croppedAreaPixels)
    }
  }, [shouldApplyCrop, processCrop])

  const handleCropComplete = React.useCallback((
    croppedAreaPercentages: CropperAreaData,
    croppedAreaPixels: CropperAreaData,
  ) => {
    setLastCropArea(croppedAreaPixels)
    
    // Only auto-process if apply button was clicked
    if (shouldApplyCrop) {
      setShouldApplyCrop(false)
      processCrop(croppedAreaPixels)
    }
  }, [shouldApplyCrop, processCrop])


  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true)
    try {
      const updated = await updateUserProfile({
        avatarMediaId: null,
      })

      setProfileUser(updated)
      setAvatarPreview(null)
      
      // Refresh session to update auth context
      const session = await getCurrentSession()
      if (session) {
        const tokenResult = await refreshToken()
        const allWorkspaces = [
          ...session.ownerWorkspaces,
          ...session.memberWorkspaces,
        ].map((w) => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
        }))
        
        await login({
          user: session.user,
          workspaces: allWorkspaces,
          accessToken: tokenResult.accessToken,
        })
      }

      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("settings.account.avatarRemoved") || "Avatar removed successfully.",
      })
    } catch (err) {
      toast({
        title: t("error") || "Error",
        description: err instanceof Error ? err.message : t("settings.account.avatarRemoveError") || "Failed to remove avatar",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const triggerAvatarFileInput = () => {
    avatarFileInputRef.current?.click()
  }

  const onSubmit = async (data: UserProfileFormData) => {
    // Validate username availability before submitting
    if (usernameAvailability === false) {
      toast({
        title: t("error") || "Error",
        description: t("usernameTaken") || "This username is already taken. Please choose a different one.",
        variant: "destructive",
      })
      return
    }

    try {
      const updated = await updateUserProfile({
        name: data.name,
        username: data.username.trim().toLowerCase(),
        phone: data.phone || null,
      })

      setProfileUser(updated)
      setOriginalName(data.name)
      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("profileUpdatedDescription") || "Your profile has been updated successfully.",
      })
    } catch (err) {
      toast({
        title: t("error") || "Error",
        description: err instanceof Error ? err.message : t("profileUpdateError") || "Failed to update profile",
        variant: "destructive",
      })
    }
  }

  // Extract primitive values to use as dependencies - prevents re-renders when profileUser object reference changes
  const profileUserName = profileUser?.name ?? null;
  const profileUserEmail = profileUser?.email ?? "";
  const profileUserAvatarUrl = profileUser?.avatarUrl ?? null;
  const authUserName = authUser?.name ?? null;
  const authUserEmail = authUser?.email ?? "";

  // Memoize user object - only recreate when name, email, or avatarUrl changes
  // This prevents unnecessary re-renders when other profile fields (like timezone) change
  const user = React.useMemo(() => {
    if (profileUser) {
      return {
        name: profileUserName,
        email: profileUserEmail,
        avatarUrl: profileUserAvatarUrl,
      };
    }
    if (authUser) {
      return {
        name: authUserName,
        email: authUserEmail,
        avatarUrl: null,
      };
    }
    return null;
  }, [profileUserName, profileUserEmail, profileUserAvatarUrl, authUserName, authUserEmail]);

  // Memoize initials and displayName to prevent unnecessary recalculations
  const initials = React.useMemo(() => {
    return user ? getInitials(user.name, user.email) : "";
  }, [user?.name, user?.email]);

  const displayName = React.useMemo(() => {
    return user?.name || user?.email || "";
  }, [user?.name, user?.email]);

  // Flatten all navigation items for mobile select
  const allNavItems = React.useMemo(() => {
    const items: Array<{ id: string; translationKey: string; groupId: string; groupName: string }> = []
    visibleNavGroups.forEach((group) => {
      group.items.forEach((item) => {
        items.push({
          id: item.id,
          translationKey: item.translationKey,
          groupId: group.id,
          groupName: group.translationKey,
        })
      })
    })
    return items
  }, [visibleNavGroups])

  const selectedNavItem = allNavItems.find((item) => item.id === activeItem)

  // Memoize click handlers to prevent unnecessary re-renders
  const handleUserProfileClick = React.useCallback(() => {
    setActiveItem("userProfile");
  }, []);

  const handleNavItemClick = React.useCallback((itemId: string) => {
    setActiveItem(itemId);
  }, []);

  // Update activeItem when dialog opens and defaultActiveItem is provided
  React.useEffect(() => {
    if (open && defaultActiveItem) {
      setActiveItem(defaultActiveItem)
    }
  }, [open, defaultActiveItem])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="overflow-hidden p-0 w-screen h-screen md:w-[70vw] md:h-[85vh] max-w-none sm:max-w-none" showCloseButton={!isMobile}>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your settings here.
        </DialogDescription>
        <SidebarProvider className="items-start h-full">
          <Sidebar collapsible="none" className="hidden md:flex h-full">
            <SidebarContent className="overflow-y-auto h-full pb-45">
              {visibleNavGroups.map((group) => (
                <SidebarGroup key={group.id}>
                  <SidebarGroupLabel>
                    {t(group.translationKey)}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        // Special rendering for User Profile item
                        if (item.id === "userProfile" && user) {
                          return (
                            <UserProfileMenuItem
                              key={item.id}
                              user={user}
                              initials={initials}
                              displayName={displayName}
                              isActive={activeItem === item.id}
                              onItemClick={handleUserProfileClick}
                            />
                          )
                        }
                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              asChild
                              isActive={activeItem === item.id}
                              onClick={() => handleNavItemClick(item.id)}
                            >
                              <a href="#">
                                <item.icon />
                                <span>{t(item.translationKey)}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
          {/* Tab content burada başlıyor */}
          <main className="flex h-full flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-4 px-4 w-full">
                {isMobile ? (
                  <>
                    <Select
                      value={activeItem || ""}
                      onValueChange={(value) => setActiveItem(value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("settings.title")}>
                          {selectedNavItem ? t(selectedNavItem.translationKey) : t("settings.title")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {visibleNavGroups.map((group) => (
                          <SelectGroup key={group.id}>
                            <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {t(group.translationKey)}
                            </SelectLabel>
                            {group.items.map((item) => {
                              // Skip userProfile in select as it's special
                              if (item.id === "userProfile") return null
                              return (
                                <SelectItem key={item.id} value={item.id} className="pl-6">
                                  <div className="flex items-center gap-2">
                                    <item.icon className="h-4 w-4" />
                                    <span>{t(item.translationKey)}</span>
                                  </div>
                                </SelectItem>
                              )
                            })}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <DialogClose asChild>
                      <button className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                      </button>
                    </DialogClose>
                  </>
                ) : (
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">{t("settings.title")}</BreadcrumbLink>
                    </BreadcrumbItem>
                    {activeItem && (() => {
                      const group = visibleNavGroups.find((g) =>
                        g.items.some((item) => item.id === activeItem)
                      )
                      const item = group?.items.find((item) => item.id === activeItem)
                      if (!group || !item) return null
                      return (
                        <>
                          <BreadcrumbSeparator className="hidden md:block" />
                          <BreadcrumbItem>
                            <BreadcrumbPage>{t(item.translationKey)}</BreadcrumbPage>
                          </BreadcrumbItem>
                        </>
                      )
                    })()}
                  </BreadcrumbList>
                </Breadcrumb>
                )}
              </div>
            </header>
            {/* Tab content burada başlıyor */}
            {activeItem === "userProfile" ? (
              <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4 pt-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
                    {/* Account Section */}
                    <div className="space-y-6">
                      <h2 className="text-base font-semibold text-foreground">
                        {t("settings.account.account") || "Account"}
                      </h2>
                      
                      {/* Avatar and Preferred Name */}
                      <div className="flex items-start gap-6">
                        <div className="flex flex-col items-center">
                          <div className="relative mb-2">
                            <Avatar className="h-24 w-24 border-2 border-muted rounded-full">
                              <AvatarImage src={avatarPreview || user?.avatarUrl || undefined} alt={displayName} />
                              <AvatarFallback className="rounded-full">
                                <UserRoundIcon
                                  size={52}
                                  className="text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </AvatarFallback>
                            </Avatar>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute -top-0.5 -right-0.5 bg-accent rounded-full border-[3px] border-background h-8 w-8 hover:bg-accent"
                              onClick={() => {
                                if (avatarPreview || user?.avatarUrl) {
                                  handleRemoveAvatar()
                                } else {
                                  triggerAvatarFileInput()
                                }
                              }}
                              disabled={isUploadingAvatar}
                            >
                              {avatarPreview || user?.avatarUrl ? (
                                <X className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Plus className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="sr-only">
                                {avatarPreview || user?.avatarUrl
                                  ? (t("settings.account.removeAvatar") || "Remove avatar")
                                  : (t("settings.account.uploadAvatar") || "Upload avatar")
                                }
                              </span>
                            </Button>
                          </div>
                          {!(avatarPreview || user?.avatarUrl) && (
                            <>
                              <p className="text-center font-medium text-sm">
                                {t("settings.account.uploadImage") || "Upload Image"}
                              </p>
                              <p className="text-center text-xs text-muted-foreground">
                                {t("settings.account.maxFileSize") || "Max file size: "}{mediaConfig?.assets?.avatar?.limits?.maxFileSizeBytes ? Math.round(mediaConfig.assets.avatar.limits.maxFileSizeBytes / (1024 * 1024)) : 5}MB
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={triggerAvatarFileInput}
                                disabled={isUploadingAvatar}
                              >
                                {t("settings.account.addImage") || "Add Image"}
                              </Button>
                            </>
                          )}
                          <input
                            type="file"
                            ref={avatarFileInputRef}
                            onChange={handleAvatarFileChange}
                            accept="image/*"
                            className="hidden"
                          />
                        </div>
                        <div className="flex-1 space-y-6">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <div>
                                <Label
                                  htmlFor="name"
                                  className="text-sm font-medium text-foreground mb-1.5 block"
                                >
                                  {t("settings.account.preferredName") || "Preferred name"}
                                </Label>
                                <FormControl>
                                  <InputGroup className="max-w-md">
                                    <InputGroupInput
                                      {...field}
                                      id="name"
                                      placeholder={t("fullNamePlaceholder")}
                                      disabled={form.formState.isSubmitting || isSavingName}
                                    />
                                    {nameHasChanged && (
                                      <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                          onClick={(e) => {
                                            e.preventDefault()
                                            handleSaveName()
                                          }}
                                          disabled={isSavingName}
                                          variant="secondary"
                                        >
                                          {isSavingName ? t("saving") : t("save")}
                                        </InputGroupButton>
                                      </InputGroupAddon>
                                    )}
                                  </InputGroup>
                                </FormControl>
                                <FormMessage />
                              </div>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                              <div>
                                <Label
                                  htmlFor="username"
                                  className="text-sm font-medium text-foreground block mb-1.5"
                                >
                                  {t("username")}
                                </Label>
                                <FormControl>
                                  <InputGroup
                                    className={`max-w-md ${usernameHasChanged && watchedUsername?.trim() && usernameAvailability !== null
                                      ? (usernameAvailability
                                          ? "border-green-500 has-[[data-slot=input-group-control]:focus-visible]:border-green-500"
                                          : "border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive")
                                      : ""
                                    }`}
                                  >
                                    <InputGroupAddon align="inline-start">
                                      <span>@</span>
                                    </InputGroupAddon>
                                    <InputGroupInput
                                      {...field}
                                      id="username"
                                      onChange={(e) => {
                                        setUsernameManuallyEdited(true)
                                        field.onChange(e)
                                      }}
                                      placeholder={t("usernamePlaceholder")}
                                      disabled={form.formState.isSubmitting || isSavingUsername}
                                    />
                                    {usernameHasChanged && (
                                      <InputGroupAddon align="inline-end">
                                        <InputGroupButton
                                          onClick={(e) => {
                                            e.preventDefault()
                                            handleSaveUsername()
                                          }}
                                          disabled={isSavingUsername || usernameAvailability === false}
                                          variant="secondary"
                                        >
                                          {isSavingUsername ? t("saving") : t("save")}
                                        </InputGroupButton>
                                      </InputGroupAddon>
                                    )}
                                  </InputGroup>
                                </FormControl>
                                {usernameHasChanged && watchedUsername?.trim() && usernameAvailability !== null && (
                                  <p className={`mt-1.5 text-xs ${usernameAvailability ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                                    <span className="inline-flex items-center gap-1.5">
                                      {usernameAvailability ? (
                                        <>
                                          <CheckCircle2 className="size-3.5" />
                                          <span>{t("usernameAvailable")}</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="size-3.5" />
                                          <span>{t("usernameTaken")}</span>
                                        </>
                                      )}
                                    </span>
                                  </p>
                                )}
                                {(!usernameHasChanged || !watchedUsername?.trim() || usernameAvailability === null) && (
                                  <p className="mt-1.5 text-xs text-muted-foreground">
                                    {t("usernameDescription")}
                                  </p>
                                )}
                                <FormMessage />
                              </div>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator className="my-8" />

                    {/* Account security Section */}
                    <div className="space-y-6">
                      <h2 className="text-base font-semibold text-foreground">
                        {t("settings.account.accountSecurity") || "Account security"}
                      </h2>
                      
                      <div className="space-y-6">
                        {/* Email */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-foreground block mb-1">
                              {t("email")}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {form.watch("email") || user?.email}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              toast({
                                title: t("settings.account.changeEmail") || "Change email",
                                description: t("settings.account.changeEmailDescription") || "Email değiştirme özelliği yakında eklenecek",
                              })
                            }}
                          >
                            {t("settings.account.changeEmail") || "Change email"}
                          </Button>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-foreground block mb-1">
                              {t("settings.account.password") || "Password"}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t("settings.account.passwordDescription") || "Change your password to login to your account."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            disabled
                          >
                            {t("comingSoon") || "Yakında"}
                          </Button>
                        </div>

                        {/* 2-step verification */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <Label className="text-sm font-medium text-foreground block mb-1">
                              {t("settings.account.twoStepVerification") || "2-step verification"}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t("settings.account.twoStepVerificationDescription") || "Add an additional layer of security to your account during login."}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            disabled
                          >
                            {t("comingSoon") || "Yakında"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop-only bottom spacing */}
                    <div className="hidden md:block h-[45px]" />
                  </form>
                </Form>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-4 pt-0">
                {activeItem === "people" ? (
                 <div className="flex flex-col gap-4 md:gap-6">
                   {/* Invite block - mobile friendly */}
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 rounded-lg border p-3 md:p-4 w-full">
                     <div className="flex flex-col gap-1 md:gap-2 flex-1 min-w-0">
                       <div className="font-medium text-sm md:text-base w-full break-words">{t("settings.workspace.people.inviteLinkTitle")}</div>
                       <p className="text-xs md:text-sm text-muted-foreground w-full break-words">
                         {t("settings.workspace.people.inviteLinkDescription")}
                       </p>
                     </div>
                     <Button onClick={() => setInviteDialogOpen(true)} className="w-full md:w-auto shrink-0">
                       {t("settings.workspace.people.inviteButton")}
                     </Button>
                   </div>
                  <Tabs defaultValue="members" className="w-full">
                    <TabsHighlight className="bg-background absolute z-0 inset-0 rounded-md">
                      <TabsList className="h-10 inline-flex p-1 bg-accent w-full rounded-lg">
                        <TabsHighlightItem value="members" className="flex-1">
                          <TabsTrigger
                            value="members"
                            className="h-full px-4 py-2 leading-0 w-full text-sm inline-flex items-center justify-center gap-2"
                          >
                            <span>{t("settings.workspace.people.tabs.members")}</span>
                            {membersCount > 0 && (
                              <Badge variant="secondary">
                                {membersCount}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </TabsHighlightItem>
                        <TabsHighlightItem value="contact" className="flex-1">
                          <TabsTrigger
                            value="contact"
                            className="h-full px-4 py-2 leading-0 w-full text-sm"
                          >
                            {t("settings.workspace.people.tabs.contact")}
                          </TabsTrigger>
                        </TabsHighlightItem>
                      </TabsList>
                    </TabsHighlight>
                    <TabsContents className="mt-3">
                      <TabsContent value="members">
                        <WorkspaceMembersTable 
                          refreshTrigger={membersTableRefresh} 
                          onCountChange={setMembersCount}
                        />
                      </TabsContent>
                      <TabsContent value="contact">
                        <div className="flex items-center justify-center py-8">
                          <span className="text-muted-foreground">{t("settings.workspace.people.contactContentComingSoon")}</span>
                        </div>
                      </TabsContent>
                    </TabsContents>
                  </Tabs>
                </div>
              ) : activeItem === "tasks" ? (
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">
                      Task Statuses
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage task statuses that will be available across all brands in this workspace.
                    </p>
                  </div>
                  <WorkspaceTaskStatusesManager />
                </div>
              ) : activeItem === "preferences" ? (
                <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-4 pt-0 gap-6">
                  {/* Preferences Group */}
                  <div className="space-y-6">
                    <h2 className="text-base font-semibold text-foreground">
                      {t("settings.account.preferences") || "Preferences"}
                    </h2>
                    
                    {/* Theme */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground block mb-1">
                          {t("settings.account.preferencesTheme") || "Theme"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.account.preferencesThemeDescription") || "Choose your preferred theme for the application."}
                        </p>
                      </div>
                      <ThemePreferenceSelect />
                    </div>
                  </div>

                  {/* Language & Region Group */}
                  <div className="space-y-6">
                    <h2 className="text-base font-semibold text-foreground">
                      {t("settings.account.preferencesGroup.languageRegion") || "Language & Region"}
                    </h2>
                    
                    {/* Language */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground block mb-1">
                          {t("settings.account.preferencesGroup.language") || "Language"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.account.preferencesGroup.languageDescription") || "Choose your preferred language."}
                        </p>
                      </div>
                      <LanguagePreferenceSelect 
                        currentLocale={profileUser?.locale}
                        onLocaleChange={async (locale: string) => {
                          const updated = await updateUserProfile({ locale })
                          // Only update locale field, preserve other fields to prevent unnecessary re-renders
                          setProfileUser((prev) => prev ? { ...prev, locale: updated.locale } : updated)
                          toast({
                            title: t("settings.account.preferencesGroup.language") || "Language",
                            description: t("settings.account.preferencesGroup.languageUpdated") || "Language preference updated.",
                          })
                        }}
                        onBeforeNavigate={() => {
                          // Close dialog before navigation to prevent overlay from staying
                          setOpen(false)
                        }}
                      />
                    </div>

                    {/* Timezone */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground block mb-1">
                          {t("settings.account.preferencesGroup.timezone") || "Timezone"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.account.preferencesGroup.timezoneDescription") || "Select your timezone."}
                        </p>
                      </div>
                      <TimezonePreferenceSelect 
                        currentTimezone={profileUser?.timezone}
                        onTimezoneChange={async (timezone: string) => {
                          const updated = await updateUserProfile({ timezone })
                          // Only update timezone field, preserve other fields to prevent unnecessary re-renders
                          setProfileUser((prev) => prev ? { ...prev, timezone: updated.timezone } : updated)
                          toast({
                            title: t("settings.account.preferencesGroup.timezone") || "Timezone",
                            description: t("settings.account.preferencesGroup.timezoneUpdated") || "Timezone preference updated.",
                          })
                        }}
                      />
                    </div>

                    {/* Date Format */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground block mb-1">
                          {t("settings.account.preferencesGroup.dateFormat") || "Date Format"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.account.preferencesGroup.dateFormatDescription") || "Choose how dates are displayed."}
                        </p>
                      </div>
                      <DateFormatPreferenceSelect
                        currentFormat={profileUser?.dateFormat}
                        onFormatChange={async (dateFormat: string) => {
                          const updated = await updateUserProfile({ dateFormat })
                          setProfileUser((prev) => prev ? { ...prev, dateFormat: updated.dateFormat } : updated)
                          toast({
                            title: t("settings.account.preferencesGroup.dateFormat") || "Date Format",
                            description: t("settings.account.preferencesGroup.dateFormatUpdated") || "Date format preference updated.",
                          })
                        }}
                      />
                    </div>

                    {/* Time Format */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground block mb-1">
                          {t("settings.account.preferencesGroup.timeFormat") || "Time Format"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.account.preferencesGroup.timeFormatDescription") || "Choose how times are displayed."}
                        </p>
                      </div>
                      <TimeFormatPreferenceSelect
                        currentFormat={profileUser?.timeFormat}
                        onFormatChange={async (timeFormat: string) => {
                          const updated = await updateUserProfile({ timeFormat })
                          setProfileUser((prev) => prev ? { ...prev, timeFormat: updated.timeFormat } : updated)
                          toast({
                            title: t("settings.account.preferencesGroup.timeFormat") || "Time Format",
                            description: t("settings.account.preferencesGroup.timeFormatUpdated") || "Time format preference updated.",
                          })
                        }}
                      />
                    </div>
                  </div>

                  {/* Privacy Group */}
                  <div className="space-y-6">
                    <h2 className="text-base font-semibold text-foreground">
                      {t("settings.account.preferencesGroup.privacy") || "Privacy"}
                    </h2>
                    
                    {/* Cookie Settings */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground block mb-1">
                          {t("settings.account.preferencesGroup.cookieSettings") || "Cookie Settings"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("settings.account.preferencesGroup.cookieSettingsDescription") || "Manage your cookie preferences."}
                        </p>
                      </div>
                      <CookieSettingsPopover />
                    </div>
                  </div>
                </div>
              ) : activeItem === "connections" ? (
                <div className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">
                      {t("settings.account.connections.title") || "Connected Accounts"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.account.connections.description") || "Manage your connected accounts and services."}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <ConnectionCard
                      icon="/assets/google-original.svg"
                      title={t("settings.account.connections.google.title") || "Google"}
                      description={t("settings.account.connections.google.description") || "Connect your Google account to sign in and access Google services."}
                      buttonText={
                        googleConnected
                          ? (isGoogleActionLoading ? "Disconnecting..." : (t("settings.account.connections.google.disconnect") || "Disconnect"))
                          : (isGoogleActionLoading ? "Connecting..." : (t("settings.account.connections.google.connect") || "Connect"))
                      }
                      onButtonClick={async () => {
                        if (googleConnected) {
                          setDisconnectGoogleDialogOpen(true)
                        } else {
                          setIsGoogleActionLoading(true)
                          try {
                            const url = await getGoogleOAuthUrl()
                            window.location.href = url
                          } catch (error) {
                            toast({
                              title: t("error") || "Error",
                              description: error instanceof Error ? error.message : t("settings.account.connections.google.connectDescription") || "Failed to start Google connection",
                              variant: "destructive",
                            })
                          } finally {
                            setIsGoogleActionLoading(false)
                          }
                        }
                      }}
                      connected={googleConnected}
                      disabled={isGoogleActionLoading}
                    />
                    <ConnectionCard
                      icon="/assets/telegram-original.svg"
                      title={t("settings.account.connections.telegram.title") || "Telegram"}
                      description={t("settings.account.connections.telegram.description") || "Connect your Telegram account to manage your messaging and notifications."}
                      buttonText={t("comingSoon") || "Coming soon"}
                      onButtonClick={() => {
                        toast({
                          title: t("comingSoon") || "Coming soon",
                          description: t("settings.account.connections.telegram.comingSoonDescription") || "Telegram connection feature is coming soon.",
                        })
                      }}
                      connected={false}
                      disabled={true}
                    />
                  </div>
                </div>
              ) : (
                Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted/50 aspect-video rounded-xl"
                />
                ))
              )}
              </div>
            )}
            {/* Tab content burada bitiyor */}
          </main>
          
        </SidebarProvider>
      </DialogContent>
      
      {/* Avatar Crop Dialog */}
      <Dialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          // If dialog is closed without applying crop, reset file selection
          if (!open && !isCropApplied) {
            setSelectedAvatarFile(null)
            setAvatarImageSrc(null)
            setAvatarPreview(null)
            setCropState({ x: 0, y: 0 })
            setZoomState(1)
            setRotationState(0)
            if (avatarFileInputRef.current) {
              avatarFileInputRef.current.value = ""
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[95vh] p-0 gap-0">
          {avatarImageSrc && (
            <>
              <div className="p-6 w-full">
                <DialogHeader className="mb-4">
                  <DialogTitle>{t("settings.account.cropAvatar") || "Crop Avatar"}</DialogTitle>
                  <DialogDescription>
                    {t("settings.account.cropAvatarDescription") || "Adjust the crop area for your avatar. Drag to move, scroll to zoom, use arrow keys for fine adjustment."}
                  </DialogDescription>
                </DialogHeader>
                <div className="w-full max-w-full max-h-[60vh] overflow-hidden flex items-center justify-center">
                  <div className="relative w-full max-w-md h-[400px] overflow-hidden rounded-lg border bg-muted">
                    <Cropper
                      aspectRatio={1}
                      zoom={zoomState}
                      rotation={rotationState}
                      crop={cropState}
                      onCropChange={setCropState}
                      onZoomChange={setZoomState}
                      onRotationChange={setRotationState}
                      onCropAreaChange={handleCropAreaChange}
                      onCropComplete={handleCropComplete}
                      minZoom={1}
                      maxZoom={3}
                      shape="circle"
                      withGrid
                    >
                      <CropperImage src={avatarImageSrc} alt="Crop avatar" />
                      <CropperArea />
                    </Cropper>
                  </div>
                </div>
              </div>
              <div className="p-6 pt-0 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCropState({ x: 0, y: 0 })
                    setZoomState(1)
                    setRotationState(0)
                  }}
                >
                    {t("reset") || "Reset"}
                  </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    // Use last crop area if available, otherwise trigger a crop area update
                    if (lastCropArea) {
                      processCrop(lastCropArea)
                    } else {
                      // Set flag to process on next crop area change
                      setShouldApplyCrop(true)
                      // Force a crop area update by triggering a small state change
                      setCropState((prev) => ({ ...prev }))
                    }
                  }}
                >
                    {t("settings.account.applyCrop") || "Apply crop"}
                  </Button>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Disconnect Google Dialog */}
      <Dialog open={disconnectGoogleDialogOpen} onOpenChange={setDisconnectGoogleDialogOpen}>
        <DialogContent>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <DialogHeader>
              <DialogTitle>{t("settings.account.connections.google.disconnect") || "Disconnect Google"}</DialogTitle>
              <DialogDescription>
                {t("settings.account.connections.google.disconnectConfirmDescription") || "You will need to reconnect your Google account to use Google services again."}
              </DialogDescription>
            </DialogHeader>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("settings.account.connections.google.disconnectAlert") || "To access your account again, you will need to use your email address:"} <strong>{authUser?.email || profileUser?.email}</strong>
                </AlertDescription>
              </Alert>
            </motion.div>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setDisconnectGoogleDialogOpen(false)}
                disabled={isGoogleActionLoading}
              >
                {t("cancel") || "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  setIsGoogleActionLoading(true)
                  try {
                    const updatedProfile = await disconnectGoogleConnection()
                    setProfileUser(updatedProfile)

                    const token = getAccessToken()
                    if (authUser && token) {
                      await login({
                        user: { ...authUser, googleId: null },
                        workspaces: [],
                        accessToken: token,
                      })
                    }

                    setDisconnectGoogleDialogOpen(false)
                    toast({
                      title: t("settings.account.connections.google.disconnect") || "Disconnect Google",
                      description: t("settings.account.connections.google.disconnectDescription") || "Google connection will be disconnected.",
                    })
                  } catch (error) {
                    toast({
                      title: t("error") || "Error",
                      description: error instanceof Error ? error.message : (t("settings.account.connections.google.disconnectDescription") || "Failed to disconnect Google"),
                      variant: "destructive",
                    })
                  } finally {
                    setIsGoogleActionLoading(false)
                  }
                }}
                disabled={isGoogleActionLoading}
              >
                {isGoogleActionLoading ? (t("saving") || "Disconnecting...") : (t("settings.account.connections.google.disconnect") || "Disconnect")}
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInviteSent={() => {
          setMembersTableRefresh((prev) => prev + 1)
        }}
      />
    </Dialog>
  )
}
