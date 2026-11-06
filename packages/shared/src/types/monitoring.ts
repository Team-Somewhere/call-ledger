export interface SourcePost {
  id: string;
  creatorId: string;
  source: string;
  sourcePostId: string;
  sourceAuthorId: string;
  createdAtSource: Date | string;
  capturedAt: Date | string;
  lastSeenAt: Date | string;
  contentStorageStatus: "STORED" | "DELETED" | "WITHHELD" | "ID_ONLY";
  contentText?: string | null;
  publicMetrics?: Record<string, unknown> | null;
  editHistory?: unknown;
}

export interface CreatorMonitoringState {
  id: string;
  creatorId: string;
  monitoringStatus: "ACTIVE" | "PAUSED";
  pollIntervalSeconds: number;
  nextPollAt: Date | null;
  lastPollStartedAt?: Date | null;
  lastPollCompletedAt?: Date | null;
  lastSuccessfulPollAt?: Date | null;
  lastSeenPostId?: string | null;
  paginationToken?: string | null;
  consecutiveFailures: number;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  isLocked: boolean;
}

export interface CreatorPollLog {
  id: string;
  creatorId: string;
  startedAt: Date | string;
  completedAt?: Date | string | null;
  status: "SUCCESS" | "FAILED" | "RATE_LIMITED" | "SKIPPED" | "AUTHOR_MISMATCH";
  postsFetched: number;
  postsInserted: number;
  postsUpdated: number;
  postsRejected: number;
  httpStatus?: number | null;
  rateLimitRemaining?: number | null;
  rateLimitResetAt?: Date | string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

