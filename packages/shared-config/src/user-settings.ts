import { z } from "zod";

export const UserThemeSchema = z.enum(["system", "light", "dark"]);
export type UserTheme = z.infer<typeof UserThemeSchema>;

export const UserLanguageSchema = z.enum(["tr", "en"]);
export type UserLanguage = z.infer<typeof UserLanguageSchema>;

export const UserSettingsSchema = z.object({
  version: z.number().int().min(1).default(1),

  ui: z
    .object({
      theme: UserThemeSchema.default("system"),
      language: UserLanguageSchema.default("en"),
    })
    .default({ theme: "system", language: "en" }),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = UserSettingsSchema.parse({});

/**
 * Always returns a valid settings object.
 * If input is null/malformed/outdated -> default.
 */
export function parseUserSettings(input: unknown): UserSettings {
  const res = UserSettingsSchema.safeParse(input);
  if (res.success) return res.data;
  return DEFAULT_USER_SETTINGS;
}

/**
 * Patch schema: only allow known fields to be updated.
 */
export const UserSettingsPatchSchema = z
  .object({
    ui: z
      .object({
        theme: UserThemeSchema.optional(),
        language: UserLanguageSchema.optional(),
      })
      .optional(),
  })
  .strict();

export type UserSettingsPatch = z.infer<typeof UserSettingsPatchSchema>;

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Merge base settings with a validated patch, then re-validate full object.
 */
export function mergeUserSettings(current: unknown, patch: UserSettingsPatch): UserSettings {
  const base = parseUserSettings(current);

  const mergedUi = {
    ...base.ui,
    ...(isPlainObject(patch.ui) ? patch.ui : {}),
  };

  return UserSettingsSchema.parse({
    ...base,
    ui: mergedUi,
  });
}
