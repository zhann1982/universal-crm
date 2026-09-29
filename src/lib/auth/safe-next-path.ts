export function getSafeNextPath(
  value:
    | string
    | string[]
    | null
    | undefined,
  fallback = "/crm",
): string {
  const candidate =
    Array.isArray(value)
      ? value[0]
      : value;

  if (!candidate) {
    return fallback;
  }

  const trimmed =
    candidate.trim();

  /*
   * Only same-origin absolute paths are allowed.
   *
   * Reject:
   * - https://example.com
   * - //example.com
   * - javascript:...
   * - relative paths such as "invite"
   */
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//")
  ) {
    return fallback;
  }

  return trimmed;
}
