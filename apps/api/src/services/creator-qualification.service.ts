import { eq } from "drizzle-orm";
import { creatorMonitoring, creators, db } from "@call-ledger/database";
import type { CreatorStatus } from "@call-ledger/shared";

export interface QualificationCriteriaInput {
  signalClarity: number; // weight 25% (0-100)
  tradingActivity: number; // weight 15% (0-100)
  historicalTrackRecord: number; // weight 25% (0-100)
  consistency: number; // weight 15% (0-100)
  verifiability: number; // weight 20% (0-100)
}

export interface QualifyCreatorInput {
  creatorId: string;
  reviewerId?: string;
  score?: number;
  criteria?: QualificationCriteriaInput;
  notes?: string;
}

/**
 * Calculates weighted score from criteria:
 * - Signal clarity: 25%
 * - Trading activity: 15%
 * - Historical track record: 25%
 * - Consistency: 15%
 * - Verifiability: 20%
 */
export function calculateQualificationScore(criteria: QualificationCriteriaInput): number {
  const score =
    criteria.signalClarity * 0.25 +
    criteria.tradingActivity * 0.15 +
    criteria.historicalTrackRecord * 0.25 +
    criteria.consistency * 0.15 +
    criteria.verifiability * 0.2;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Valid state transitions:
 * DISCOVERED -> PENDING_VERIFICATION, QUALIFIED, REJECTED
 * PENDING_VERIFICATION -> QUALIFIED, REJECTED
 * QUALIFIED -> MONITORING, INACTIVE, REJECTED, SUSPENDED
 * MONITORING -> INACTIVE, SUSPENDED, REJECTED
 * INACTIVE -> QUALIFIED, MONITORING
 * REJECTED -> none (or manual override by admin)
 * SUSPENDED -> INACTIVE, REJECTED (or reactivate to previous state)
 */
export function isValidTransition(from: CreatorStatus, to: CreatorStatus): boolean {
  if (from === to) return true;
  switch (from) {
    case "DISCOVERED":
      return ["PENDING_VERIFICATION", "QUALIFIED", "REJECTED"].includes(to);
    case "PENDING_VERIFICATION":
      return ["QUALIFIED", "REJECTED"].includes(to);
    case "QUALIFIED":
      return ["MONITORING", "INACTIVE", "REJECTED", "SUSPENDED"].includes(to);
    case "MONITORING":
      return ["QUALIFIED", "INACTIVE", "SUSPENDED", "REJECTED"].includes(to);
    case "INACTIVE":
      return ["QUALIFIED", "MONITORING", "REJECTED"].includes(to);
    case "SUSPENDED":
      return ["QUALIFIED", "INACTIVE", "REJECTED"].includes(to);
    case "REJECTED":
      return ["DISCOVERED", "PENDING_VERIFICATION"].includes(to); // admin reset
    default:
      return false;
  }
}

/**
 * Qualifies a creator with a 0-100 score and notes.
 */
export async function qualifyCreator(input: QualifyCreatorInput) {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, input.creatorId))
    .limit(1);

  if (!creator) {
    throw new Error(`Creator with ID ${input.creatorId} not found`);
  }

  const computedScore = input.criteria
    ? calculateQualificationScore(input.criteria)
    : input.score ?? 75;

  const targetStatus: CreatorStatus = computedScore >= 60 ? "QUALIFIED" : "PENDING_VERIFICATION";

  const [updated] = await db
    .update(creators)
    .set({
      status: targetStatus,
      qualificationScore: computedScore,
      qualificationNotes: input.notes || creator.qualificationNotes,
      qualifiedBy: input.reviewerId || null,
      qualifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creators.id, input.creatorId))
    .returning();

  return updated;
}

/**
 * Rejects a creator.
 * Automatically halts any active monitoring.
 */
export async function rejectCreator(creatorId: string, notes?: string) {
  const [updated] = await db
    .update(creators)
    .set({
      status: "REJECTED",
      monitoringEnabled: false,
      qualificationNotes: notes,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId))
    .returning();

  if (!updated) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  // Update monitoring state to PAUSED
  await db
    .update(creatorMonitoring)
    .set({
      monitoringStatus: "PAUSED",
      updatedAt: new Date(),
    })
    .where(eq(creatorMonitoring.creatorId, creatorId));

  return updated;
}

/**
 * Suspends a creator (stops polling immediately).
 */
export async function suspendCreator(creatorId: string, reason?: string) {
  const [updated] = await db
    .update(creators)
    .set({
      status: "SUSPENDED",
      monitoringEnabled: false,
      qualificationNotes: reason,
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId))
    .returning();

  if (!updated) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  await db
    .update(creatorMonitoring)
    .set({
      monitoringStatus: "PAUSED",
      updatedAt: new Date(),
    })
    .where(eq(creatorMonitoring.creatorId, creatorId));

  return updated;
}

/**
 * Reactivates a suspended or inactive creator.
 */
export async function reactivateCreator(creatorId: string) {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId))
    .limit(1);

  if (!creator) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  const [updated] = await db
    .update(creators)
    .set({
      status: "QUALIFIED",
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId))
    .returning();

  return updated;
}

