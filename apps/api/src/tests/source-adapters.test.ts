import assert from "node:assert";
import { describe, it } from "node:test";
import { X_UNAVAILABLE_MESSAGE } from "@call-ledger/shared";
import {
  extractXProfileAvatar,
  XAdapter,
  isValidXUsername,
  normalizeXUsername,
} from "../integrations/sources/x.adapter";
import {
  BlueskyAdapter,
  isValidBlueskyHandle,
} from "../integrations/sources/bluesky.adapter";
import { RssAdapter } from "../integrations/sources/rss.adapter";
import { FirecrawlClient } from "../integrations/firecrawl/firecrawl.client";
import { WebsiteAdapter } from "../integrations/sources/website.adapter";
import {
  assertSafeUrlStructure,
  blockedIpReason,
} from "../integrations/sources/ssrf";

const RSS_2_0 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Crypto Calls Daily</title>
    <link>https://example.com/feed</link>
    <description>Daily crypto trade ideas</description>
    <item>
      <title>Long ETH</title>
      <link>https://example.com/posts/1</link>
      <guid>post-1</guid>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
      <description>Bought ETH at 2200</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Trader</title>
  <link href="https://example.org/atom"/>
  <updated>2024-01-01T10:00:00Z</updated>
  <id>urn:uuid:feed-1</id>
  <entry>
    <title>SOL setup</title>
    <id>urn:uuid:entry-1</id>
    <link href="https://example.org/posts/sol"/>
    <updated>2024-01-01T10:00:00Z</updated>
    <summary>SOL breakout incoming</summary>
  </entry>
</feed>`;

const RSS_WITHOUT_GUID = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>No GUID Feed</title>
    <link>https://example.com/noguid</link>
    <description>No guids here</description>
    <item>
      <title>Item without guid</title>
      <link>https://example.com/noguid/1</link>
      <description>Body</description>
    </item>
  </channel>
</rss>`;

function rssAdapterReturning(body: string, status = 200): RssAdapter {
  const fetchImpl = (async () =>
    new Response(body, {
      status,
      headers: { "content-type": "application/rss+xml" },
    })) as unknown as typeof fetch;

  return new RssAdapter({
    fetchOptions: { fetchImpl, maxRedirects: 0 },
  });
}

describe("SSRF guard", () => {
  it("rejects localhost, private IPs and non-http protocols", () => {
    assert.throws(() => assertSafeUrlStructure("http://localhost/feed"));
    assert.throws(() => assertSafeUrlStructure("http://127.0.0.1/feed"));
    assert.throws(() => assertSafeUrlStructure("http://10.0.0.5/feed"));
    assert.throws(() =>
      assertSafeUrlStructure("http://169.254.169.254/latest"),
    );
    assert.throws(() => assertSafeUrlStructure("file:///etc/passwd"));
    assert.throws(() => assertSafeUrlStructure("ftp://example.com/feed"));
    assert.throws(() => assertSafeUrlStructure("http://user:pw@example.com/"));
  });

  it("accepts public http(s) URLs", () => {
    assert.ok(assertSafeUrlStructure("https://example.com/feed.xml"));
  });

  it("classifies blocked IP ranges", () => {
    assert.ok(blockedIpReason("127.0.0.1"));
    assert.ok(blockedIpReason("192.168.1.1"));
    assert.ok(blockedIpReason("::1"));
    assert.strictEqual(blockedIpReason("8.8.8.8"), null);
  });
});

describe("RSS adapter", () => {
  it("validates a valid RSS 2.0 feed and extracts the title", async () => {
    const adapter = rssAdapterReturning(RSS_2_0);
    const validated = await adapter.validate("https://example.com/feed.xml");
    assert.strictEqual(validated.sourceType, "RSS");
    assert.strictEqual(validated.displayName, "Crypto Calls Daily");
    assert.strictEqual(validated.status, "ACTIVE");
    assert.ok(validated.externalId);
  });

  it("validates a valid Atom feed", async () => {
    const adapter = rssAdapterReturning(ATOM);
    const validated = await adapter.validate("https://example.org/atom.xml");
    assert.strictEqual(validated.displayName, "Atom Trader");
  });

  it("handles items without GUIDs using a stable fallback id", async () => {
    const adapter = rssAdapterReturning(RSS_WITHOUT_GUID);
    const validated = await adapter.validate("https://example.com/noguid.xml");
    const result = await adapter.fetchLatestPosts({
      source: {
        id: "src",
        creatorId: "creator",
        sourceType: "RSS",
        externalId: validated.externalId,
        handle: validated.handle,
        canonicalUrl: validated.canonicalUrl,
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        displayName: validated.displayName,
        description: validated.description,
        avatarUrl: null,
        lastFetchedAt: null,
        nextFetchAt: null,
        lastCursor: null,
        lastError: null,
        lastErrorAt: null,
        retryCount: 0,
        providerMeta: { feedUrl: "https://example.com/noguid.xml" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      cursor: null,
    });
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.posts.length, 1);
    assert.ok(result.posts[0]?.sourcePostId, "fallback id must exist");
    assert.match(result.posts[0]?.contentHash ?? "", /^[a-f0-9]{64}$/);
  });

  it("rejects a malformed XML body", async () => {
    const adapter = rssAdapterReturning("<rss><channel><title>broken");
    await assert.rejects(() =>
      adapter.validate("https://example.com/broken.xml"),
    );
  });

  it("rejects an invalid URL", async () => {
    const adapter = new RssAdapter();
    await assert.rejects(() => adapter.validate("not a url"), /URL/i);
  });

  it("rejects SSRF targets before issuing a request", async () => {
    let called = false;
    const adapter = new RssAdapter({
      fetchOptions: {
        fetchImpl: (async () => {
          called = true;
          return new Response("");
        }) as unknown as typeof fetch,
      },
    });
    await assert.rejects(() => adapter.validate("http://127.0.0.1/feed"));
    assert.strictEqual(called, false, "no network call may be made");
  });

  it("surfaces an unavailable feed as a provider error", async () => {
    const adapter = new RssAdapter({
      fetchOptions: {
        fetchImpl: (async () =>
          new Response("nope", { status: 500 })) as unknown as typeof fetch,
        maxRedirects: 0,
      },
    });
    await assert.rejects(
      () => adapter.validate("https://example.com/feed"),
      /HTTP 500/,
    );
  });

  it("uses conditional headers and treats HTTP 304 as a successful empty poll", async () => {
    let requestHeaders: HeadersInit | undefined;
    const adapter = new RssAdapter({
      fetchOptions: {
        fetchImpl: (async (
          _url: string | URL | Request,
          init?: RequestInit,
        ) => {
          requestHeaders = init?.headers;
          return new Response(null, {
            status: 304,
            headers: {
              etag: '"feed-v2"',
              "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
            },
          });
        }) as unknown as typeof fetch,
      },
    });
    const result = await adapter.fetchLatestPosts({
      source: {
        id: "source-id",
        creatorId: "creator-id",
        sourceType: "RSS",
        externalId: null,
        handle: null,
        canonicalUrl: "https://example.com/feed.xml",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        displayName: "Example",
        description: null,
        avatarUrl: null,
        lastFetchedAt: new Date(),
        nextFetchAt: null,
        lastCursor: null,
        lastError: null,
        lastErrorAt: null,
        retryCount: 0,
        providerMeta: { feedUrl: "https://example.com/feed.xml" },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      cursor: null,
      conditional: {
        etag: '"feed-v1"',
        lastModified: "Tue, 31 Dec 2024 00:00:00 GMT",
      },
    });

    assert.deepStrictEqual(result.posts, []);
    assert.strictEqual(result.notModified, true);
    assert.strictEqual(result.etag, '"feed-v2"');
    assert.deepStrictEqual(
      new Headers(requestHeaders).get("if-none-match"),
      '"feed-v1"',
    );
    assert.ok(new Headers(requestHeaders).get("if-modified-since"));
  });
});

describe("Bluesky adapter", () => {
  const profile = {
    did: "did:plc:abc123",
    handle: "trader.bsky.social",
    displayName: "Trader",
    description: "Macro and majors",
    avatar: "https://cdn.bsky.app/avatar.jpg",
  };

  it("resolves a handle and stores the DID as the external identity", async () => {
    const adapter = new BlueskyAdapter({
      fetchImpl: (async () =>
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    });

    const validated = await adapter.validate("@trader.bsky.social");
    assert.strictEqual(validated.externalId, "did:plc:abc123");
    assert.strictEqual(validated.handle, "trader.bsky.social");
    assert.strictEqual(
      validated.canonicalUrl,
      "https://bsky.app/profile/trader.bsky.social",
    );
    assert.strictEqual(validated.status, "ACTIVE");
  });

  it("rejects an invalid handle without making a request", async () => {
    let called = false;
    const adapter = new BlueskyAdapter({
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });
    await assert.rejects(() => adapter.validate("not_a_handle"));
    assert.strictEqual(called, false);
  });

  it("handles a missing profile (404)", async () => {
    const adapter = new BlueskyAdapter({
      fetchImpl: (async () =>
        new Response("{}", { status: 400 })) as unknown as typeof fetch,
    });
    await assert.rejects(
      () => adapter.validate("ghost.bsky.social"),
      /No Bluesky profile/,
    );
  });

  it("surfaces API failures", async () => {
    const adapter = new BlueskyAdapter({
      fetchImpl: (async () =>
        new Response("{}", { status: 500 })) as unknown as typeof fetch,
    });
    await assert.rejects(
      () => adapter.validate("trader.bsky.social"),
      /HTTP 500/,
    );
  });

  it("surfaces rate limiting", async () => {
    const adapter = new BlueskyAdapter({
      fetchImpl: (async () =>
        new Response("{}", {
          status: 429,
          headers: { "retry-after": "30" },
        })) as unknown as typeof fetch,
    });
    await assert.rejects(
      () => adapter.validate("trader.bsky.social"),
      /rate limit/,
    );
  });

  it("preserves Bluesky pagination cursors and identifies author-feed replies/reposts", async () => {
    let requestedUrl = "";
    const adapter = new BlueskyAdapter({
      fetchImpl: (async (input: string | URL | Request) => {
        requestedUrl = String(input);
        return new Response(
          JSON.stringify({
            cursor: "older-page",
            feed: [
              {
                reason: { $type: "app.bsky.feed.defs#reasonRepost" },
                reply: { parent: {} },
                post: {
                  uri: "at://did:plc:abc/app.bsky.feed.post/post1",
                  author: {
                    did: "did:plc:other",
                    handle: "author.bsky.social",
                  },
                  record: {
                    text: "Post text",
                    createdAt: "2025-01-01T00:00:00Z",
                  },
                },
              },
              {
                post: {
                  uri: "at://did:plc:abc/app.bsky.feed.post/unavailable",
                  author: { did: "did:plc:abc", handle: "trader.bsky.social" },
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as unknown as typeof fetch,
    });
    const result = await adapter.fetchLatestPosts({
      source: {
        id: "source-id",
        creatorId: "creator-id",
        sourceType: "BLUESKY",
        externalId: "did:plc:abc",
        handle: "trader.bsky.social",
        canonicalUrl: "https://bsky.app/profile/trader.bsky.social",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        displayName: "Trader",
        description: null,
        avatarUrl: null,
        lastFetchedAt: null,
        nextFetchAt: null,
        lastCursor: null,
        lastError: null,
        lastErrorAt: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      cursor: "older-page-previous",
    });

    assert.strictEqual(
      new URL(requestedUrl).searchParams.get("cursor"),
      "older-page-previous",
    );
    assert.strictEqual(result.nextCursor, "older-page");
    assert.strictEqual(result.posts[0]?.isReply, true);
    assert.strictEqual(result.posts[0]?.isRepost, true);
    assert.strictEqual(result.posts[0]?.authorHandle, "author.bsky.social");
    assert.match(result.posts[0]?.contentHash ?? "", /^[a-f0-9]{64}$/);
    assert.strictEqual(result.posts[1]?.status, "UNAVAILABLE");
  });

  it("validates handle format", () => {
    assert.ok(isValidBlueskyHandle("trader.bsky.social"));
    assert.ok(!isValidBlueskyHandle("nope"));
    assert.ok(!isValidBlueskyHandle("did:plc:abc"));
  });
});

describe("Firecrawl / website adapter", () => {
  it("refuses to run without an API key", () => {
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: null,
      maxPagesPerRun: 5,
    });
    assert.strictEqual(client.enabled, false);
    assert.throws(() => client.assertAvailable(), /not enabled/);
  });

  it("refuses to run when disabled", () => {
    const client = new FirecrawlClient({
      enabled: false,
      apiKey: "key",
      maxPagesPerRun: 5,
    });
    assert.strictEqual(client.enabled, false);
    assert.throws(() => client.assertAvailable(), /not enabled/);
  });

  it("extracts a profile image from Firecrawl metadata", async () => {
    const profileImage =
      "https://pbs.twimg.com/profile_images/123/avatar_normal.jpg";
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "test-key",
      maxPagesPerRun: 1,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              markdown: "",
              metadata: { "og:image": profileImage },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as unknown as typeof fetch,
    });

    const result = await client.scrape("https://example.com");
    assert.strictEqual(result.imageUrl, profileImage);
  });

  it("rejects a website source without authorization confirmation", async () => {
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "key",
      maxPagesPerRun: 5,
    });
    const adapter = new WebsiteAdapter({ firecrawl: client });
    await assert.rejects(
      () => adapter.validate({ url: "https://example.com", authorized: false }),
      /authorized/,
    );
  });

  it("rejects an invalid URL", async () => {
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "key",
      maxPagesPerRun: 5,
    });
    const adapter = new WebsiteAdapter({ firecrawl: client });
    await assert.rejects(() =>
      adapter.validate({ url: "javascript:alert(1)", authorized: true }),
    );
  });

  it("normalizes an authorized page scrape into a source post", async () => {
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "test-key",
      maxPagesPerRun: 3,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              markdown: "Current site content",
              metadata: {
                title: "Site update",
                sourceURL: "https://example.com/news",
                publishedTime: "2025-01-02T03:04:05Z",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )) as unknown as typeof fetch,
    });
    const adapter = new WebsiteAdapter({ firecrawl: client });
    const result = await adapter.fetchLatestPosts({
      source: {
        id: "website-source",
        creatorId: "creator-id",
        sourceType: "WEBSITE",
        externalId: "example.com",
        handle: "example.com",
        canonicalUrl: "https://example.com/news",
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        displayName: "Example",
        description: null,
        avatarUrl: null,
        lastFetchedAt: null,
        nextFetchAt: null,
        lastCursor: null,
        lastError: null,
        lastErrorAt: null,
        retryCount: 0,
        crawlAuthorized: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      cursor: null,
    });

    assert.strictEqual(result.posts[0]?.title, "Site update");
    assert.strictEqual(result.posts[0]?.text, "Current site content");
    assert.strictEqual(
      result.posts[0]?.publishedAt?.toISOString(),
      "2025-01-02T03:04:05.000Z",
    );
    assert.match(result.posts[0]?.contentHash ?? "", /^[a-f0-9]{64}$/);
  });

  it("does not scrape a website without stored authorization", async () => {
    let called = false;
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "test-key",
      maxPagesPerRun: 1,
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });
    const adapter = new WebsiteAdapter({ firecrawl: client });
    await assert.rejects(
      () =>
        adapter.fetchLatestPosts({
          source: {
            id: "website-source",
            creatorId: "creator-id",
            sourceType: "WEBSITE",
            externalId: "example.com",
            handle: "example.com",
            canonicalUrl: "https://example.com/news",
            status: "ACTIVE",
            verificationStatus: "UNVERIFIED",
            displayName: "Example",
            description: null,
            avatarUrl: null,
            lastFetchedAt: null,
            nextFetchAt: null,
            lastCursor: null,
            lastError: null,
            lastErrorAt: null,
            retryCount: 0,
            crawlAuthorized: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          cursor: null,
        }),
      /not authorized/,
    );
    assert.strictEqual(called, false);
  });

  it("refuses Firecrawl targets on X", async () => {
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "key",
      maxPagesPerRun: 5,
      fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch,
    });
    await assert.rejects(
      () => client.scrape("https://x.com/trader"),
      /X\/Twitter/,
    );
  });

  it("surfaces provider failure without leaking the key", async () => {
    const client = new FirecrawlClient({
      enabled: true,
      apiKey: "super-secret-key",
      maxPagesPerRun: 5,
      fetchImpl: (async () =>
        new Response('{"error":"super-secret-key invalid"}', {
          status: 502,
        })) as unknown as typeof fetch,
    });
    await assert.rejects(
      () => client.scrape("https://example.com"),
      (err: Error) => {
        assert.ok(!err.message.includes("super-secret-key"));
        return true;
      },
    );
  });
});

describe("X adapter placeholder", () => {
  it("extracts a valid X profile image from profile metadata or markdown", () => {
    const profileImage =
      "https://pbs.twimg.com/profile_images/123/avatar_normal.jpg";
    assert.strictEqual(
      extractXProfileAvatar({ imageUrl: profileImage, markdown: null }),
      profileImage,
    );
    assert.strictEqual(
      extractXProfileAvatar({
        imageUrl: null,
        markdown: `![Trader](${profileImage})`,
      }),
      profileImage,
    );
  });

  it("ignores non-X and insecure profile image URLs", () => {
    assert.strictEqual(
      extractXProfileAvatar({
        imageUrl: "https://attacker.example/avatar.jpg",
        markdown: "![avatar](http://pbs.twimg.com/profile_images/avatar.jpg)",
      }),
      null,
    );
  });

  it("normalizes and validates X usernames", () => {
    assert.strictEqual(normalizeXUsername("@trader"), "trader");
    assert.strictEqual(normalizeXUsername("https://x.com/trader"), "trader");
    assert.ok(isValidXUsername("trader_01"));
    assert.ok(!isValidXUsername("bad handle!"));
  });

  it("marks X sources as WAITING_FOR_AUTHORIZED_ACCESS", async () => {
    const adapter = new XAdapter({ ingestionEnabled: false });
    const validated = await adapter.validate("@tradername");

    assert.strictEqual(validated.sourceType, "X");
    assert.strictEqual(validated.status, "WAITING_FOR_AUTHORIZED_ACCESS");
    assert.strictEqual(validated.canonicalUrl, "https://x.com/tradername");
    assert.ok(
      validated.notices.some((n) => n.includes("not currently available")),
    );
    assert.strictEqual(validated.externalId, null);
  });

  it("never produces fake posts", async () => {
    const adapter = new XAdapter({ ingestionEnabled: false });
    const result = await adapter.fetchLatestPosts({
      source: {
        id: "src",
        creatorId: "creator",
        sourceType: "X",
        externalId: null,
        handle: "tradername",
        canonicalUrl: "https://x.com/tradername",
        status: "WAITING_FOR_AUTHORIZED_ACCESS",
        verificationStatus: "UNVERIFIED",
        displayName: "@tradername",
        description: null,
        avatarUrl: null,
        lastFetchedAt: null,
        nextFetchAt: null,
        lastCursor: null,
        lastError: null,
        lastErrorAt: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      cursor: null,
    });

    assert.strictEqual(result.available, false);
    assert.strictEqual(result.posts.length, 0);
    assert.strictEqual(
      result.unavailableReason,
      "WAITING_FOR_AUTHORIZED_ACCESS",
    );
    assert.ok(adapter.unavailableMessage?.includes(X_UNAVAILABLE_MESSAGE));
  });

  it("makes no network requests", async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as unknown as typeof fetch;

    try {
      const adapter = new XAdapter({ ingestionEnabled: false });
      await adapter.validate("@tradername");
      await adapter.fetchLatestPosts({
        source: {} as never,
        cursor: null,
      });
      assert.strictEqual(called, false, "the X adapter must never fetch");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
