import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const INVITATION_TOKEN_BYTES = 32;
const SHA256_HEX_LENGTH = 64;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export type InvitationTokenPair = {
  token: string;
  tokenHash: string;
};

export function hashInvitationToken(
  token: string,
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

export function createInvitationToken():
  InvitationTokenPair {
  const token = randomBytes(
    INVITATION_TOKEN_BYTES,
  ).toString("base64url");

  return {
    token,
    tokenHash:
      hashInvitationToken(token),
  };
}

export function invitationTokenMatches(
  token: string,
  expectedHash: string,
): boolean {
  if (
    expectedHash.length !==
      SHA256_HEX_LENGTH ||
    !SHA256_HEX_PATTERN.test(
      expectedHash,
    )
  ) {
    return false;
  }

  const actualHash =
    hashInvitationToken(token);

  return timingSafeEqual(
    Buffer.from(
      actualHash,
      "hex",
    ),
    Buffer.from(
      expectedHash,
      "hex",
    ),
  );
}
