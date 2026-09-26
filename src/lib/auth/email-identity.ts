export function canonicalizeEmail(
  value: string,
) {
  return value
    .trim()
    .toLowerCase();
}

export function isSameCanonicalEmail(
  left: string,
  right: string,
) {
  return (
    canonicalizeEmail(left) ===
    canonicalizeEmail(right)
  );
}