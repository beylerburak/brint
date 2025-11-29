import { z } from "zod";

export const userProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z
    .string()
    .min(1, "Username is required")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    ),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
});

export type UserProfileFormData = z.infer<typeof userProfileSchema>;

