import {
  Bell,
  Building2,
  CreditCard,
  FileText,
  HelpCircle,
  Link2,
  Plug,
  Settings,
  Share2,
  Shield,
  Sliders,
  User,
  Users,
  Zap,
} from "lucide-react";

export type NavItem = {
  id: string;
  translationKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = {
  id: string;
  translationKey: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
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
];

