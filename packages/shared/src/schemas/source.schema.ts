import { z } from "zod";
import {
  CREATOR_SOURCE_STATUSES,
  CREATOR_SOURCE_TYPES,
  CREATOR_SOURCE_VERIFICATION_STATUSES,
  IDENTITY_LINK_RELATIONSHIP_TYPES,
  IDENTITY_VERIFICATION_METHODS,
} from "../types/source";

export const creatorSourceTypeSchema = z.enum(CREATOR_SOURCE_TYPES);
export const creatorSourceStatusSchema = z.enum(CREATOR_SOURCE_STATUSES);
export const creatorSourceVerificationStatusSchema = z.enum(
  CREATOR_SOURCE_VERIFICATION_STATUSES,
);
export const identityLinkRelationshipTypeSchema = z.enum(
  IDENTITY_LINK_RELATIONSHIP_TYPES,
);
export const identityVerificationMethodSchema = z.enum(
  IDENTITY_VERIFICATION_METHODS,
);

/** X handle: 1-15 word chars (letters, digits, underscore). */
export const xHandleSchema = z
  .string()
  .trim()
  .min(1, "X username is required")
  .max(20)
  .transform((v) => v.replace(/^@+/, ""))
  .refine((v) => /^[A-Za-z0-9_]{1,15}$/.test(v), {
    message:
      "Not a valid X username. Use only letters, numbers and underscores (max 15). Display names like 'Dr. Prophet' are not usernames; enter the handle shown as @name on X.",
  });

/** Bluesky handle: domain-style, e.g. trader.bsky.social */
export const blueskyHandleSchema = z
  .string()
  .trim()
  .max(253)
  .transform((v) => v.replace(/^@+/, ""))
  .refine(
    (v) =>
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(
        v,
      ),
    { message: "Invalid Bluesky handle format" },
  );

/** http(s) URL only — scheme allowlist is enforced again in the SSRF guard. */
export const safeUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, { message: "Must be a valid http(s) URL" });

export const resolveCreatorSourceSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("X"),
    username: xHandleSchema,
  }),
  z.object({
    sourceType: z.literal("BLUESKY"),
    handle: blueskyHandleSchema,
  }),
  z.object({
    sourceType: z.literal("RSS"),
    feedUrl: safeUrlSchema,
  }),
  z.object({
    sourceType: z.literal("WEBSITE"),
    websiteUrl: safeUrlSchema,
    authorized: z.boolean(),
    maxPages: z.number().int().min(1).max(50).optional(),
  }),
]);

export type ResolveCreatorSourceInput = z.infer<
  typeof resolveCreatorSourceSchema
>;

export const createCreatorWithSourceSchema = resolveCreatorSourceSchema;

export const addCreatorSourceSchema = z.discriminatedUnion("sourceType", [
  z.object({
    creatorId: z.string().uuid(),
    sourceType: z.literal("X"),
    username: xHandleSchema,
  }),
  z.object({
    creatorId: z.string().uuid(),
    sourceType: z.literal("BLUESKY"),
    handle: blueskyHandleSchema,
  }),
  z.object({
    creatorId: z.string().uuid(),
    sourceType: z.literal("RSS"),
    feedUrl: safeUrlSchema,
  }),
  z.object({
    creatorId: z.string().uuid(),
    sourceType: z.literal("WEBSITE"),
    websiteUrl: safeUrlSchema,
    authorized: z.boolean(),
    maxPages: z.number().int().min(1).max(50).optional(),
  }),
]);

export const creatorSourceQuerySchema = z.object({
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
  sourceType: creatorSourceTypeSchema.optional(),
  status: creatorSourceStatusSchema.optional(),
});

export const followCreatorSchema = z.object({
  notificationEnabled: z.boolean().optional().default(true),
});

export const followingQuerySchema = z.object({
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
  sourceType: creatorSourceTypeSchema.optional(),
});
