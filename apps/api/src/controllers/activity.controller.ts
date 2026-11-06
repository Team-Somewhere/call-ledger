import type { Request, Response } from "express";
import { z } from "zod";
import { CREATOR_SOURCE_TYPES, SourceAdapterError } from "@call-ledger/shared";
import * as activityService from "../services/activity.service";
import { sendError, sendSuccess } from "../utils/api-response";

const querySchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    creatorId: z.string().uuid().optional(),
    sourceType: z.enum(CREATOR_SOURCE_TYPES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    includeReplies: z.preprocess(parseBoolean, z.boolean()).default(false),
    includeReposts: z.preprocess(parseBoolean, z.boolean()).default(false),
  })
  .refine(
    (query) =>
      !query.startDate || !query.endDate || query.startDate <= query.endDate,
    { message: "startDate must be earlier than or equal to endDate" },
  );

function parseBoolean(value: unknown): unknown {
  if (value === undefined) return false;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}

function parseQuery(req: Request) {
  const parsed = querySchema.parse(req.query);
  return {
    ...parsed,
    cursor: parsed.cursor ? decodeCursor(parsed.cursor) : undefined,
  };
}

function decodeCursor(cursor: string): { at: Date; id: string } {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    const schema = z.object({
      at: z.string().datetime(),
      id: z.string().uuid(),
    });
    const value = schema.parse(decoded);
    return { at: new Date(value.at), id: value.id };
  } catch {
    throw new SourceAdapterError(
      "INVALID_CURSOR",
      "The activity cursor is invalid",
      400,
    );
  }
}

export async function getMyActivity(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }
  const result = await activityService.listUserActivity(
    req.auth.id,
    parseQuery(req),
  );
  sendSuccess(res, result.data, {
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  });
}

export async function getCreatorPosts(
  req: Request,
  res: Response,
): Promise<void> {
  const creatorId = z.string().uuid().parse(req.params.id);
  const result = await activityService.listCreatorPosts(
    creatorId,
    parseQuery(req),
  );
  sendSuccess(res, result.data, {
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  });
}
