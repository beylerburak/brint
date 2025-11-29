"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getWorkspaceRoles,
  type WorkspaceRole,
} from "@/features/space/api/roles-api";
import { useWorkspace } from "@/features/space/context/workspace-context";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";

const columns: ColumnDef<WorkspaceRole>[] = [
  {
    accessorKey: "name",
    header: "Role",
    cell: ({ row }) => {
      const role = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{role.name}</span>
          {role.description && (
            <span className="text-sm text-muted-foreground">
              {role.description}
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "key",
    header: "Key",
    cell: ({ row }) => {
      return (
        <Badge variant="outline" className="font-mono text-xs">
          {row.original.key}
        </Badge>
      );
    },
  },
  {
    accessorKey: "builtIn",
    header: "Type",
    cell: ({ row }) => {
      const isBuiltIn = row.original.builtIn;
      return (
        <Badge variant={isBuiltIn ? "default" : "secondary"}>
          {isBuiltIn ? "Built-in" : "Custom"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "permissions",
    header: "Permissions",
    cell: ({ row }) => {
      const permissions = row.original.permissions;
      if (permissions.length === 0) {
        return (
          <span className="text-sm text-muted-foreground">No permissions</span>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {permissions.slice(0, 3).map((perm) => (
            <Badge key={perm.key} variant="outline" className="text-xs">
              {perm.key}
            </Badge>
          ))}
          {permissions.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{permissions.length - 3} more
            </Badge>
          )}
        </div>
      );
    },
  },
];

export function WorkspaceRolesTable() {
  const { workspace } = useWorkspace();
  const [roles, setRoles] = React.useState<WorkspaceRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadRoles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getWorkspaceRoles(workspace.id);
        if (!cancelled) {
          setRoles(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load roles");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRoles();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  const table = useReactTable({
    data: roles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-muted-foreground">Loading roles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-destructive">{error}</span>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-muted-foreground">No roles found</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : typeof header.column.columnDef.header === "function"
                    ? header.column.columnDef.header({
                        column: header.column,
                        header: header,
                        table: table,
                      })
                    : header.column.columnDef.header}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {typeof cell.column.columnDef.cell === "function"
                    ? cell.column.columnDef.cell({
                        cell: cell,
                        column: cell.column,
                        row: row,
                        table: table,
                        getValue: cell.getValue,
                        renderValue: cell.renderValue,
                      })
                    : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

