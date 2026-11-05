import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, {
      message:
        "Username can only contain alphanumeric characters and underscores",
    })
    .optional()
    .nullable(),
  displayName: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const updateUserSchema = createUserSchema.partial();
