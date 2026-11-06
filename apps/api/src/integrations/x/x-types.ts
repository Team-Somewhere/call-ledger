/**
 * X API v2 Type Definitions
 *
 * Based on official X API v2 documentation:
 * https://docs.x.com/x-api/users/user-lookup
 * https://docs.x.com/x-api/posts/timelines/user-post-timeline
 *
 * Only the fields we request are typed here.
 * Do not add fields we do not request.
 */

export interface XUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  verified?: boolean;
  created_at?: string;
}

export interface XPost {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  edit_history_tweet_ids?: string[];
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count?: number;
    impression_count?: number;
  };
  referenced_tweets?: Array<{
    type: "retweeted" | "quoted" | "replied_to";
    id: string;
  }>;
}

export interface XApiSingleUserResponse {
  data?: XUser;
  errors?: XApiRawErrorPayload[];
}

export interface XApiPostsResponse {
  data?: XPost[];
  meta?: {
    newest_id?: string;
    oldest_id?: string;
    result_count: number;
    next_token?: string;
  };
  errors?: XApiRawErrorPayload[];
}

export interface XApiRawErrorPayload {
  value?: string;
  detail?: string;
  title?: string;
  type?: string;
  status?: number;
}

export interface XTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface XRateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface GetUserPostsOptions {
  maxResults?: number;
  sinceId?: string;
  untilId?: string;
  paginationToken?: string;
  tweetFields?: string[];
  expansions?: string[];
}

export interface XPostsResult {
  posts: XPost[];
  nextToken?: string;
  newestId?: string;
  resultCount: number;
  rateLimit?: XRateLimitInfo;
}

