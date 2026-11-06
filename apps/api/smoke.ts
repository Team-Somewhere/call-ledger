import { privateKeyToAccount } from "viem/accounts";

const BASE = "http://localhost:8000/api";
const acct = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json();
  return { status: res.status, body };
}

const log = (label: string, v: unknown) => console.log(`\n### ${label}\n`, JSON.stringify(v, null, 1).slice(0, 900));

// 1. Wallet nonce + signature
const n = await call("/auth/wallet/nonce", { method: "POST", body: JSON.stringify({ address: acct.address }) });
console.log("nonce status", n.status);
const signature = await acct.signMessage({ message: n.body.data.message });
const v = await call("/auth/wallet/verify", { method: "POST", body: JSON.stringify({ address: acct.address, nonce: n.body.data.nonce, signature }) });
console.log("verify status", v.status, "isNewUser:", v.body.data?.isNewUser);
const token = v.body.data.token;
const auth = { "x-wallet-session": token };

// 2. Replay the same nonce -> must fail
const replay = await call("/auth/wallet/verify", { method: "POST", body: JSON.stringify({ address: acct.address, nonce: n.body.data.nonce, signature }) });
console.log("replay status (expect 401):", replay.status, replay.body.error?.code);

// 3. Resolve an X creator (no network call to X)
const handle = "trader_" + Math.random().toString(36).slice(2, 7);
const r = await call("/creators/resolve", { method: "POST", body: JSON.stringify({ sourceType: "X", username: handle }) });
log("resolve X", { status: r.status, status_: r.body.data?.status, url: r.body.data?.canonicalUrl });

// 4. Create creator (requires auth)
const c = await call("/creators", { method: "POST", headers: auth, body: JSON.stringify({ sourceType: "X", username: handle }) });
log("create X creator", { status: c.status, creatorId: c.body.data?.creator?.id, sourceStatus: c.body.data?.source?.status });
const creatorId = c.body.data.creator.id;

// 5. Duplicate create -> reuses same creator
const dup = await call("/creators", { method: "POST", headers: auth, body: JSON.stringify({ sourceType: "X", username: handle }) });
log("duplicate create", { status: dup.status, sameCreator: dup.body.data?.creator?.id === creatorId, alreadyExisted: dup.body.data?.alreadyExisted });

// 6. Follow (twice -> idempotent)
const f1 = await call(`/creators/${creatorId}/follow`, { method: "POST", headers: auth, body: "{}" });
const f2 = await call(`/creators/${creatorId}/follow`, { method: "POST", headers: auth, body: "{}" });
log("follow x2", { s1: f1.status, s2: f2.status, created1: f1.body.data?.created, created2: f2.body.data?.created });

// 7. Following list
const fl = await call("/me/following", { headers: auth });
log("following list", { status: fl.status, total: fl.body.meta?.total, firstStatus: fl.body.data?.[0]?.creator?.sources?.[0]?.status });

// 8. Unfollow
const uf = await call(`/creators/${creatorId}/follow`, { method: "DELETE", headers: auth });
log("unfollow", { status: uf.status, unfollowed: uf.body.data?.unfollowed });

// 9. Unauthorized access
const unauth = await call("/me/following");
console.log("\nunauth following (expect 401):", unauth.status, unauth.body.error?.code);

// 10. Monitoring overview
const mo = await call("/monitoring/sources/overview");
log("monitoring overview", { status: mo.status, xEnabled: mo.body.data?.configuration?.xIngestionEnabled, firecrawlConfigured: mo.body.data?.configuration?.firecrawlConfigured, counts: mo.body.data?.sourceCounts });
