"use client";

/**
 * Brand Social Account Connect Dialog
 * 
 * Dialog for connecting social accounts via OAuth.
 */

import { useEffect, useState, useCallback } from "react";
import { Loader2, Facebook, Instagram, Youtube, Linkedin, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  getOAuthPlatforms,
  initiateOAuth,
  type OAuthPlatform,
} from "@/features/social-account/api/social-account-api";

// ============================================================================
// Types
// ============================================================================

interface BrandSocialAccountConnectDialogProps {
  open: boolean;
  brandId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function BrandSocialAccountConnectDialog({
  open,
  brandId,
  onClose,
  onSuccess,
}: BrandSocialAccountConnectDialogProps) {
  const { toast } = useToast();

  const [platforms, setPlatforms] = useState<OAuthPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  // Fetch available OAuth platforms
  useEffect(() => {
    async function fetchPlatforms() {
      try {
        const data = await getOAuthPlatforms();
        setPlatforms(data);
      } catch (err) {
        console.error("Failed to fetch platforms:", err);
      } finally {
        setLoading(false);
      }
    }

    if (open) {
      setLoading(true);
      fetchPlatforms();
    }
  }, [open]);

  // Listen for OAuth completion message from popup
  const handleOAuthMessage = useCallback(
    (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_SUCCESS") {
        toast({
          title: "Account Connected",
          description: "Social account has been connected successfully.",
        });
        onSuccess();
        onClose();
      } else if (event.data?.type === "OAUTH_ERROR") {
        toast({
          title: "Connection Failed",
          description: "Failed to connect social account. Please try again.",
          variant: "destructive",
        });
        setConnecting(null);
      }
    },
    [onSuccess, onClose, toast]
  );

  // Add/remove message listener
  useEffect(() => {
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [handleOAuthMessage]);

  // Handle OAuth connect
  const handleConnect = async (platform: "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "LINKEDIN" | "X" | "PINTEREST" | "YOUTUBE") => {
    setConnecting(platform);

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
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      // Check if popup was blocked
      if (!popup || popup.closed) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site and try again.",
          variant: "destructive",
        });
        setConnecting(null);
        return;
      }

      // Poll to check if popup was closed without completing OAuth
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          // Give some time for message to be received
          setTimeout(() => {
            setConnecting(null);
          }, 500);
        }
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start OAuth";
      toast({
        title: "Connection Failed",
        description: message,
        variant: "destructive",
      });
      setConnecting(null);
    }
  };

  // TikTok icon (not available in Lucide)
  const TikTokIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );

  // Platform icons
  const getPlatformIcon = (platformId: string) => {
    switch (platformId) {
      case "FACEBOOK":
        return <Facebook className="h-6 w-6" />;
      case "INSTAGRAM":
        return <Instagram className="h-6 w-6" />;
      case "YOUTUBE":
        return <Youtube className="h-6 w-6" />;
      case "TIKTOK":
        return <TikTokIcon className="h-6 w-6" />;
      case "LINKEDIN":
        return <Linkedin className="h-6 w-6" />;
      default:
        return <ExternalLink className="h-6 w-6" />;
    }
  };

  // Platform colors
  const getPlatformColor = (platformId: string) => {
    switch (platformId) {
      case "FACEBOOK":
        return "bg-[#1877F2] hover:bg-[#166FE5] text-white";
      case "INSTAGRAM":
        return "bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-90 text-white";
      case "YOUTUBE":
        return "bg-[#FF0000] hover:bg-[#CC0000] text-white";
      case "TIKTOK":
        return "bg-black hover:bg-gray-900 text-white";
      case "LINKEDIN":
        return "bg-[#0A66C2] hover:bg-[#004182] text-white";
      case "X":
        return "bg-black hover:bg-gray-900 text-white";
      default:
        return "bg-primary hover:bg-primary/90 text-primary-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Social Account</DialogTitle>
          <DialogDescription>
            Connect your social media accounts to publish content from your brand.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 py-2">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() =>
                  platform.enabled &&
                  handleConnect(platform.id as "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "LINKEDIN" | "X" | "PINTEREST" | "YOUTUBE")
                }
                disabled={!platform.enabled || connecting !== null}
                className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                  !platform.enabled
                    ? "opacity-50 cursor-not-allowed bg-muted/30"
                    : connecting === platform.id
                    ? "opacity-70 cursor-wait"
                    : "hover:bg-accent hover:border-accent-foreground/20 cursor-pointer"
                }`}
              >
                <div
                  className={`p-1.5 rounded-md shrink-0 ${
                    platform.enabled ? getPlatformColor(platform.id) : "bg-muted"
                  }`}
                >
                  {connecting === platform.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    getPlatformIcon(platform.id)
                  )}
                </div>
                <div className="min-w-0 text-left flex-1">
                  <p className="font-medium text-sm truncate">{platform.name}</p>
                  {!platform.enabled && (
                    <p className="text-[10px] text-muted-foreground">Coming soon</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-2">
          You&apos;ll be redirected to authorize access to your account.
          <br />
          We only request permissions necessary for publishing content.
        </div>
      </DialogContent>
    </Dialog>
  );
}
