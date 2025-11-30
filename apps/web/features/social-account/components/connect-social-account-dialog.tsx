"use client";

/**
 * Connect Social Account Dialog
 * 
 * Dialog for connecting new social media accounts to a brand.
 * Supports OAuth flow for all major platforms.
 */

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { Loader2, ExternalLink, Check, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/shared/utils";
import { initiateOAuth, getOAuthAccounts, connectOAuthAccount, type SelectableAccount } from "../api/social-account-api";
import type { SocialPlatform } from "../types";
import { PLATFORM_INFO } from "../types";

// ============================================================================
// Types
// ============================================================================

type OAuthPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "LINKEDIN" | "X" | "PINTEREST" | "YOUTUBE";

interface PlatformOption {
  id: OAuthPlatform;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  enabled: boolean;
}

interface ConnectSocialAccountDialogProps {
  brandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================================================
// Platform Icons (SVG)
// ============================================================================

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(className, "dark:invert")} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={cn(className, "dark:invert")} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ============================================================================
// Platform Options
// ============================================================================

const PLATFORMS: PlatformOption[] = [
  {
    id: "FACEBOOK",
    name: "Facebook Page",
    description: "Connect your Facebook Business Page",
    icon: <FacebookIcon className="h-6 w-6" />,
    color: "#1877F2",
    bgColor: "#1877F220",
    enabled: true,
  },
  {
    id: "INSTAGRAM",
    name: "Instagram Business",
    description: "Connect your Instagram Business Account",
    icon: <InstagramIcon className="h-6 w-6" />,
    color: "#E4405F",
    bgColor: "#E4405F20",
    enabled: true,
  },
  {
    id: "YOUTUBE",
    name: "YouTube Channel",
    description: "Connect your YouTube Channel",
    icon: <YouTubeIcon className="h-6 w-6" />,
    color: "#FF0000",
    bgColor: "#FF000020",
    enabled: true,
  },
  {
    id: "TIKTOK",
    name: "TikTok Business",
    description: "Connect your TikTok Business Account",
    icon: <TikTokIcon className="h-6 w-6" />,
    color: "#000000",
    bgColor: "#00000020",
    enabled: true,
  },
  {
    id: "LINKEDIN",
    name: "LinkedIn Page",
    description: "Connect your LinkedIn Company Page",
    icon: <LinkedInIcon className="h-6 w-6" />,
    color: "#0A66C2",
    bgColor: "#0A66C220",
    enabled: true,
  },
  {
    id: "X",
    name: "X (Twitter)",
    description: "Connect your X Account",
    icon: <XIcon className="h-6 w-6" />,
    color: "#000000",
    bgColor: "#00000020",
    enabled: true,
  },
  {
    id: "PINTEREST",
    name: "Pinterest Profile",
    description: "Connect your Pinterest Business Profile",
    icon: <PinterestIcon className="h-6 w-6" />,
    color: "#E60023",
    bgColor: "#E6002320",
    enabled: true,
  },
];

// ============================================================================
// Dialog Steps
// ============================================================================

type DialogStep = "select-platform" | "oauth-redirect" | "select-account" | "connecting";

// ============================================================================
// Main Component
// ============================================================================

export function ConnectSocialAccountDialog({
  brandId,
  open,
  onOpenChange,
  onSuccess,
}: ConnectSocialAccountDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<DialogStep>("select-platform");
  const [selectedPlatform, setSelectedPlatform] = useState<OAuthPlatform | null>(null);
  const [accounts, setAccounts] = useState<SelectableAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SelectableAccount | null>(null);
  const [oauthSession, setOauthSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("select-platform");
      setSelectedPlatform(null);
      setAccounts([]);
      setSelectedAccount(null);
      setOauthSession(null);
      setError(null);
    }
  }, [open]);

  // Listen for OAuth callback
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "oauth_callback" && event.data?.session) {
        setOauthSession(event.data.session);
        setStep("select-account");
        
        try {
          setLoading(true);
          const result = await getOAuthAccounts(event.data.session);
          setAccounts(result.accounts);
        } catch (err: any) {
          setError(err.message || "Failed to load accounts");
          toast({
            title: "Error",
            description: err.message || "Failed to load accounts",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }

      if (event.data?.type === "oauth_error") {
        setError(event.data.error || "OAuth authentication failed");
        setStep("select-platform");
        toast({
          title: "Authentication Failed",
          description: event.data.error || "OAuth authentication failed",
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast]);

  // Handle platform selection
  const handleSelectPlatform = useCallback(async (platform: OAuthPlatform) => {
    setSelectedPlatform(platform);
    setError(null);
    setStep("oauth-redirect");
    setLoading(true);

    try {
      const redirectUrl = await initiateOAuth(brandId, platform);
      
      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        redirectUrl,
        "oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Poll for popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setLoading(false);
          // If we're still in oauth-redirect step and no accounts, go back
          if (step === "oauth-redirect" && accounts.length === 0) {
            setStep("select-platform");
          }
        }
      }, 500);

    } catch (err: any) {
      setError(err.message || "Failed to initiate OAuth");
      setStep("select-platform");
      setLoading(false);
      toast({
        title: "Error",
        description: err.message || "Failed to initiate OAuth",
        variant: "destructive",
      });
    }
  }, [brandId, step, accounts.length, toast]);

  // Handle account selection
  const handleSelectAccount = useCallback(async () => {
    if (!selectedAccount || !oauthSession) return;

    setStep("connecting");
    setLoading(true);
    setError(null);

    try {
      await connectOAuthAccount({
        session: oauthSession,
        accountId: selectedAccount.id,
        accountType: selectedAccount.type,
      });

      toast({
        title: "Account Connected",
        description: `${selectedAccount.name} has been connected successfully.`,
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to connect account");
      setStep("select-account");
      toast({
        title: "Connection Failed",
        description: err.message || "Failed to connect account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, oauthSession, toast, onSuccess, onOpenChange]);

  // Get account initials
  const getAccountInitials = (account: SelectableAccount) => {
    const name = account.name || account.username || "??";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {step === "select-platform" && "Connect Social Account"}
            {step === "oauth-redirect" && "Authenticating..."}
            {step === "select-account" && "Select Account"}
            {step === "connecting" && "Connecting..."}
          </DialogTitle>
          <DialogDescription>
            {step === "select-platform" && "Choose a platform to connect your social media account."}
            {step === "oauth-redirect" && "Please complete the authentication in the popup window."}
            {step === "select-account" && "Select an account to connect to your brand."}
            {step === "connecting" && "Setting up your account connection..."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Select Platform - 2 columns grid */}
        {step === "select-platform" && (
          <div className="grid grid-cols-2 gap-3 py-4">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => platform.enabled && handleSelectPlatform(platform.id)}
                disabled={!platform.enabled || loading}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                  platform.enabled
                    ? "hover:bg-accent hover:border-primary/50 cursor-pointer"
                    : "opacity-50 cursor-not-allowed",
                  selectedPlatform === platform.id && "border-primary bg-accent"
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: platform.bgColor, color: platform.color }}
                >
                  {platform.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm truncate">{platform.name}</span>
                    {!platform.enabled && (
                      <Badge variant="secondary" className="text-[10px] px-1">Soon</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-1">{platform.description}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: OAuth Redirect (loading state) */}
        {step === "oauth-redirect" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Complete the authentication in the popup window...
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setStep("select-platform");
                setLoading(false);
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Step 3: Select Account */}
        {step === "select-account" && (
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No accounts found.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setStep("select-platform")}
                >
                  Try another platform
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                        "hover:bg-accent hover:border-primary/50",
                        selectedAccount?.id === account.id && "border-primary bg-accent"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        {account.profilePictureUrl && (
                          <AvatarImage src={account.profilePictureUrl} alt={account.name} />
                        )}
                        <AvatarFallback>{getAccountInitials(account)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{account.name}</div>
                        {account.username && (
                          <div className="text-sm text-muted-foreground truncate">
                            @{account.username}
                          </div>
                        )}
                        {account.category && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {account.category}
                          </Badge>
                        )}
                      </div>
                      {selectedAccount?.id === account.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep("select-platform")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSelectAccount}
                    disabled={!selectedAccount}
                    className="flex-1"
                  >
                    Connect Account
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Connecting */}
        {step === "connecting" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Connecting your account...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

