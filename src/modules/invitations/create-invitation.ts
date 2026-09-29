import { z } from "zod";

import { sql } from "@/db";
import {
  canonicalizeEmail,
} from "@/lib/auth/email-identity";
import {
  createInvitationToken,
} from "./invitation-token";

const INVITATION_TTL_MS =
  7 * 24 * 60 * 60 * 1000;

const createInvitationInputSchema =
  z.object({
    organizationId:
      z.string().uuid(),

    invitedByMemberId:
      z.string().uuid(),

    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform(
        canonicalizeEmail,
      ),

    roleId:
      z.string().uuid(),
  });

type CreationRow = {
  status:
    | "created"
    | "inviter-invalid"
    | "role-not-found"
    | "identity-ambiguous"
    | "member-exists"
    | "already-pending"
    | "conflict";

  invitation_id:
    | string
    | null;

  expires_at:
    | Date
    | string
    | null;
};

export type CreateInvitationInput = {
  organizationId: string;
  invitedByMemberId: string;
  email: string;
  roleId: string;
};

export type CreateInvitationResult =
  | {
      status: "created";
      invitationId: string;
      emailNormalized: string;
      roleId: string;
      token: string;
      expiresAt: Date;
    }
  | {
      status: "invalid-input";
    }
  | {
      status: "inviter-invalid";
    }
  | {
      status: "role-not-found";
    }
  | {
      status: "identity-ambiguous";
    }
  | {
      status: "member-exists";
    }
  | {
      status: "already-pending";
      invitationId: string;
      expiresAt: Date;
    }
  | {
      status: "conflict";
    };

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const parsed =
    createInvitationInputSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return {
      status: "invalid-input",
    };
  }

  const {
    organizationId,
    invitedByMemberId,
    email,
    roleId,
  } = parsed.data;

  const {
    token,
    tokenHash,
  } = createInvitationToken();

  const expiresAt =
    new Date(
      Date.now() +
        INVITATION_TTL_MS,
    );

  const expiresAtIso =
    expiresAt.toISOString();

  /*
   * IMPORTANT:
   *
   * This uses the SAME canonical-email
   * advisory-lock namespace as
   * acceptInvitation().
   *
   * Therefore:
   * - concurrent invitation creation
   *   for the same identity is serialized;
   * - invitation creation cannot race past
   *   Membership creation performed by an
   *   invitation acceptance transaction.
   *
   * This remains a cooperative invariant:
   * future invitation/member-acquisition
   * paths for the same identity must use
   * the same lock convention.
   */
  const transactionResult =
    await sql.transaction(
      (txn) => [
        txn`
          SELECT
            pg_advisory_xact_lock(
              hashtext(
                'universal-crm-invitation-email'
              ),
              hashtext(${email})
            )
        `,

        txn`
          WITH inviter AS MATERIALIZED (
            SELECT om.id
            FROM organization_members om
            WHERE
              om.id =
                ${invitedByMemberId}::uuid
              AND om.organization_id =
                ${organizationId}::uuid
              AND om.status =
                'active'
            LIMIT 1
          ),

          selected_role AS MATERIALIZED (
            SELECT r.id
            FROM roles r
            WHERE
              r.id =
                ${roleId}::uuid
              AND r.organization_id =
                ${organizationId}::uuid
            LIMIT 1
          ),

          auth_identity AS MATERIALIZED (
            SELECT u.id
            FROM "user" u
            WHERE
              lower(
                btrim(
                  u.email
                )
              ) = ${email}
            LIMIT 2
          ),

          existing_member AS MATERIALIZED (
            SELECT om.id
            FROM organization_members om
            INNER JOIN auth_identity ai
              ON ai.id =
                om.user_id
            WHERE
              om.organization_id =
                ${organizationId}::uuid
            LIMIT 1
          ),

          pending AS MATERIALIZED (
            SELECT
              oi.id,
              oi.expires_at
            FROM organization_invitations oi
            WHERE
              oi.organization_id =
                ${organizationId}::uuid
              AND oi.email_normalized =
                ${email}
              AND oi.accepted_at
                IS NULL
              AND oi.revoked_at
                IS NULL
              AND oi.expires_at
                > now()
            ORDER BY
              oi.created_at DESC
            LIMIT 1
          ),

          decision AS MATERIALIZED (
            SELECT
              CASE
                WHEN NOT EXISTS (
                  SELECT 1
                  FROM inviter
                )
                THEN
                  'inviter-invalid'

                WHEN NOT EXISTS (
                  SELECT 1
                  FROM selected_role
                )
                THEN
                  'role-not-found'

                WHEN (
                  SELECT count(*)
                  FROM auth_identity
                ) > 1
                THEN
                  'identity-ambiguous'

                WHEN EXISTS (
                  SELECT 1
                  FROM existing_member
                )
                THEN
                  'member-exists'

                WHEN EXISTS (
                  SELECT 1
                  FROM pending
                )
                THEN
                  'already-pending'

                ELSE
                  'ready'
              END AS decision_status
          ),

          inserted AS (
            INSERT INTO
              organization_invitations (
                organization_id,
                email_normalized,
                role_id,
                token_hash,
                invited_by_member_id,
                expires_at
              )

            SELECT
              ${organizationId}::uuid,
              ${email},
              selected_role.id,
              ${tokenHash},
              inviter.id,
              ${expiresAtIso}::timestamptz

            FROM decision
            CROSS JOIN selected_role
            CROSS JOIN inviter

            WHERE
              decision.decision_status =
                'ready'

            RETURNING
              id,
              expires_at
          )

          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM inserted
              )
              THEN
                'created'

              WHEN (
                SELECT
                  decision_status
                FROM decision
                LIMIT 1
              ) IN (
                'inviter-invalid',
                'role-not-found',
                'identity-ambiguous',
                'member-exists',
                'already-pending'
              )
              THEN (
                SELECT
                  decision_status
                FROM decision
                LIMIT 1
              )

              ELSE
                'conflict'
            END AS status,

            COALESCE(
              (
                SELECT id
                FROM inserted
                LIMIT 1
              ),
              (
                SELECT id
                FROM pending
                LIMIT 1
              )
            ) AS invitation_id,

            COALESCE(
              (
                SELECT expires_at
                FROM inserted
                LIMIT 1
              ),
              (
                SELECT expires_at
                FROM pending
                LIMIT 1
              )
            ) AS expires_at
        `,
      ],
    );

  const rows =
    transactionResult[1] as
      CreationRow[];

  const row =
    rows[0];

  if (!row) {
    return {
      status: "conflict",
    };
  }

  if (
    row.status ===
    "created"
  ) {
    if (
      !row.invitation_id ||
      !row.expires_at
    ) {
      return {
        status: "conflict",
      };
    }

    const returnedExpiresAt =
      new Date(
        row.expires_at,
      );

    if (
      Number.isNaN(
        returnedExpiresAt.getTime(),
      )
    ) {
      return {
        status: "conflict",
      };
    }

    return {
      status: "created",

      invitationId:
        row.invitation_id,

      emailNormalized:
        email,

      roleId,

      token,

      expiresAt:
        returnedExpiresAt,
    };
  }

  if (
    row.status ===
    "already-pending"
  ) {
    if (
      !row.invitation_id ||
      !row.expires_at
    ) {
      return {
        status: "conflict",
      };
    }

    const returnedExpiresAt =
      new Date(
        row.expires_at,
      );

    if (
      Number.isNaN(
        returnedExpiresAt.getTime(),
      )
    ) {
      return {
        status: "conflict",
      };
    }

    return {
      status:
        "already-pending",

      invitationId:
        row.invitation_id,

      expiresAt:
        returnedExpiresAt,
    };
  }

  return {
    status:
      row.status,
  };
}
