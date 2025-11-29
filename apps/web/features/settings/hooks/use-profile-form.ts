"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userProfileSchema, type UserProfileFormData } from "../schemas";
import { updateUserProfile, type UserProfile } from "@/features/space/api/user-api";
import { getCurrentSession } from "@/features/auth/api/auth-api";
import { apiCache } from "@/shared/api/cache";
import { logger } from "@/shared/utils/logger";

interface UseProfileFormOptions {
  /** Whether the form is enabled (e.g., dialog is open) */
  enabled?: boolean;
  /** Callback when profile is updated */
  onSuccess?: (profile: UserProfile) => void;
  /** Callback when update fails */
  onError?: (error: Error) => void;
}

interface UseProfileFormReturn {
  /** React Hook Form instance */
  form: ReturnType<typeof useForm<UserProfileFormData>>;
  /** Full profile data from server */
  profileUser: UserProfile | null;
  /** Original name value (for tracking changes) */
  originalName: string;
  /** Original username value (for tracking changes) */
  originalUsername: string;
  /** Is name saving in progress? */
  isSavingName: boolean;
  /** Is username saving in progress? */
  isSavingUsername: boolean;
  /** Has username been manually edited? */
  usernameManuallyEdited: boolean;
  /** Track manual username edit */
  setUsernameManuallyEdited: (edited: boolean) => void;
  /** Has name value changed? */
  nameHasChanged: boolean;
  /** Has username value changed? */
  usernameHasChanged: boolean;
  /** Save name field */
  saveName: () => Promise<void>;
  /** Save username field */
  saveUsername: () => Promise<void>;
  /** Reload profile from server */
  reloadProfile: () => Promise<void>;
}

export function useProfileForm(
  options: UseProfileFormOptions = {}
): UseProfileFormReturn {
  const { enabled = true, onSuccess, onError } = options;

  const [profileUser, setProfileUser] = useState<UserProfile | null>(null);
  const [originalName, setOriginalName] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  const form = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      phone: "",
    },
  });

  const watchedName = form.watch("name");
  const watchedUsername = form.watch("username");

  const nameHasChanged = watchedName !== originalName && watchedName.trim() !== "";
  const usernameHasChanged =
    watchedUsername !== originalUsername && watchedUsername.trim() !== "";

  // Load profile when enabled
  const loadProfile = useCallback(async () => {
    if (!enabled) return;

    try {
      // Check cache first
      let profile: UserProfile | null =
        apiCache.get<UserProfile>("user:profile", 60000) ?? null;

      if (profile) {
        setProfileUser(profile);
        const nameValue = profile.name || "";
        const usernameValue = profile.username || "";
        setOriginalName(nameValue);
        setOriginalUsername(usernameValue);
        form.reset({
          name: nameValue,
          username: usernameValue,
          email: profile.email,
          phone: profile.phone || "",
        });
        if (profile.username) {
          setUsernameManuallyEdited(true);
        }
        return;
      }

      // Cache miss: fetch from session
      const session = await getCurrentSession();
      if (!session) return;

      profile = apiCache.get<UserProfile>("user:profile", 60000) ?? null;
      if (!profile) return;

      setProfileUser(profile);
      const nameValue = profile.name || "";
      const usernameValue = profile.username || "";
      setOriginalName(nameValue);
      setOriginalUsername(usernameValue);
      form.reset({
        name: nameValue,
        username: usernameValue,
        email: profile.email,
        phone: profile.phone || "",
      });
      if (profile.username) {
        setUsernameManuallyEdited(true);
      }
    } catch (error) {
      logger.error("Error loading profile:", error);
    }
  }, [enabled, form]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Auto-generate username from name
  useEffect(() => {
    if (watchedName && !usernameManuallyEdited) {
      const generatedUsername = watchedName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      form.setValue("username", generatedUsername);
    }
  }, [watchedName, usernameManuallyEdited, form]);

  const saveName = useCallback(async () => {
    const currentName = watchedName.trim();
    if (!currentName) {
      onError?.(new Error("Name is required"));
      return;
    }

    setIsSavingName(true);
    try {
      const updated = await updateUserProfile({ name: currentName });
      setProfileUser(updated);
      setOriginalName(currentName);
      onSuccess?.(updated);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("Failed to update name"));
    } finally {
      setIsSavingName(false);
    }
  }, [watchedName, onSuccess, onError]);

  const saveUsername = useCallback(async () => {
    const currentUsername = watchedUsername.trim().toLowerCase();
    if (!currentUsername) {
      onError?.(new Error("Username is required"));
      return;
    }

    setIsSavingUsername(true);
    try {
      const updated = await updateUserProfile({ username: currentUsername });
      setProfileUser(updated);
      setOriginalUsername(currentUsername);
      setUsernameManuallyEdited(true);
      onSuccess?.(updated);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("Failed to update username"));
    } finally {
      setIsSavingUsername(false);
    }
  }, [watchedUsername, onSuccess, onError]);

  const reloadProfile = useCallback(async () => {
    apiCache.invalidate("user:profile");
    apiCache.invalidate("session:current");
    await loadProfile();
  }, [loadProfile]);

  return {
    form,
    profileUser,
    originalName,
    originalUsername,
    isSavingName,
    isSavingUsername,
    usernameManuallyEdited,
    setUsernameManuallyEdited,
    nameHasChanged,
    usernameHasChanged,
    saveName,
    saveUsername,
    reloadProfile,
  };
}

