import assert from "node:assert/strict";
import test from "node:test";

import {
  createInvitationToken,
  hashInvitationToken,
  invitationTokenMatches,
} from "./invitation-token";

test(
  "createInvitationToken returns raw token and SHA-256 hash",
  () => {
    const {
      token,
      tokenHash,
    } = createInvitationToken();

    assert.ok(token.length > 30);

    assert.match(
      token,
      /^[A-Za-z0-9_-]+$/,
    );

    assert.match(
      tokenHash,
      /^[0-9a-f]{64}$/,
    );

    assert.notEqual(
      token,
      tokenHash,
    );

    assert.equal(
      tokenHash,
      hashInvitationToken(token),
    );
  },
);

test(
  "generated invitation tokens are different",
  () => {
    const first =
      createInvitationToken();

    const second =
      createInvitationToken();

    assert.notEqual(
      first.token,
      second.token,
    );

    assert.notEqual(
      first.tokenHash,
      second.tokenHash,
    );
  },
);

test(
  "invitationTokenMatches accepts only the correct raw token",
  () => {
    const {
      token,
      tokenHash,
    } = createInvitationToken();

    assert.equal(
      invitationTokenMatches(
        token,
        tokenHash,
      ),
      true,
    );

    assert.equal(
      invitationTokenMatches(
        `${token}x`,
        tokenHash,
      ),
      false,
    );
  },
);

test(
  "invitationTokenMatches rejects malformed stored hashes",
  () => {
    const { token } =
      createInvitationToken();

    assert.equal(
      invitationTokenMatches(
        token,
        "",
      ),
      false,
    );

    assert.equal(
      invitationTokenMatches(
        token,
        "not-a-sha256-hash",
      ),
      false,
    );
  },
);
