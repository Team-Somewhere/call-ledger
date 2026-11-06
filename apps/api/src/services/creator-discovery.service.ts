import { eq, or } from "drizzle-orm";
import {
  creatorDiscoverySources,
  creatorMetrics,
  creatorMonitoring,
  creators,
  db,
  xAccountConnections,
} from "@call-ledger/database";
import { getXClient, XApiError } from "../integrations/x";

export interface OnboardCreatorInput {
  xUsername: string;
  sourceType?: "MANUAL" | "USER_SUBMISSION" | "DIRECTORY";
  notes?: string;
  submittedByUserId?: string;
}

export interface CreatorDiscoveryResult {
  creator: typeof creators.$inferSelect;
  isExisting: boolean;
  discoverySourceId?: string;
}

/**
 * Normalizes an X username (removes leading @, lowercases, trims).
 */
export function normalizeXUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Validates X username format according to X rules (1-15 chars, alphanumeric + underscore).
 */
export function isValidXUsername(username: string): boolean {
  const normalized = normalizeXUsername(username);
  return /^[a-zA-Z0-9_]{1,15}$/.test(normalized);
}

/**
 * Discover & onboard a creator:
 * 1. Normalize and validate username format.
 * 2. Look up account via official X API to get stable numeric xUserId and latest profile info.
 * 3. Check for duplicates by x_user_id (or username).
 * 4. If existing, update profile data and return existing record without overwriting monitoring/qualification.
 * 5. If new, create candidate creator with status = 'DISCOVERED', monitoring_enabled = false.
 * 6. Initialize creator_metrics and creator_monitoring records.
 * 7. Track discovery source in creator_discovery_sources.
 */
export async function onboardCreatorByUsername(
  input: OnboardCreatorInput,
): Promise<CreatorDiscoveryResult> {
  const normalized = normalizeXUsername(input.xUsername);
  if (!isValidXUsername(normalized)) {
    throw new Error(`Invalid X username format: "${input.xUsername}". X handles are 1-15 alphanumeric characters.`);
  }

  const xClient = getXClient();
  let xUser;

  try {
    const lookup = await xClient.getUserByUsername(normalized);
    xUser = lookup.user;
  } catch (err: unknown) {
    if (err instanceof XApiError && err.category === "NOT_FOUND") {
      throw new Error(`X account @${normalized} does not exist.`);
    }
    // Fallback if X API credentials are not yet configured in local test environments
    if (process.env.NODE_ENV !== "production" && (!process.env.X_BEARER_TOKEN && !process.env.X_CLIENT_ID)) {
      xUser = {
        id: `mock_xid_${normalized}`,
        name: normalized.charAt(0).toUpperCase() + normalized.slice(1),
        username: normalized,
        description: `Discovered creator @${normalized}`,
        profile_image_url: `https://avatar.vercel.sh/${normalized}.png`,
      };
    } else {
      throw err;
    }
  }

  // Check if creator already exists by stable numeric xUserId
  const [existingCreator] = await db
    .select()
    .from(creators)
    .where(eq(creators.xUserId, xUser.id))
    .limit(1);

  if (existingCreator) {
    // If username changed, update it along with avatar and bio
    const [updatedCreator] = await db
      .update(creators)
      .set({
        xUsername: xUser.username,
        displayName: xUser.name,
        bio: xUser.description || existingCreator.bio,
        avatarUrl: xUser.profile_image_url || existingCreator.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, existingCreator.id))
      .returning();

    return {
      creator: updatedCreator!,
      isExisting: true,
    };
  }

  // Check if someone connected this X account via OAuth already
  const [matchingConnection] = await db
    .select()
    .from(xAccountConnections)
    .where(eq(xAccountConnections.xUserId, xUser.id))
    .limit(1);

  const isXVerified = !!matchingConnection && matchingConnection.connectionStatus === "CONNECTED";

  // Create new creator record
  const [newCreator] = await db
    .insert(creators)
    .values({
      displayName: xUser.name,
      xUserId: xUser.id,
      xUsername: xUser.username,
      bio: xUser.description || null,
      avatarUrl: xUser.profile_image_url || null,
      status: "DISCOVERED",
      discoverySource: input.sourceType || "MANUAL",
      isXVerified,
      monitoringEnabled: false, // Never automatically true
    })
    .returning();

  // Initialize empty creator metrics
  await db.insert(creatorMetrics).values({
    creatorId: newCreator!.id,
    totalSignals: 0,
    verifiedSignals: 0,
    winningSignals: 0,
    losingSignals: 0,
    winRate: "0.00",
    averageReturn: "0.0000",
    cumulativeReturn: "0.0000",
  });

  // Initialize creator monitoring state (idle)
  await db.insert(creatorMonitoring).values({
    creatorId: newCreator!.id,
    monitoringStatus: "PAUSED",
    pollIntervalSeconds: 900,
    consecutiveFailures: 0,
  });

  // Record discovery source
  const [discoverySource] = await db
    .insert(creatorDiscoverySources)
    .values({
      creatorId: newCreator!.id,
      sourceType: input.sourceType || "MANUAL",
      sourceReference: `@${xUser.username}`,
      discoveredBy: input.submittedByUserId || null,
      notes: input.notes || null,
    })
    .returning();

  return {
    creator: newCreator!,
    isExisting: false,
    discoverySourceId: discoverySource?.id,
  };
}
