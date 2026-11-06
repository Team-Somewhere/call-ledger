import type { CreatorStatus } from "../constants/statuses";

export interface Creator {
  id: string;
  displayName: string;
  description: string | null;
  /**
   * @deprecated X-specific legacy columns. Phase 2A made creators source-agnostic;
   * X identity now lives in `creator_sources`. These remain on the record for
   * backwards compatibility with Phase 1/2 X ingestion.
   */
  xUserId: string | null;
  xUsername: string | null;
  bio: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  status: CreatorStatus;
  discoverySource?: string;
  qualificationScore?: number | null;
  qualificationNotes?: string | null;
  qualifiedBy?: string | null;
  qualifiedAt?: Date | null;
  isXVerified: boolean;
  monitoringEnabled: boolean;
  lastPolledAt?: Date | null;
  lastPostAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorMetrics {
  id: string;
  creatorId: string;
  totalSignals: number;
  verifiedSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRate: string; // Decimal representation
  averageReturn: string; // Decimal representation
  cumulativeReturn: string; // Decimal representation
  lastSignalAt: Date | null;
  calculatedAt: Date;
}

export interface CreatorFollow {
  id: string;
  userId: string;
  creatorId: string;
  isActive: boolean;
  notificationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorWithMetrics extends Creator {
  metrics?: CreatorMetrics | null;
  followersCount?: number;
}
