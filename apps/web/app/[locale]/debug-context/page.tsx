"use client";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";

export default function DebugContextPage() {
  const auth = useAuth();
  const workspace = useWorkspace();

  const handleMockLogin = async () => {
    // For debug purposes, create a mock login result
    // In production, this would come from the actual login API
    await auth.login({
      user: {
        id: "1",
        email: "demo@example.com",
        name: "Demo User",
      },
      workspaces: [],
      accessToken: "mock-token",
    });
  };

  const handleLogout = () => {
    auth.logout();
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>Context Debug</h1>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <Button onClick={handleMockLogin} style={{ marginRight: "1rem" }}>
            Mock Login
          </Button>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Auth State</h2>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(
            {
              isAuthenticated: auth.isAuthenticated,
              user: auth.user,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div>
        <h2 style={{ marginBottom: "1rem" }}>Workspace State</h2>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(
            {
              workspace: workspace.workspace,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}

