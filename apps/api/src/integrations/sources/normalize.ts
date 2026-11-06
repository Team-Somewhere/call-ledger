import { createHash } from "node:crypto";

export function hashNormalizedContent(
  title: string | null,
  content: string | null,
): string {
  return createHash("sha256")
    .update(`${title ?? ""}\n${content ?? ""}`)
    .digest("hex");
}
