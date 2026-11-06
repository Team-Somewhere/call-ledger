const SENSITIVE_QUERY_PARAMETER =
  /(?:token|secret|password|credential|api[-_]?key|signature|^key$|^auth$)/i;

export function sanitizePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMETER.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}
