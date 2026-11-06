import type {
  FlashQuoteRequestInput,
  FlashSubmitOrderRequestInput,
  Order,
  OrderStatus,
  VerifiedAsset,
} from "@call-ledger/shared";
import type {
  FlashQuoteResponse,
  FlashOrderStatusResponse,
} from "@call-ledger/definitive";

/**
 * Browser API client.
 *
 * The Next.js app talks to the Express API directly (NEXT_PUBLIC_API_URL).
 * The wallet session token is attached as a header. A connected wallet address
 * alone is never treated as authentication.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const SESSION_KEY = "callledger.wallet.session";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(SESSION_KEY, token);
  else window.localStorage.removeItem(SESSION_KEY);
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  meta?: unknown;
  error?: ApiError;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: unknown }> {
  const token = getSessionToken();

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-wallet-session": token } : {}),
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON response (e.g. gateway error)
  }

  if (!res.ok || !payload?.success) {
    const rawMessage = payload?.error?.message;
    const errorMessage =
      typeof rawMessage === "string"
        ? rawMessage
        : typeof rawMessage === "object" && rawMessage !== null
          ? JSON.stringify(rawMessage)
          : `Request failed with status ${res.status}`;

    throw new ApiRequestError(
      payload?.error?.code ?? "REQUEST_FAILED",
      errorMessage,
      res.status,
    );
  }

  return { data: payload.data as T, meta: payload.meta };
}

export const api = {
  // Wallet auth
  requestNonce: (address: string) =>
    apiFetch<{
      address: string;
      nonce: string;
      message: string;
      domain: string;
      expiresAt: string;
    }>("/auth/wallet/nonce", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),

  verifyWallet: (address: string, nonce: string, signature: string, message?: string) =>
    apiFetch<{
      token: string;
      user: { id: string; address: string; displayName: string | null };
      isNewUser: boolean;
    }>("/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify({ address, nonce, signature, message }),
    }),

  guestLogin: (address?: string) =>
    apiFetch<{
      token: string;
      user: { id: string; address: string; displayName: string | null };
      isNewUser: boolean;
    }>("/auth/wallet/guest", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),

  me: () =>
    apiFetch<{ userId: string; address: string; isAdmin: boolean }>("/auth/me"),

  // Creator sources
  resolveSource: (body: Record<string, unknown>) =>
    apiFetch<ResolvedSourcePreview>("/creators/resolve", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createCreator: (body: Record<string, unknown>) =>
    apiFetch<CreateCreatorResponse>("/creators", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCreators: (params: string) =>
    apiFetch<CreatorListItem[]>(`/creators${params}`),

  getCreator: (id: string) =>
    apiFetch<CreatorDetailResponse>(`/creators/${id}`),

  followCreator: (id: string) =>
    apiFetch<unknown>(`/creators/${id}/follow`, { method: "POST" }),

  unfollowCreator: (id: string) =>
    apiFetch<unknown>(`/creators/${id}/follow`, { method: "DELETE" }),

  listFollowing: (params: string) =>
    apiFetch<FollowingItem[]>(`/me/following${params}`),

  activity: (params: string) =>
    apiFetch<ActivityPost[]>(`/me/activity${params}`),

  creatorPosts: (creatorId: string, params: string) =>
    apiFetch<ActivityPost[]>(`/creators/${creatorId}/posts${params}`),

  refreshCreator: (creatorId: string) =>
    apiFetch<{ refreshed: boolean; postsInserted: number }>(
      `/creators/${creatorId}/refresh`,
      { method: "POST" },
    ),

  monitoringDashboard: () =>
    apiFetch<MonitoringDashboard>("/monitoring/overview"),

  monitoringLogs: (limit = 25) =>
    apiFetch<MonitoringLog[]>(`/monitoring/logs?limit=${limit}`),

  creatorSourceStatus: (sourceId: string) =>
    apiFetch<CreatorSourceStatus>(`/creator-sources/${sourceId}/status`),

  deleteSource: (sourceId: string) =>
    apiFetch<unknown>(`/creator-sources/${sourceId}`, { method: "DELETE" }),

  monitoringOverview: () =>
    apiFetch<{
      configuration: {
        xIngestionEnabled: boolean;
        firecrawlEnabled: boolean;
        firecrawlConfigured: boolean;
        adapters: Array<{
          sourceType: string;
          ingestionSupported: boolean;
          description: string;
        }>;
      };
      sourceCounts: Record<string, number>;
      totals: {
        sources: number;
        activeSources: number;
        waitingForAuthorizedAccess: number;
      };
    }>("/monitoring/sources/overview"),

  // --- Archive (Arkiv reads) ---
  archivePosts: (params: string) =>
    apiFetch<ArchivedPost[]>(`/archive/posts${params}`),

  archivePost: (entityKey: string) =>
    apiFetch<ArchivedPost>(`/archive/posts/${encodeURIComponent(entityKey)}`),

  archiveTraderPosts: (username: string, params: string) =>
    apiFetch<ArchivedPost[]>(`/archive/traders/${encodeURIComponent(username)}/posts${params}`),

  archiveStats: () =>
    apiFetch<{
      arkiv: {
        totalPosts: number;
        tradingRelatedPosts: number;
        uniqueTraders: number;
        oldestPost: string | null;
        newestPost: string | null;
      };
      local: { totalRecords: number; recordsExpiringWithin30Days: number };
      configured: boolean;
      source: string;
    }>("/archive/stats"),

  archiveStatus: () =>
    apiFetch<{
      enabled: boolean;
      arkivConfigured: boolean;
      arkivWriteConfigured: boolean;
      trackedXSources: number;
      activeSources: number;
      recentArchived: number;
    }>("/archive/status"),

  // --- Phase 3: Arkiv transaction history ---
  arkivTransactions: (params = "") =>
    apiFetch<ArkivTransaction[]>(`/arkiv/transactions${params}`),

  arkivLatestTransaction: () =>
    apiFetch<ArkivTransaction | null>("/arkiv/transactions/latest"),

  // --- Phase 3: Worker monitoring status ---
  workerStatus: () =>
    apiFetch<WorkerStatus>("/monitoring/status"),

  monitoringTraders: () =>
    apiFetch<TraderMonitoringState[]>("/monitoring/traders"),

  patchTraderMonitoring: (traderId: string, enabled: boolean) =>
    apiFetch<{ traderId: string; enabled: boolean }>(
      `/monitoring/traders/${traderId}`,
      { method: "PATCH", body: JSON.stringify({ enabled }) },
    ),

  monitoringPause: () =>
    apiFetch<{ paused: boolean }>("/monitoring/pause", { method: "POST" }),

  monitoringResume: () =>
    apiFetch<{ resumed: boolean }>("/monitoring/resume", { method: "POST" }),

  monitoringRunNow: () =>
    apiFetch<{ triggered: boolean; sourcesReset: number; message: string }>(
      "/monitoring/run-now",
      { method: "POST" },
    ),

  // Definitive Flash trading
  getOrderConfig: () =>
    apiFetch<{
      configured: boolean;
      supportedChains: Record<string, { name: string; chainId: number; explorerBaseUrl: string }>;
      verifiedAssets: Record<string, Record<string, VerifiedAsset>>;
    }>("/orders/config"),

  requestQuote: (payload: FlashQuoteRequestInput) =>
    apiFetch<FlashQuoteResponse>("/orders/quote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitOrder: (payload: FlashSubmitOrderRequestInput) =>
    apiFetch<{ order: Order; flashResponse: { orderId: string; status: OrderStatus } }>(
      "/orders/submit",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),

  getOrder: (orderId: string) =>
    apiFetch<{ order: Order; flashStatus?: FlashOrderStatusResponse }>(`/orders/${orderId}`),

  getOrders: () => apiFetch<Order[]>("/orders"),

  getWalletBalances: async (address: string): Promise<WalletBalancesResponse> => {
    const res = await fetch(`/api/wallet/balances?address=${encodeURIComponent(address)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch wallet balances: HTTP ${res.status}`);
    }
    return (await res.json()) as WalletBalancesResponse;
  },
};

export interface WalletTokenBalance {
  symbol: string;
  name: string;
  chain: string;
  chainId: number;
  amount: number;
  amountFormatted: string;
  priceUsd: number;
  valueUsd: number;
  valueUsdFormatted: string;
  tokenAddress?: string;
  explorerUrl: string;
}

export interface WalletBalancesResponse {
  address: string;
  ethPriceUsd: number;
  totalUsd: number;
  totalUsdFormatted: string;
  tokens: WalletTokenBalance[];
  allTrackedTokens: WalletTokenBalance[];
  chainBreakdown: {
    chain: string;
    chainId: number;
    valueUsd: number;
    percentage: number;
  }[];
  updatedAt: string;
}

export interface SourceSummary {
  id: string;
  sourceType: "X" | "BLUESKY" | "RSS" | "WEBSITE";
  handle: string | null;
  canonicalUrl: string;
  status: "ACTIVE" | "WAITING_FOR_AUTHORIZED_ACCESS" | "DISABLED" | "ERROR";
  verificationStatus: "UNVERIFIED" | "SELF_VERIFIED" | "ADMIN_VERIFIED";
  lastFetchedAt: string | null;
  nextFetchAt: string | null;
  lastError: string | null;
}

export interface CreatorListItem {
  id: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  sources: SourceSummary[];
}

export interface CreatorDetailResponse extends CreatorListItem {
  updatedAt: string;
  followersCount: number;
  isFollowing: boolean;
  sources: Array<
    SourceSummary & {
      externalId: string | null;
      linkRelationshipType: string | null;
      linkVerificationMethod: string | null;
    }
  >;
}

export interface FollowingItem {
  followId: string;
  followedAt: string;
  notificationEnabled: boolean;
  creator: CreatorListItem;
}

export interface ActivityPost {
  id: string;
  externalPostId: string;
  sourceType: "X" | "BLUESKY" | "RSS" | "WEBSITE";
  authorExternalId: string | null;
  authorHandle: string | null;
  title: string | null;
  content: string | null;
  canonicalUrl: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  mediaUrls: string[] | null;
  isReply: boolean;
  isRepost: boolean;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  sourceId: string;
  sourceHandle: string | null;
  sourceUrl: string;
  sourceStatus: string;
}

export interface MonitoringDashboard {
  totals: {
    creators: number;
    sources: number;
    activeSources: number;
    waitingForAuthorizedAccess: number;
    postsCollected: number;
    postsCollectedToday: number;
    failedRunsLast24Hours: number;
    sourcesBackingOff: number;
  };
  sourcesByType: Record<string, number>;
  lastSuccessfulFetch: string | null;
}

export interface MonitoringLog {
  id: string;
  sourceId: string;
  sourceType: "X" | "BLUESKY" | "RSS" | "WEBSITE";
  status: string;
  itemsFound: number;
  itemsInserted: number;
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  sourceHandle: string | null;
  sourceUrl: string;
}

export interface CreatorSourceStatus {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  sourceType: "X" | "BLUESKY" | "RSS" | "WEBSITE";
  handle: string | null;
  canonicalUrl: string;
  status: string;
  lastFetchedAt: string | null;
  nextFetchAt: string | null;
  lastError: string | null;
  retryCount: number;
  consecutiveFailures: number;
}

export interface ResolvedSourcePreview {
  sourceType: "X" | "BLUESKY" | "RSS" | "WEBSITE";
  handle: string | null;
  externalId: string | null;
  canonicalUrl: string;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  status: SourceSummary["status"];
  notices: string[];
  existingCreatorId: string | null;
  alreadyExists: boolean;
}

export interface CreateCreatorResponse {
  creator: CreatorDetailResponse;
  source: SourceSummary;
  notices: string[];
  alreadyExisted: boolean;
}

export interface ArchivedPost {
  entityKey: string;
  txHash: string | null;
  ownerAddress: string | null;
  expiresAt: string | null;
  sourcePlatform: string;
  sourcePostId: string;
  authorUsername: string;
  authorDisplayName: string;
  postText: string;
  postUrl: string;
  originalCreatedAt: string | null;
  capturedAt: string;
  contentFidelity: string;
  captureProvider: string;
  tradingRelated: boolean;
  topics: string[];
  assets: string[];
  schemaVersion: string;
  // Enrichment from local DB
  localId?: string;
  localTxHash?: string | null;
  creatorDisplayName?: string | null;
  creatorId?: string | null;
}

// Phase 3: Arkiv transaction history
export interface ArkivTransaction {
  id: string;
  entityKey: string;
  txHash: string;
  sourcePostId: string;
  traderId: string | null;
  traderUsername: string | null;
  traderDisplayName: string | null;
  status: string;
  submittedAt: string;
  confirmedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  explorerUrl: string;
}

// Phase 3: Worker status
export interface WorkerStatus {
  reachable: boolean;
  status: "running" | "stopped" | "unknown";
  startedAt: string | null;
  lastCycleAt: string | null;
  nextCycleAt: string | null;
  totalCycles: number;
  lastCycleProcessed: number;
  intervalMinutes: number;
  budget: {
    date: string;
    usedRequests: number;
    maxRequests: number;
    remaining: number;
  } | null;
  arkivConfigured: boolean;
  arkivWriteConfigured: boolean;
  lastSuccessfulFetch: string | null;
  totalArchived: number;
  archivedLast24h: number;
}

// Phase 3: Per-trader monitoring state
export interface TraderMonitoringState {
  traderId: string;
  traderDisplayName: string;
  xUsername: string | null;
  monitoringEnabled: boolean;
  sourceId: string | null;
  sourceStatus: string | null;
  lastFetchedAt: string | null;
  nextFetchAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  postsArchived: number;
  lastArchivedAt: string | null;
}
