import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateOwnerAssignment,
} from "./owner-assignment-policy";

const selfId =
  "11111111-1111-4111-8111-111111111111";

const otherId =
  "22222222-2222-4222-8222-222222222222";

test(
  "create without members.read may assign self",
  () => {
    assert.deepEqual(
      evaluateOwnerAssignment({
        mode: "create",
        currentMemberId:
          selfId,
        canReadMembers:
          false,
        requestedOwnerMemberId:
          selfId,
      }),
      {
        allowed: true,
        ownerChanged: true,
      },
    );
  },
);

test(
  "create without members.read cannot assign another Member",
  () => {
    assert.deepEqual(
      evaluateOwnerAssignment({
        mode: "create",
        currentMemberId:
          selfId,
        canReadMembers:
          false,
        requestedOwnerMemberId:
          otherId,
      }),
      {
        allowed: false,
        ownerChanged: true,
        reason:
          "foreign-owner-without-members-read",
      },
    );
  },
);

test(
  "create with members.read may assign another Member",
  () => {
    assert.deepEqual(
      evaluateOwnerAssignment({
        mode: "create",
        currentMemberId:
          selfId,
        canReadMembers:
          true,
        requestedOwnerMemberId:
          otherId,
      }),
      {
        allowed: true,
        ownerChanged: true,
      },
    );
  },
);

test(
  "update may keep unchanged foreign owner without members.read",
  () => {
    assert.deepEqual(
      evaluateOwnerAssignment({
        mode: "update",
        currentMemberId:
          selfId,
        canReadMembers:
          false,
        requestedOwnerMemberId:
          otherId,
        existingOwnerMemberId:
          otherId,
      }),
      {
        allowed: true,
        ownerChanged: false,
      },
    );
  },
);

test(
  "update without members.read cannot change owner to another Member",
  () => {
    assert.equal(
      evaluateOwnerAssignment({
        mode: "update",
        currentMemberId:
          selfId,
        canReadMembers:
          false,
        requestedOwnerMemberId:
          otherId,
        existingOwnerMemberId:
          selfId,
      }).allowed,
      false,
    );
  },
);

test(
  "update without members.read may change owner to self",
  () => {
    assert.deepEqual(
      evaluateOwnerAssignment({
        mode: "update",
        currentMemberId:
          selfId,
        canReadMembers:
          false,
        requestedOwnerMemberId:
          selfId,
        existingOwnerMemberId:
          otherId,
      }),
      {
        allowed: true,
        ownerChanged: true,
      },
    );
  },
);

test(
  "update may clear owner without members.read",
  () => {
    assert.deepEqual(
      evaluateOwnerAssignment({
        mode: "update",
        currentMemberId:
          selfId,
        canReadMembers:
          false,
        requestedOwnerMemberId:
          null,
        existingOwnerMemberId:
          otherId,
      }),
      {
        allowed: true,
        ownerChanged: true,
      },
    );
  },
);
