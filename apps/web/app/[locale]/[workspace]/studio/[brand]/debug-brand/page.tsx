"use client";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useBrand } from "@/contexts/brand-context";

export default function DebugBrandPage() {
  const { user, isAuthenticated } = useAuth();
  const { workspace } = useWorkspace();
  const { brand } = useBrand();

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>Brand Context Debug</h1>

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
              isAuthenticated,
              user,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div style={{ marginBottom: "2rem" }}>
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
              workspace,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div>
        <h2 style={{ marginBottom: "1rem" }}>Brand State</h2>
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
              brand,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}

