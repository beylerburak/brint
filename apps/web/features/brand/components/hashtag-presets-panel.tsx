"use client";

/**
 * Hashtag Presets Panel
 * 
 * Manages hashtag presets for a brand.
 * Used in both wizard and brand detail page.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Pencil, Hash, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermission } from "@/features/permissions/hooks/hooks";
import {
  useHashtagPresets,
  useCreateHashtagPreset,
  useUpdateHashtagPreset,
  useDeleteHashtagPreset,
} from "../hooks";
import type { BrandHashtagPreset, CreateHashtagPresetRequest, UpdateHashtagPresetRequest } from "../types";

// ============================================================================
// Form Schema
// ============================================================================

const presetFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  tagsInput: z.string().min(1, "At least one tag is required"),
});

type PresetFormData = z.infer<typeof presetFormSchema>;

// ============================================================================
// Main Component
// ============================================================================

interface HashtagPresetsPanelProps {
  brandId: string;
}

export function HashtagPresetsPanel({ brandId }: HashtagPresetsPanelProps) {
  const { presets, loading, refresh } = useHashtagPresets(brandId);
  const canUpdate = useHasPermission("studio:brand.update");
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<BrandHashtagPreset | null>(null);
  const [deletingPreset, setDeletingPreset] = useState<BrandHashtagPreset | null>(null);

  const handleCreate = () => {
    setEditingPreset(null);
    setDialogOpen(true);
  };

  const handleEdit = (preset: BrandHashtagPreset) => {
    setEditingPreset(preset);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingPreset(null);
  };

  const handleSuccess = () => {
    handleDialogClose();
    refresh();
  };

  const handleDeleteSuccess = () => {
    setDeletingPreset(null);
    refresh();
  };

  if (loading) {
    return <HashtagPresetsSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Hashtag Presets</h3>
          <p className="text-sm text-muted-foreground">
            Create reusable hashtag groups for your content
          </p>
        </div>
        {canUpdate && (
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Preset
          </Button>
        )}
      </div>

      {presets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Hash className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              No hashtag presets yet.
              {canUpdate && " Create your first preset to organize your hashtags."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              canUpdate={canUpdate}
              onEdit={() => handleEdit(preset)}
              onDelete={() => setDeletingPreset(preset)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <PresetDialog
        open={dialogOpen}
        brandId={brandId}
        preset={editingPreset}
        onClose={handleDialogClose}
        onSuccess={handleSuccess}
      />

      {/* Delete Confirmation */}
      <DeletePresetDialog
        brandId={brandId}
        preset={deletingPreset}
        onClose={() => setDeletingPreset(null)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

// ============================================================================
// Preset Card
// ============================================================================

interface PresetCardProps {
  preset: BrandHashtagPreset;
  canUpdate: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function PresetCard({ preset, canUpdate, onEdit, onDelete }: PresetCardProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{preset.name}</CardTitle>
          {canUpdate && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-2 pt-0">
        <div className="flex flex-wrap gap-1">
          {preset.tags.slice(0, 10).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              #{tag.replace(/^#/, "")}
            </Badge>
          ))}
          {preset.tags.length > 10 && (
            <Badge variant="outline" className="text-xs">
              +{preset.tags.length - 10} more
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Preset Dialog (Create/Edit)
// ============================================================================

interface PresetDialogProps {
  open: boolean;
  brandId: string;
  preset: BrandHashtagPreset | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PresetDialog({ open, brandId, preset, onClose, onSuccess }: PresetDialogProps) {
  const { createPreset, loading: createLoading } = useCreateHashtagPreset(brandId);
  const { updatePreset, loading: updateLoading } = useUpdateHashtagPreset(brandId, preset?.id || "");
  
  const isEditing = !!preset;
  const loading = createLoading || updateLoading;

  const form = useForm<PresetFormData>({
    resolver: zodResolver(presetFormSchema),
    defaultValues: {
      name: "",
      tagsInput: "",
    },
  });

  // Reset form when dialog opens or preset changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: preset?.name || "",
        tagsInput: preset?.tags ? preset.tags.join(", ") : "",
      });
    }
  }, [open, preset, form]);

  const handleSubmit = async (data: PresetFormData) => {
    // Parse tags from comma-separated input
    const tags = data.tagsInput
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter((tag) => tag.length > 0);

    if (tags.length === 0) {
      form.setError("tagsInput", { message: "At least one valid tag is required" });
      return;
    }

    if (isEditing) {
      const result = await updatePreset({ name: data.name, tags });
      if (result) {
        onSuccess();
      }
    } else {
      const result = await createPreset({ name: data.name, tags });
      if (result) {
        onSuccess();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Preset" : "Create Preset"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your hashtag preset"
              : "Create a new hashtag preset for quick access"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="General Tags" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tagsInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hashtags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="marketing, socialmedia, brand"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Enter tags separated by commas. The # symbol is optional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

interface DeletePresetDialogProps {
  brandId: string;
  preset: BrandHashtagPreset | null;
  onClose: () => void;
  onSuccess: () => void;
}

function DeletePresetDialog({ brandId, preset, onClose, onSuccess }: DeletePresetDialogProps) {
  const { deletePreset, loading } = useDeleteHashtagPreset(brandId, preset?.id || "");

  const handleConfirm = async () => {
    const success = await deletePreset();
    if (success) {
      onSuccess();
    }
  };

  return (
    <Dialog open={!!preset} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Preset</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{preset?.name}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Skeleton
// ============================================================================

function HashtagPresetsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="py-3">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="py-2 pt-0">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-5 w-16" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

