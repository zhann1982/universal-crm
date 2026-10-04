import { z } from "zod";
export const historyCursorSchema = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
});
export function decodeHistoryCursor(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 300) return undefined;
  try {
    return historyCursorSchema.parse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
  } catch {
    return undefined;
  }
}
export function encodeHistoryCursor(
  cursor: z.infer<typeof historyCursorSchema>,
) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
