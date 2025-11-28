"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { updateUserProfile, checkUsernameAvailability, type UserProfile } from "../api/user-api";
import { useAuth } from "@/features/auth/context/auth-context";
import { useToast } from "@/components/ui/use-toast";

const profileCompletionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
});

type ProfileCompletionFormData = z.infer<typeof profileCompletionSchema>;

interface ProfileCompletionDialogProps {
  user: UserProfile;
  onComplete: () => void;
}

export function ProfileCompletionDialog({ user, onComplete }: ProfileCompletionDialogProps) {
  const t = useTranslations("common");
  const { toast } = useToast();
  const { user: authUser, login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProfileCompletionFormData>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: {
      name: user.name ?? "",
      username: user.username ?? "",
    },
  });

  const watchedName = watch("name");
  const watchedUsername = watch("username");

  // Generate username from name (only if username hasn't been manually edited)
  useEffect(() => {
    if (watchedName && !usernameManuallyEdited) {
      const generatedUsername = watchedName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setValue("username", generatedUsername);
    }
  }, [watchedName, usernameManuallyEdited, setValue]);

  // Check username availability when it changes
  useEffect(() => {
    // Clear previous timeout
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    // Don't check if username is empty
    if (!watchedUsername?.trim()) {
      setUsernameAvailability(null);
      return;
    }

    // Debounce username check
    setIsCheckingUsername(true);
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(watchedUsername);
        setUsernameAvailability(available);
      } catch (err) {
        console.error("Failed to check username availability:", err);
        setUsernameAvailability(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500);

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [watchedUsername]);

  // Pre-fill form with existing values if available
  useEffect(() => {
    if (user.name) {
      setValue("name", user.name);
    }
    if (user.username) {
      setValue("username", user.username);
      setUsernameManuallyEdited(true);
    }
  }, [user, setValue]);

  const onSubmit = async (data: ProfileCompletionFormData) => {
    // Validate username availability before submitting
    if (usernameAvailability === false) {
      toast({
        title: t("error") || "Error",
        description: t("usernameTaken") || "This username is already taken. Please choose a different one.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateUserProfile({
        name: data.name,
        username: data.username.trim().toLowerCase(),
      });

      // Update auth context if user is available
      if (authUser) {
        await login({
          user: {
            id: updated.id,
            email: updated.email,
            name: updated.name ?? undefined,
          },
          workspaces: [], // Will be refreshed from session
          accessToken: "", // Keep existing token
        });
      }

      toast({
        title: t("profileUpdated") || "Profile updated",
        description: t("profileUpdatedDescription") || "Your profile has been updated successfully.",
      });

      onComplete();
    } catch (err) {
      toast({
        title: t("error") || "Error",
        description: err instanceof Error ? err.message : t("profileUpdateError") || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if form can be submitted
  const canSubmit = useMemo(() => {
    return (
      watchedName?.trim() &&
      watchedUsername?.trim() &&
      usernameAvailability === true &&
      !isCheckingUsername
    );
  }, [watchedName, watchedUsername, usernameAvailability, isCheckingUsername]);

  return (
    <Dialog open={true}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("completeYourProfile") || "Complete Your Profile"}</DialogTitle>
          <DialogDescription>
            {t("completeProfileDescription") || "Please provide your name and username to continue."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">
                {t("fullName") || "Full Name"} <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="name"
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
                placeholder={t("fullNamePlaceholder") || "Enter your full name"}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="username">
                {t("username") || "Username"} <span className="text-destructive">*</span>
              </FieldLabel>
              <InputGroup
                className={watchedUsername?.trim() && usernameAvailability !== null
                  ? (usernameAvailability
                      ? "border-green-500 has-[[data-slot=input-group-control]:focus-visible]:border-green-500"
                      : "border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive")
                  : ""
                }
              >
                <InputGroupAddon align="inline-start">
                  <span>@</span>
                </InputGroupAddon>
                <InputGroupInput
                  id="username"
                  {...register("username", {
                    onChange: (e) => {
                      setUsernameManuallyEdited(true);
                    },
                  })}
                  aria-invalid={errors.username ? "true" : "false"}
                  placeholder={t("usernamePlaceholder") || "pick a username"}
                  disabled={isSubmitting}
                />
              </InputGroup>
              {watchedUsername?.trim() && usernameAvailability !== null && (
                <FieldDescription
                  className={usernameAvailability ? "text-green-600 dark:text-green-400" : "text-destructive"}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {usernameAvailability ? (
                      <>
                        <CheckCircle2 className="size-4" />
                        <span>{t("usernameAvailable") || "This username is available"}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="size-4" />
                        <span>{t("usernameTaken") || "This username is already taken"}</span>
                      </>
                    )}
                  </span>
                </FieldDescription>
              )}
              {(!watchedUsername?.trim() || usernameAvailability === null) && (
                <FieldDescription>
                  {t("usernameDescription") || "Username can only contain letters, numbers, underscores, and hyphens."}
                </FieldDescription>
              )}
              {errors.username && (
                <p className="text-sm text-destructive mt-1">{errors.username.message}</p>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? (t("saving") || "Saving...") : (t("save") || "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

