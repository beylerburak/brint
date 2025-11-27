"use client";

import {
  usePermissions,
  useHasPermission,
  PermissionGate,
} from "@/permissions";
import { Button } from "@/components/ui/button";

export default function DebugPermissionsPage() {
  const { permissions } = usePermissions();
  const hasCreatePermission = useHasPermission("studio:content.create");
  const hasDeletePermission = useHasPermission("studio:content.delete");

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>Permission Debug</h1>

      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>User Permissions</h2>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(permissions, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Permission Checks</h2>
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
              "studio:content.create": hasCreatePermission,
              "studio:content.delete": hasDeletePermission,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>PermissionGate Tests</h2>

        <div style={{ marginBottom: "1rem" }}>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>
            Create Content Button (has permission)
          </h3>
          <PermissionGate permission="studio:content.create">
            <Button>Create Content</Button>
          </PermissionGate>
        </div>

        <div>
          <h3 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>
            Delete Content Button (no permission - should show fallback)
          </h3>
          <PermissionGate
            permission="studio:content.delete"
            fallback={<p>No delete permission</p>}
          >
            <Button>Delete Content</Button>
          </PermissionGate>
        </div>
      </div>
    </div>
  );
}

