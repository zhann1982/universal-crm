import {
  randomUUID,
} from "node:crypto";

import { z } from "zod";

import { sql } from "@/db";
import {
  canonicalizeEmail,
} from "@/lib/auth/email-identity";

import {
  hashInvitationToken,
} from "./invitation-token";

const invitationAcceptanceInputSchema =
  z.object({
    token: z
      .string()
      .trim()
      .min(20)
      .max(256)
      .regex(
        /^[A-Za-z0-9_-]+$/,
      ),

    userId: z
      .string()
      .trim()
      .min(1)
      .max(255),

    userEmail: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform(
        canonicalizeEmail,
      ),

    userName: z
      .string()
      .trim()
      .min(1),

    emailVerified:
      z.boolean(),
  });

type AcceptanceRow = {
  status:
    | "accepted"
    | "not-found"
    | "already-accepted"
    | "revoked"
    | "expired"
    | "identity-mismatch"
    | "organization-inactive"
    | "role-invalid"
    | "member-exists"
    | "conflict";

  invitation_id:
    | string
    | null;

  organization_id:
    | string
    | null;

  member_id:
    | string
    | null;

  role_id:
    | string
    | null;
};

export type AcceptInvitationInput = {
  token: string;
  userId: string;
  userEmail: string;
  userName: string;
  emailVerified: boolean;
};

export type AcceptInvitationResult =
  | {
      status: "accepted";
      invitationId: string;
      organizationId: string;
      memberId: string;
      roleId: string;
    }
  | {
      status:
        | "invalid-input"
        | "email-unverified"
        | "not-found"
        | "already-accepted"
        | "revoked"
        | "expired"
        | "identity-mismatch"
        | "organization-inactive"
        | "role-invalid"
        | "member-exists"
        | "conflict";
    };

export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const parsed =
    invitationAcceptanceInputSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return {
      status:
        "invalid-input",
    };
  }

  const {
    token,
    userId,
    userEmail,
    userName,
    emailVerified,
  } = parsed.data;

  if (!emailVerified) {
    return {
      status:
        "email-unverified",
    };
  }

  const tokenHash =
    hashInvitationToken(
      token,
    );

  const newMemberId =
    randomUUID();

  const displayName =
    userName.slice(
      0,
      160,
    );

  /*
   * Two cooperative transaction locks:
   *
   * 1. token lock:
   *    the same invitation cannot be
   *    accepted concurrently.
   *
   * 2. canonical-email lock:
   *    two invitations for the same
   *    identity are serialized before
   *    Membership creation.
   *
   * The second SQL command therefore
   * receives a fresh READ COMMITTED
   * snapshot after any waiting lock
   * has been acquired.
   */
  const transactionResult =
    await sql.transaction(
      (txn) => [
        txn`
          SELECT
            pg_advisory_xact_lock(
              hashtext(
                'universal-crm-invitation-token'
              ),
              hashtext(${tokenHash})
            ),
            pg_advisory_xact_lock(
              hashtext(
                'universal-crm-invitation-email'
              ),
              hashtext(${userEmail})
            )
        `,

        txn`
          WITH target AS MATERIALIZED (
            SELECT
              oi.id,
              oi.organization_id,
              oi.email_normalized,
              oi.role_id,
              oi.expires_at,
              oi.accepted_at,
              oi.revoked_at,

              o.is_active AS
                organization_active,

              EXISTS (
                SELECT 1
                FROM roles r
                WHERE
                  r.id = oi.role_id
                  AND r.organization_id =
                    oi.organization_id
              ) AS role_valid,

              EXISTS (
                SELECT 1
                FROM organization_members om
                WHERE
                  om.organization_id =
                    oi.organization_id
                  AND om.user_id =
                    ${userId}
              ) AS member_exists

            FROM organization_invitations oi
            INNER JOIN organizations o
              ON o.id =
                oi.organization_id

            WHERE
              oi.token_hash =
                ${tokenHash}

            LIMIT 1
          ),

          decision AS MATERIALIZED (
            SELECT
              target.*,

              CASE
                WHEN
                  target.accepted_at
                    IS NOT NULL
                THEN
                  'already-accepted'

                WHEN
                  target.revoked_at
                    IS NOT NULL
                THEN
                  'revoked'

                WHEN
                  target.expires_at
                    <= now()
                THEN
                  'expired'

                WHEN
                  target.email_normalized
                    <> ${userEmail}
                THEN
                  'identity-mismatch'

                WHEN
                  NOT target.organization_active
                THEN
                  'organization-inactive'

                WHEN
                  NOT target.role_valid
                THEN
                  'role-invalid'

                WHEN
                  target.member_exists
                THEN
                  'member-exists'

                ELSE
                  'ready'
              END AS decision_status

            FROM target
          ),

          inserted_member AS (
            INSERT INTO
              organization_members (
                id,
                organization_id,
                user_id,
                display_name,
                email,
                status
              )

            SELECT
              ${newMemberId}::uuid,
              decision.organization_id,
              ${userId},
              ${displayName},
              ${userEmail},
              'active'

            FROM decision

            WHERE
              decision.decision_status =
                'ready'

            ON CONFLICT (
              organization_id,
              user_id
            )
            DO NOTHING

            RETURNING id
          ),

          inserted_role AS (
            INSERT INTO
              member_roles (
                organization_id,
                member_id,
                role_id
              )

            SELECT
              decision.organization_id,
              inserted_member.id,
              decision.role_id

            FROM inserted_member
            CROSS JOIN decision

            WHERE
              decision.decision_status =
                'ready'

            ON CONFLICT DO NOTHING

            RETURNING
              member_id,
              role_id
          ),

          accepted AS (
            UPDATE
              organization_invitations oi

            SET
              accepted_at = now(),
              accepted_by_user_id =
                ${userId},
              updated_at = now()

            FROM decision

            WHERE
              oi.id =
                decision.id
              AND decision.decision_status =
                'ready'
              AND oi.accepted_at
                IS NULL
              AND oi.revoked_at
                IS NULL
              AND oi.expires_at
                > now()
              AND EXISTS (
                SELECT 1
                FROM inserted_role
              )

            RETURNING oi.id
          )

          SELECT
            CASE
              WHEN NOT EXISTS (
                SELECT 1
                FROM target
              )
              THEN
                'not-found'

              WHEN EXISTS (
                SELECT 1
                FROM accepted
              )
              THEN
                'accepted'

              WHEN (
                SELECT
                  decision_status
                FROM decision
                LIMIT 1
              ) <> 'ready'
              THEN (
                SELECT
                  decision_status
                FROM decision
                LIMIT 1
              )

              ELSE
                'conflict'
            END AS status,

            (
              SELECT id
              FROM target
              LIMIT 1
            ) AS invitation_id,

            (
              SELECT organization_id
              FROM target
              LIMIT 1
            ) AS organization_id,

            (
              SELECT id
              FROM inserted_member
              LIMIT 1
            ) AS member_id,

            (
              SELECT role_id
              FROM target
              LIMIT 1
            ) AS role_id
        `,
      ],
    );

  const rows =
    transactionResult[1] as
      AcceptanceRow[];

  const row =
    rows[0];

  if (!row) {
    return {
      status: "conflict",
    };
  }

  if (
    row.status !==
    "accepted"
  ) {
    return {
      status:
        row.status,
    };
  }

  if (
    !row.invitation_id ||
    !row.organization_id ||
    !row.member_id ||
    !row.role_id
  ) {
    return {
      status: "conflict",
    };
  }

  return {
    status: "accepted",

    invitationId:
      row.invitation_id,

    organizationId:
      row.organization_id,

    memberId:
      row.member_id,

    roleId:
      row.role_id,
  };
}
