import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeEmail,
  isSameCanonicalEmail,
} from "./email-identity";

test(
  "canonicalizeEmail trims and lowercases email",
  () => {
    assert.equal(
      canonicalizeEmail(
        "  User_Test@Example.COM  ",
      ),
      "user_test@example.com",
    );
  },
);

test(
  "underscore is treated as a literal character",
  () => {
    assert.equal(
      isSameCanonicalEmail(
        "a_b@example.com",
        "acb@example.com",
      ),
      false,
    );
  },
);

test(
  "same email with different case matches",
  () => {
    assert.equal(
      isSameCanonicalEmail(
        "USER@example.com",
        "user@example.com",
      ),
      true,
    );
  },
);

test(
  "percent character is also treated literally",
  () => {
    assert.equal(
      isSameCanonicalEmail(
        "a%b@example.com",
        "axxb@example.com",
      ),
      false,
    );
  },
);