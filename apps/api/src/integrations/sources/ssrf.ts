import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SourceAdapterError } from "@call-ledger/shared";

/**
 * SSRF protection for outbound provider requests (RSS / Firecrawl / websites).
 *
 * We reject:
 * - non http(s) protocols
 * - URLs with credentials embedded
 * - localhost / *.localhost
 * - literal private, loopback, link-local, CGNAT, multicast, reserved IPs
 * - hostnames that resolve to any of the above (DNS rebinding check)
 *
 * Note: we do not block DNS names by *name* only — resolution is checked too.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((acc, part) => acc * 256 + parseInt(part, 10), 0);
}

function inCidrV4(ip: string, base: string, bits: number): boolean {
  const ipNum = ipv4ToNumber(ip);
  const baseNum = ipv4ToNumber(base);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

const BLOCKED_V4 = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (AWS metadata!)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
  ["255.255.255.255", 32],
] as const;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
]);

/** Returns a human-readable reason when the IP is not publicly routable. */
export function blockedIpReason(ip: string): string | null {
  const version = isIP(ip);
  if (version === 4) {
    for (const [base, bits] of BLOCKED_V4) {
      if (inCidrV4(ip, base, bits)) return `IP ${ip} is in a blocked range`;
    }
    return null;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return "IPv6 loopback is blocked";
    if (lower.startsWith("fe80")) return "IPv6 link-local is blocked";
    if (lower.startsWith("fc") || lower.startsWith("fd")) {
      return "IPv6 unique-local is blocked";
    }
    if (lower.startsWith("ff")) return "IPv6 multicast is blocked";
    // IPv4-mapped IPv6 (::ffff:127.0.0.1)
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return blockedIpReason(mapped[1]!);
    return null;
  }
  return `Unrecognized IP: ${ip}`;
}

/** Synchronous structural check — does not perform DNS lookups. */
export function assertSafeUrlStructure(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SourceAdapterError("INVALID_URL", "Malformed URL", 400);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SourceAdapterError(
      "UNSUPPORTED_PROTOCOL",
      `Unsupported protocol '${url.protocol}'. Only http and https are allowed.`,
      400,
    );
  }

  if (url.username || url.password) {
    throw new SourceAdapterError(
      "URL_CREDENTIALS_NOT_ALLOWED",
      "URLs containing credentials are not allowed",
      400,
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (!hostname) {
    throw new SourceAdapterError("INVALID_URL", "URL has no hostname", 400);
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home.arpa")
  ) {
    throw new SourceAdapterError(
      "SSRF_BLOCKED_HOST",
      `Host '${hostname}' is not permitted`,
      400,
    );
  }

  // Literal IP addresses are checked immediately
  if (isIP(hostname)) {
    const reason = blockedIpReason(hostname);
    if (reason) {
      throw new SourceAdapterError("SSRF_BLOCKED_IP", reason, 400);
    }
  }

  return url;
}

/**
 * Full SSRF check including DNS resolution. Resolves the hostname and rejects
 * if *any* resolved address is non-public.
 */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const url = assertSafeUrlStructure(rawUrl);
  const hostname = url.hostname.toLowerCase().replace(/[[\]]/g, "");

  if (isIP(hostname)) return url;

  let addresses: string[];
  try {
    const results = await lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new SourceAdapterError(
      "DNS_RESOLUTION_FAILED",
      `Could not resolve host '${hostname}'`,
      400,
    );
  }

  if (addresses.length === 0) {
    throw new SourceAdapterError(
      "DNS_RESOLUTION_FAILED",
      `Host '${hostname}' did not resolve to any address`,
      400,
    );
  }

  for (const address of addresses) {
    const reason = blockedIpReason(address);
    if (reason) {
      throw new SourceAdapterError(
        "SSRF_BLOCKED_IP",
        `Host '${hostname}' resolves to a blocked address (${reason})`,
        400,
      );
    }
  }

  return url;
}
