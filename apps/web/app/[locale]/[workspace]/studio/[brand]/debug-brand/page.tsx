"use client";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useBrand } from "@/features/brand/context/brand-context";

export default function DebugBrandPage() {
  const { user, isAuthenticated } = useAuth();
  const { workspace } = useWorkspace();
  const { brand } = useBrand();

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Brand Context Debug</h1>
      </div>
      <div className="max-w-[800px]">

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
    </div>
  );
}
