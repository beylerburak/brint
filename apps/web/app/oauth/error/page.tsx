"use client";

/**
 * OAuth Error Page
 *
 * Displayed when OAuth flow fails.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function OAuthErrorPageContent() {
  const searchParams = useSearchParams();
  
  const error = searchParams.get("error") || "unknown_error";
  const message = searchParams.get("message") || "An error occurred during the connection process.";

  const errorMessages: Record<string, string> = {
    access_denied: "You denied access to the application. Please try again if you want to connect your account.",
    invalid_state: "The session expired or was invalid. Please close this window and try again.",
    missing_params: "Required parameters were missing. Please close this window and try again.",
    callback_failed: "Failed to complete the connection. Please try again.",
    unknown_error: "An unexpected error occurred. Please try again.",
  };

  const displayMessage = errorMessages[error] || message;

  const handleClose = () => {
    if (window.opener) {
      window.opener.postMessage({ type: "OAUTH_ERROR", error }, "*");
    }
    window.close();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
            <p className="text-muted-foreground mb-6">{displayMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleClose}>
                Close Window
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <OAuthErrorPageContent />
    </Suspense>
  );
}

