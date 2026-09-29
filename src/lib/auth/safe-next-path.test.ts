import assert from "node:assert/strict";
import test from "node:test";

import {
  getSafeNextPath,
} from "./safe-next-path";

test(
  "allows same-origin absolute paths",
  () => {
    assert.equal(
      getSafeNextPath(
        "/invite?token=abc",
      ),
      "/invite?token=abc",
    );

    assert.equal(
      getSafeNextPath(
        "/crm/team",
      ),
      "/crm/team",
    );
  },
);

test(
  "uses first value when search param is an array",
  () => {
    assert.equal(
      getSafeNextPath([
        "/invite?token=abc",
        "/crm",
      ]),
      "/invite?token=abc",
    );
  },
);

test(
  "rejects external and protocol-relative redirects",
  () => {
    assert.equal(
      getSafeNextPath(
        "https://example.com",
      ),
      "/crm",
    );

    assert.equal(
      getSafeNextPath(
        "//example.com/path",
      ),
      "/crm",
    );
  },
);

test(
  "rejects missing and relative values",
  () => {
    assert.equal(
      getSafeNextPath(
        undefined,
      ),
      "/crm",
    );

    assert.equal(
      getSafeNextPath(
        "invite?token=abc",
      ),
      "/crm",
    );

    assert.equal(
      getSafeNextPath(
        "javascript:alert(1)",
      ),
      "/crm",
    );
  },
);

test(
  "supports an explicit fallback",
  () => {
    assert.equal(
      getSafeNextPath(
        "https://example.com",
        "/",
      ),
      "/",
    );
  },
);
