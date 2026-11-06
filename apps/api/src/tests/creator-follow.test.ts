import assert from "node:assert";
import { describe, it, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  creatorIdentityLinks,
  creatorSources,
  creators,
  db,
  userCreatorFollows,
  users,
} from "@call-ledger/database";
import {
  createCreatorWithSource,
  findSourceByIdentity,
  getCreatorDetail,
  linkSourceToCreator,
} from "../services/creator-source.service";
import {
  followCreator,
  isFollowing,
  listFollowing,
  unfollowCreator,
} from "../services/creator-follow.service";
import { blueskyAdapter } from "../integrations/sources/bluesky.adapter";
import { xAdapter } from "../integrations/sources/x.adapter";

/**
 * Creator management & following tests.
 *
 * These require a live PostgreSQL database (DATABASE_URL). When no database is
 * configured the suite is skipped rather than failed, so `npm test` still works
 * without external services. External providers are never called — validated
 * source objects are constructed directly through the adapters' pure paths.
 */

const hasDb = Boolean(process.env.DATABASE_URL);

describe("Creator management & following (requires DATABASE_URL)", { skip: !hasDb }, () => {
  let userA: string;
  let userB: string;
  const createdCreatorIds: string[] = [];

  async function makeUser(label: string) {
    const [row] = await db
      .insert(users)
      .values({
        email: `${label}-${randomUUID()}@test.local`,
        displayName: label,
      })
      .returning();
    if (!row) throw new Error("failed to create test user");
    return row.id;
  }

  before(async () => {
    userA = await makeUser("user-a");
    userB = await makeUser("user-b");
  });

  after(async () => {
    if (createdCreatorIds.length > 0) {
      await db.delete(creators).where(inArray(creators.id, createdCreatorIds));
    }
    await db.delete(users).where(inArray(users.id, [userA, userB]));
  });

  async function createXCreator(handle: string) {
    const validated = await xAdapter.validate(handle);
    const result = await createCreatorWithSource({
      sourceType: "X",
      validated,
      userId: userA,
      createdVia: "USER_SUBMISSION",
    });
    createdCreatorIds.push(result.creator.id);
    return result;
  }

  async function createBlueskyCreator(handle: string) {
    // Construct the validated source directly: this test must not hit the network.
    const validated = {
      sourceType: "BLUESKY" as const,
      externalId: `did:plc:${handle.replace(/\W/g, "")}`,
      handle,
      canonicalUrl: `https://bsky.app/profile/${handle}`,
      displayName: handle,
      description: null,
      avatarUrl: null,
      status: "ACTIVE" as const,
      notices: [],
    };
    const result = await createCreatorWithSource({
      sourceType: "BLUESKY",
      validated,
      userId: userA,
    });
    createdCreatorIds.push(result.creator.id);
    return result;
  }

  it("adds an X creator with WAITING_FOR_AUTHORIZED_ACCESS status", async () => {
    const handle = `trader_${Math.random().toString(36).slice(2, 8)}`;
    const result = await createXCreator(handle);

    assert.strictEqual(result.source.status, "WAITING_FOR_AUTHORIZED_ACCESS");
    assert.strictEqual(result.isExistingCreator, false);
    assert.strictEqual(result.creator.sources.length, 1);
    assert.strictEqual(result.creator.sources[0]?.sourceType, "X");
  });

  it("adds a Bluesky creator", async () => {
    const handle = `bsky${Math.random().toString(36).slice(2, 8)}.bsky.social`;
    const result = await createBlueskyCreator(handle);

    assert.strictEqual(result.source.sourceType, "BLUESKY");
    assert.strictEqual(result.source.status, "ACTIVE");
  });

  it("prevents duplicate source identities (same creator is reused)", async () => {
    const handle = `dupe_${Math.random().toString(36).slice(2, 8)}`;
    const first = await createXCreator(handle);
    const second = await createXCreator(handle);

    assert.strictEqual(second.isExistingCreator, true);
    assert.strictEqual(second.creator.id, first.creator.id);

    const rows = await db
      .select()
      .from(creatorSources)
      .where(eq(creatorSources.creatorId, first.creator.id));
    assert.strictEqual(rows.length, 1, "only one source row may exist");
  });

  it("explicitly links a second source to an existing creator", async () => {
    const handle = `multi_${Math.random().toString(36).slice(2, 8)}`;
    const result = await createXCreator(handle);

    const linked = await linkSourceToCreator({
      creatorId: result.creator.id,
      validated: {
        sourceType: "BLUESKY",
        externalId: `did:plc:${handle}`,
        handle: `${handle}.bsky.social`,
        canonicalUrl: `https://bsky.app/profile/${handle}.bsky.social`,
        displayName: handle,
        description: null,
        avatarUrl: null,
        status: "ACTIVE",
        notices: [],
      },
      userId: userA,
    });

    assert.ok(linked.id);

    const detail = await getCreatorDetail(result.creator.id);
    assert.strictEqual(detail?.sources.length, 2);

    const linkRows = await db
      .select()
      .from(creatorIdentityLinks)
      .where(eq(creatorIdentityLinks.creatorSourceId, linked.id));
    assert.strictEqual(linkRows[0]?.relationshipType, "EXPLICIT_LINK");
  });

  it("refuses to link a source that already belongs to another creator", async () => {
    const handleA = `ownerA_${Math.random().toString(36).slice(2, 8)}`;
    const handleB = `ownerB_${Math.random().toString(36).slice(2, 8)}`;
    const a = await createXCreator(handleA);
    const b = await createXCreator(handleB);

    await assert.rejects(
      () =>
        linkSourceToCreator({
          creatorId: b.creator.id,
          validated: {
            sourceType: "X",
            externalId: null,
            handle: handleA,
            canonicalUrl: `https://x.com/${handleA}`,
            displayName: `@${handleA}`,
            description: null,
            avatarUrl: null,
            status: "WAITING_FOR_AUTHORIZED_ACCESS",
            notices: [],
          },
          userId: userA,
        }),
      /already linked/,
    );
  });

  it("follows a creator, prevents duplicate follows and unfollows", async () => {
    const result = await createXCreator(`flw_${Math.random().toString(36).slice(2, 8)}`);

    const first = await followCreator({ userId: userA, creatorId: result.creator.id });
    assert.strictEqual(first.created, true);

    const second = await followCreator({ userId: userA, creatorId: result.creator.id });
    assert.strictEqual(second.created, false, "duplicate follow must not create a row");

    const rows = await db
      .select()
      .from(userCreatorFollows)
      .where(eq(userCreatorFollows.creatorId, result.creator.id));
    assert.strictEqual(rows.length, 1);

    assert.strictEqual(await isFollowing(userA, result.creator.id), true);

    const unfollow = await unfollowCreator({ userId: userA, creatorId: result.creator.id });
    assert.strictEqual(unfollow.unfollowed, true);
    assert.strictEqual(await isFollowing(userA, result.creator.id), false);

    const list = await listFollowing(userA, { page: 1, limit: 50 });
    assert.ok(!list.data.some((r) => r.creator.id === result.creator.id));
  });

  it("lets multiple users follow the same global creator", async () => {
    const result = await createXCreator(`shared_${Math.random().toString(36).slice(2, 8)}`);

    await followCreator({ userId: userA, creatorId: result.creator.id });
    await followCreator({ userId: userB, creatorId: result.creator.id });

    const rows = await db
      .select()
      .from(userCreatorFollows)
      .where(eq(userCreatorFollows.creatorId, result.creator.id));
    assert.strictEqual(rows.length, 2);
    assert.notStrictEqual(rows[0]?.userId, rows[1]?.userId);

    // Exactly one creator row backs both follows.
    const creatorRows = await db
      .select()
      .from(creators)
      .where(eq(creators.id, result.creator.id));
    assert.strictEqual(creatorRows.length, 1);
  });

  it("rejects following a creator that does not exist", async () => {
    await assert.rejects(
      () => followCreator({ userId: userA, creatorId: randomUUID() }),
      /not found/,
    );
  });

  it("finds an existing source by identity", async () => {
    const handle = `ident_${Math.random().toString(36).slice(2, 8)}`;
    const created = await createXCreator(handle);
    const found = await findSourceByIdentity({
      sourceType: "X",
      externalId: null,
      handle,
      canonicalUrl: `https://x.com/${handle}`,
      displayName: null,
      description: null,
      avatarUrl: null,
      status: "WAITING_FOR_AUTHORIZED_ACCESS",
      notices: [],
    });
    assert.strictEqual(found?.creatorId, created.creator.id);
  });
});

describe("Bluesky adapter contract", () => {
  it("exposes the adapter interface for Phase 2B reuse", () => {
    assert.strictEqual(blueskyAdapter.sourceType, "BLUESKY");
    assert.strictEqual(typeof blueskyAdapter.validate, "function");
    assert.strictEqual(typeof blueskyAdapter.resolveCreator, "function");
    assert.strictEqual(typeof blueskyAdapter.fetchLatestPosts, "function");
  });
});
