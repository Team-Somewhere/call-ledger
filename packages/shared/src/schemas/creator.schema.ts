import { z } from "zod";
import { CREATOR_STATUSES } from "../constants/statuses";

export const creatorStatusSchema = z.enum(CREATOR_STATUSES);

export const createCreatorSchema = z.object({
  displayName: z.string().min(1).max(255),
  xUserId: z.string().min(1).max(255),
  xUsername: z.string().min(1).max(255),
  bio: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  walletAddress: z.string().max(255).optional().nullable(),
  status: creatorStatusSchema.default("DISCOVERED"),
});

export const updateCreatorSchema = createCreatorSchema.partial();

export const creatorQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) =>
      val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20,
    ),
  status: creatorStatusSchema.optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(["winRate", "totalSignals", "cumulativeReturn", "createdAt"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});
