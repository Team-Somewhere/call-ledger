import {
  XApiPostsResponse,
  XApiSingleUserResponse,
  XPostsResult,
  XRateLimitInfo,
  XTokenResponse,
  XUser,
  GetUserPostsOptions,
} from "./x-types";
import { XApiError, categorizeHttpError } from "./x-errors";

export interface XClientOptions {
  bearerToken?: string;
  clientId?: string;
  clientSecret?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export class XClient {
  private bearerToken?: string;
  private clientId?: string;
  private clientSecret?: string;
  private fetchFn: typeof fetch;
  private timeoutMs: number;
  private baseUrl = "https://api.x.com/2";

  constructor(options: XClientOptions = {}) {
    this.bearerToken = options.bearerToken || process.env.X_BEARER_TOKEN;
    this.clientId = options.clientId || process.env.X_CLIENT_ID;
    this.clientSecret = options.clientSecret || process.env.X_CLIENT_SECRET;
    this.fetchFn = options.fetchFn || fetch;
    this.timeoutMs = options.timeoutMs || 10000;
  }

  private extractRateLimit(headers: Headers): XRateLimitInfo | undefined {
    const limit = headers.get("x-rate-limit-limit");
    const remaining = headers.get("x-rate-limit-remaining");
    const reset = headers.get("x-rate-limit-reset");

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        resetAt: new Date(parseInt(reset, 10) * 1000),
      };
    }
    return undefined;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { authHeader?: string } = {},
  ): Promise<{ data: T; rateLimit?: XRateLimitInfo }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers = new Headers(options.headers || {});
    if (options.authHeader) {
      headers.set("Authorization", options.authHeader);
    } else if (this.bearerToken) {
      headers.set("Authorization", `Bearer ${this.bearerToken}`);
    }

    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
        throw new XApiError("X API request timed out", "NETWORK_ERROR");
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new XApiError(`Network error communicating with X API: ${message}`, "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }

    const rateLimit = this.extractRateLimit(response.headers);

    if (!response.ok) {
      let body: unknown;
      const text = await response.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      throw categorizeHttpError(response.status, response.headers, body);
    }

    const data = (await response.json()) as T;
    return { data, rateLimit };
  }

  /**
   * Look up an X user by username using official X API v2.
   * Endpoint: GET /2/users/by/username/:username
   */
  async getUserByUsername(username: string): Promise<{ user: XUser; rateLimit?: XRateLimitInfo }> {
    const cleanUsername = username.replace(/^@/, "").trim();
    const fields = "user.fields=id,name,username,description,profile_image_url,public_metrics,verified,created_at";
    const res = await this.request<XApiSingleUserResponse>(
      `/users/by/username/${encodeURIComponent(cleanUsername)}?${fields}`,
    );

    if (!res.data.data) {
      throw new XApiError(`User @${cleanUsername} not found on X`, "NOT_FOUND", 404);
    }

    return { user: res.data.data, rateLimit: res.rateLimit };
  }

  /**
   * Look up the authenticated user using OAuth 2.0 user access token.
   * Endpoint: GET /2/users/me
   */
  async getAuthenticatedUser(accessToken: string): Promise<{ user: XUser; rateLimit?: XRateLimitInfo }> {
    const fields = "user.fields=id,name,username,description,profile_image_url,public_metrics,verified";
    const res = await this.request<XApiSingleUserResponse>(`/users/me?${fields}`, {
      authHeader: `Bearer ${accessToken}`,
    });

    if (!res.data.data) {
      throw new XApiError("Could not retrieve authenticated user profile", "UNAUTHORIZED", 401);
    }

    return { user: res.data.data, rateLimit: res.rateLimit };
  }

  /**
   * Fetch recent posts for a specific X user ID.
   * Endpoint: GET /2/users/:id/tweets
   */
  async getUserPosts(
    userId: string,
    options: GetUserPostsOptions = {},
    userAccessToken?: string,
  ): Promise<XPostsResult> {
    const params = new URLSearchParams();
    params.set("max_results", String(options.maxResults || 20));
    params.set(
      "tweet.fields",
      (
        options.tweetFields || [
          "id",
          "text",
          "author_id",
          "created_at",
          "edit_history_tweet_ids",
          "public_metrics",
          "referenced_tweets",
        ]
      ).join(","),
    );

    if (options.sinceId) {
      params.set("since_id", options.sinceId);
    }
    if (options.untilId) {
      params.set("until_id", options.untilId);
    }
    if (options.paginationToken) {
      params.set("pagination_token", options.paginationToken);
    }

    const endpoint = `/users/${encodeURIComponent(userId)}/tweets?${params.toString()}`;
    const reqOptions: RequestInit & { authHeader?: string } = {};

    if (userAccessToken) {
      reqOptions.authHeader = `Bearer ${userAccessToken}`;
    }

    const res = await this.request<XApiPostsResponse>(endpoint, reqOptions);

    return {
      posts: res.data.data || [],
      nextToken: res.data.meta?.next_token,
      newestId: res.data.meta?.newest_id,
      resultCount: res.data.meta?.result_count || 0,
      rateLimit: res.rateLimit,
    };
  }

  /**
   * Exchanges an authorization code for an OAuth 2.0 access token using PKCE.
   * Endpoint: POST https://api.x.com/2/oauth2/token
   */
  async exchangeCodeForToken(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId?: string;
  }): Promise<XTokenResponse> {
    const cId = params.clientId || this.clientId;
    if (!cId) {
      throw new XApiError("X_CLIENT_ID is not configured", "UNAUTHORIZED");
    }

    const body = new URLSearchParams({
      code: params.code,
      grant_type: "authorization_code",
      client_id: cId,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (this.clientSecret) {
      const basicAuth = Buffer.from(`${cId}:${this.clientSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${basicAuth}`;
    }

    const response = await this.fetchFn("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw categorizeHttpError(response.status, response.headers, errText);
    }

    return (await response.json()) as XTokenResponse;
  }

  /**
   * Refreshes an expired OAuth 2.0 access token using a refresh token.
   */
  async refreshToken(refreshToken: string, clientId?: string): Promise<XTokenResponse> {
    const cId = clientId || this.clientId;
    if (!cId) {
      throw new XApiError("X_CLIENT_ID is not configured", "UNAUTHORIZED");
    }

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      client_id: cId,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (this.clientSecret) {
      const basicAuth = Buffer.from(`${cId}:${this.clientSecret}`).toString("base64");
      headers["Authorization"] = `Basic ${basicAuth}`;
    }

    const response = await this.fetchFn("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw categorizeHttpError(response.status, response.headers, errText);
    }

    return (await response.json()) as XTokenResponse;
  }
}

// Singleton default client
let defaultClient: XClient | null = null;
export function getXClient(): XClient {
  if (!defaultClient) {
    defaultClient = new XClient();
  }
  return defaultClient;
}
