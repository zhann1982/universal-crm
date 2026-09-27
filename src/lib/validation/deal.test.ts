import assert from "node:assert/strict";
import test from "node:test";

import {
  createDealSchema,
  isStrictIsoCalendarDate,
} from "./deal";

test(
  "strict calendar date accepts normal valid dates",
  () => {
    assert.equal(
      isStrictIsoCalendarDate(
        "2026-02-28",
      ),
      true,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-04-30",
      ),
      true,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-12-31",
      ),
      true,
    );
  },
);

test(
  "strict calendar date accepts valid leap day",
  () => {
    assert.equal(
      isStrictIsoCalendarDate(
        "2028-02-29",
      ),
      true,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2000-02-29",
      ),
      true,
    );
  },
);

test(
  "strict calendar date rejects invalid leap days",
  () => {
    assert.equal(
      isStrictIsoCalendarDate(
        "2026-02-29",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2100-02-29",
      ),
      false,
    );
  },
);

test(
  "strict calendar date rejects impossible days",
  () => {
    assert.equal(
      isStrictIsoCalendarDate(
        "2026-02-31",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-04-31",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-06-31",
      ),
      false,
    );
  },
);

test(
  "strict calendar date rejects invalid month and day ranges",
  () => {
    assert.equal(
      isStrictIsoCalendarDate(
        "2026-00-10",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-13-01",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-01-00",
      ),
      false,
    );
  },
);

test(
  "strict calendar date rejects malformed values",
  () => {
    assert.equal(
      isStrictIsoCalendarDate(
        "26-02-28",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026-2-28",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "2026/02/28",
      ),
      false,
    );

    assert.equal(
      isStrictIsoCalendarDate(
        "",
      ),
      false,
    );
  },
);

const validPipelineId =
  "00000000-0000-4000-8000-000000000001";

const validStageId =
  "00000000-0000-4000-8000-000000000002";

function createDealInput(
  expectedCloseAt: string,
) {
  return {
    title:
      "Test deal",

    pipelineId:
      validPipelineId,

    stageId:
      validStageId,

    amount:
      "",

    currency:
      "",

    companyId:
      "",

    ownerMemberId:
      "",

    expectedCloseAt,

    notes:
      "",
  };
}

test(
  "Deal schema rejects impossible expectedCloseAt",
  () => {
    const invalidDates = [
      "2026-02-29",
      "2026-02-31",
      "2026-04-31",
      "2026-13-01",
    ];

    for (
      const date of
      invalidDates
    ) {
      const result =
        createDealSchema.safeParse(
          createDealInput(
            date,
          ),
        );

      assert.equal(
        result.success,
        false,
        `${date} must be rejected`,
      );
    }
  },
);

test(
  "Deal schema accepts valid expectedCloseAt",
  () => {
    const validDates = [
      "2026-02-28",
      "2028-02-29",
      "2026-04-30",
      "2026-12-31",
    ];

    for (
      const date of
      validDates
    ) {
      const result =
        createDealSchema.safeParse(
          createDealInput(
            date,
          ),
        );

      assert.equal(
        result.success,
        true,
        `${date} must be accepted`,
      );
    }
  },
);

test(
  "Deal schema accepts empty optional expectedCloseAt",
  () => {
    const result =
      createDealSchema.safeParse(
        createDealInput(
          "",
        ),
      );

    assert.equal(
      result.success,
      true,
    );

    if (
      result.success
    ) {
      assert.equal(
        result.data
          .expectedCloseAt,
        null,
      );
    }
  },
);