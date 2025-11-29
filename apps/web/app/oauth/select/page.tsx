"use client";

/**
 * OAuth Account Selection Page
 * 
 * After successful OAuth, user selects which account to connect to their brand.
 */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, Check, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  getOAuthAccounts,
  connectOAuthAccount,
  type SelectableAccount,
} from "@/features/social-account/api/social-account-api";

// TikTok icon (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

// X icon (new Twitter logo)
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Pinterest icon
function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  );
}

// Get platform display name
function getPlatformName(platform: string | null): string {
  switch (platform) {
    case "FACEBOOK":
      return "Facebook";
    case "INSTAGRAM":
      return "Instagram";
    case "LINKEDIN":
      return "LinkedIn";
    case "TIKTOK":
      return "TikTok";
    case "X":
      return "X";
    case "PINTEREST":
      return "Pinterest";
    case "YOUTUBE":
      return "YouTube";
    default:
      return "Social";
  }
}

export default function OAuthSelectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const session = searchParams.get("session");
  const platform = searchParams.get("platform");

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<SelectableAccount[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);

  // Fetch available accounts
  useEffect(() => {
    async function fetchAccounts() {
      if (!session) {
        setError("Invalid session. Please try again.");
        setLoading(false);
        return;
      }

      try {
        const data = await getOAuthAccounts(session);
        setAccounts(data.accounts);
        setBrandId(data.brandId);
        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load accounts";
        setError(message);
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [session]);

  // Handle account selection
  const handleSelectAccount = async (account: SelectableAccount) => {
    if (!session || connecting) return;

    setConnecting(account.id);

    try {
      await connectOAuthAccount({
        session,
        accountId: account.id,
        accountType: account.type,
      });

      toast({
        title: "Account Connected",
        description: `${account.name} has been connected successfully.`,
      });

      // Close the window (or redirect back to brand page)
      if (window.opener) {
        window.opener.postMessage({ type: "OAUTH_SUCCESS", brandId }, "*");
        window.close();
      } else {
        router.push("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect account";
      toast({
        title: "Connection Failed",
        description: message,
        variant: "destructive",
      });
      setConnecting(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading your accounts...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Connection Error</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.close()} variant="outline">
                Close Window
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No accounts state
  if (accounts.length === 0) {
    const getNoAccountsMessage = () => {
      switch (platform) {
        case "INSTAGRAM":
          return "No Instagram Business accounts found. Make sure your Instagram account is connected to a Facebook Page.";
        case "LINKEDIN":
          return "No LinkedIn account found. Please try again.";
        case "TIKTOK":
          return "No TikTok account found. Please try again.";
        case "X":
          return "No X account found. Please try again.";
        case "PINTEREST":
          return "No Pinterest account found. Please try again.";
        case "YOUTUBE":
          return "No YouTube channels found. Make sure you have at least one YouTube channel.";
        default:
          return "No Facebook Pages found. Make sure you have admin access to at least one Facebook Page.";
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">No Accounts Found</h2>
              <p className="text-muted-foreground mb-4">{getNoAccountsMessage()}</p>
              <Button onClick={() => window.close()} variant="outline">
                Close Window
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {platform === "INSTAGRAM" && <Instagram className="h-6 w-6" />}
            {platform === "FACEBOOK" && <Facebook className="h-6 w-6" />}
            {platform === "LINKEDIN" && <Linkedin className="h-6 w-6" />}
            {platform === "TIKTOK" && <TikTokIcon className="h-6 w-6" />}
            {platform === "X" && <XIcon className="h-6 w-6" />}
            {platform === "PINTEREST" && <PinterestIcon className="h-6 w-6" />}
            {platform === "YOUTUBE" && <Youtube className="h-6 w-6" />}
            Select Account
          </CardTitle>
          <CardDescription>
            Choose which {getPlatformName(platform)} account to connect to your brand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleSelectAccount(account)}
                disabled={connecting !== null}
                className="w-full flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={account.profilePictureUrl} alt={account.name} />
                  <AvatarFallback>
                    {account.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{account.name}</p>
                  {account.username && (
                    <p className="text-sm text-muted-foreground">@{account.username}</p>
                  )}
                  {account.category && (
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {account.category}
                    </Badge>
                  )}
                  {account.linkedPageName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Linked to: {account.linkedPageName}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {connecting === account.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Check className="h-5 w-5 text-muted-foreground/30" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => window.close()} disabled={connecting !== null}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

