import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import {
  creators,
  db,
  oauthStates,
  users,
  xAccountConnections,
} from "@call-ledger/database";
import {
  decryptString,
  encryptString,
  generateOAuthState,
  generatePkce,
  hashOAuthState,
} from "./crypto.service";
import { getXClient } from "../integrations/x";

export interface InitiateOAuthResult {
  authorizationUrl: string;
  state: string;
}

export interface OAuthConnectionStatus {
  connected: boolean;
  xUsername?: string;
  xUserId?: string;
  connectionStatus?: string;
  connectedAt?: Date;
  scopes?: string;
}

/**
 * Initiates the OAuth 2.0 PKCE flow.
 * Scopes: tweet.read, users.read, offline.access
 */
export async function initiateXOAuth(userId?: string): Promise<InitiateOAuthResult> {
  const clientId = process.env.X_CLIENT_ID;
  const callbackUrl =
    process.env.X_CALLBACK_URL || "http://localhost:8000/api/integrations/x/callback";

  if (!clientId) {
    throw new Error("X_CLIENT_ID is not configured in environment variables");
  }

  const { rawState, stateHash } = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkce();

  // Store encrypted code verifier and hashed state in database with 10-minute expiry
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const codeVerifierEncrypted = encryptString(codeVerifier);

  await db.insert(oauthStates).values({
    stateHash,
    codeVerifierEncrypted,
    userId: userId || null,
    expiresAt,
  });

  const scopes = ["tweet.read", "users.read", "offline.access"].join(" ");

  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("state", rawState);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl: authUrl.toString(),
    state: rawState,
  };
}

/**
 * Handles OAuth 2.0 callback:
 * 1. Hashes incoming state and validates against stored state.
 * 2. Checks expiration & prevents replay attacks (consumed_at).
 * 3. Decrypts code verifier.
 * 4. Exchanges authorization code for tokens via X API.
 * 5. Calls /2/users/me to verify authenticated identity.
 * 6. Stores connection encrypted at rest.
 * 7. If this X user matches an existing creator, marks creator isXVerified = true.
 */
export async function handleXCallback(params: {
  code: string;
  state: string;
  error?: string;
}): Promise<{ xUsername: string; xUserId: string; userId?: string | null }> {
  if (params.error) {
    throw new Error(`X OAuth error: ${params.error}`);
  }

  const stateHash = hashOAuthState(params.state);

  // Look up stored state
  const [storedState] = await db
    .select()
    .from(oauthStates)
    .where(eq(oauthStates.stateHash, stateHash))
    .limit(1);

  if (!storedState) {
    throw new Error("Invalid or unverified OAuth state");
  }

  if (storedState.consumedAt) {
    throw new Error("OAuth state has already been consumed (replay prevention)");
  }

  if (new Date() > storedState.expiresAt) {
    throw new Error("OAuth state has expired");
  }

  // Mark state as consumed immediately
  await db
    .update(oauthStates)
    .set({ consumedAt: new Date() })
    .where(eq(oauthStates.id, storedState.id));

  // Decrypt PKCE verifier
  const codeVerifier = decryptString(storedState.codeVerifierEncrypted);
  const callbackUrl =
    process.env.X_CALLBACK_URL || "http://localhost:8000/api/integrations/x/callback";

  // Exchange code for tokens
  const xClient = getXClient();
  const tokenResponse = await xClient.exchangeCodeForToken({
    code: params.code,
    codeVerifier,
    redirectUri: callbackUrl,
  });

  // Fetch authenticated identity
  const { user: xUser } = await xClient.getAuthenticatedUser(tokenResponse.access_token);

  // Encrypt tokens before saving
  const accessTokenEncrypted = encryptString(tokenResponse.access_token);
  const refreshTokenEncrypted = tokenResponse.refresh_token
    ? encryptString(tokenResponse.refresh_token)
    : null;

  const tokenExpiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
    : null;

  // Resolve target application user ID
  let targetUserId = storedState.userId;
  if (!targetUserId) {
    // If no user was attached during initiation, link to first or create default
    const [existingUser] = await db.select().from(users).limit(1);
    if (existingUser) {
      targetUserId = existingUser.id;
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          email: `${xUser.username.toLowerCase()}@callledger.internal`,
          username: xUser.username.toLowerCase(),
          displayName: xUser.name,
          avatarUrl: xUser.profile_image_url || null,
        })
        .returning();
      targetUserId = newUser!.id;
    }
  }

  // Check if connection already exists for this user or X account
  const [existingConnection] = await db
    .select()
    .from(xAccountConnections)
    .where(eq(xAccountConnections.userId, targetUserId))
    .limit(1);

  if (existingConnection) {
    await db
      .update(xAccountConnections)
      .set({
        xUserId: xUser.id,
        xUsername: xUser.username,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        scopes: tokenResponse.scope || "tweet.read users.read offline.access",
        connectionStatus: "CONNECTED",
        updatedAt: new Date(),
      })
      .where(eq(xAccountConnections.id, existingConnection.id));
  } else {
    await db.insert(xAccountConnections).values({
      userId: targetUserId,
      xUserId: xUser.id,
      xUsername: xUser.username,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      tokenExpiresAt,
      scopes: tokenResponse.scope || "tweet.read users.read offline.access",
      connectionStatus: "CONNECTED",
    });
  }

  // If there is an existing creator with this xUserId, set isXVerified = true
  await db
    .update(creators)
    .set({
      isXVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(creators.xUserId, xUser.id));

  return {
    xUsername: xUser.username,
    xUserId: xUser.id,
    userId: targetUserId,
  };
}

/**
 * Returns safe connection information (never returning raw tokens).
 */
export async function getXConnectionStatus(userId?: string): Promise<OAuthConnectionStatus> {
  const query = db.select().from(xAccountConnections);
  const rows = userId
    ? await query.where(eq(xAccountConnections.userId, userId)).limit(1)
    : await query.limit(1);

  const connection = rows[0];

  if (!connection || connection.connectionStatus === "DISCONNECTED") {
    return { connected: false };
  }

  return {
    connected: connection.connectionStatus === "CONNECTED",
    xUsername: connection.xUsername,
    xUserId: connection.xUserId,
    connectionStatus: connection.connectionStatus,
    connectedAt: connection.connectedAt,
    scopes: connection.scopes || undefined,
  };
}

/**
 * Disconnects the linked X account.
 */
export async function disconnectXAccount(userId?: string): Promise<boolean> {
  const query = db.select().from(xAccountConnections);
  const rows = userId
    ? await query.where(eq(xAccountConnections.userId, userId)).limit(1)
    : await query.limit(1);

  const connection = rows[0];
  if (!connection) {
    return false;
  }

  await db
    .update(xAccountConnections)
    .set({
      connectionStatus: "DISCONNECTED",
      updatedAt: new Date(),
    })
    .where(eq(xAccountConnections.id, connection.id));

  return true;
}

/**
 * Cleans up expired oauth_states records.
 */
export async function cleanupExpiredOAuthStates(): Promise<number> {
  const now = new Date();
  const deleted = await db
    .delete(oauthStates)
    .where(lt(oauthStates.expiresAt, now))
    .returning();
  return deleted.length;
}

