import type { CreatorStatus } from "../constants/statuses";

export interface Creator {
  id: string;
  displayName: string;
  xUserId: string;
  xUsername: string;
  bio: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  status: CreatorStatus;
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
  createdAt: Date;
}

export interface CreatorWithMetrics extends Creator {
  metrics?: CreatorMetrics | null;
  followersCount?: number;
}
