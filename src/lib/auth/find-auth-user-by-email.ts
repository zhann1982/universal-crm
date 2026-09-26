import { sql } from "drizzle-orm";

import { db } from "@/db";
import {
  user as authUsers,
} from "@/db/auth-schema";

import {
  canonicalizeEmail,
} from "./email-identity";

export type AuthUserByEmailLookup =
  | {
      status: "found";

      canonicalEmail: string;

      user: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
      };
    }
  | {
      status: "not-found";

      canonicalEmail: string;
    }
  | {
      status: "ambiguous";

      canonicalEmail: string;
    };

export async function findAuthUserByEmail(
  email: string,
): Promise<AuthUserByEmailLookup> {
  const canonicalEmail =
    canonicalizeEmail(
      email,
    );

  if (!canonicalEmail) {
    return {
      status:
        "not-found",

      canonicalEmail,
    };
  }

  /*
   * ВАЖНО:
   *
   * Это не LIKE / ILIKE.
   *
   * Сравниваем канонизированные
   * значения обычным SQL "=".
   *
   * Поэтому символы:
   *
   * _
   * %
   *
   * не имеют специального
   * wildcard-значения.
   *
   * limit(2) нужен специально:
   * если в старых данных каким-то
   * образом существуют два email,
   * одинаковых после canonicalization,
   * мы не выбираем случайного пользователя.
   */
  const matches =
    await db
      .select({
        id:
          authUsers.id,

        name:
          authUsers.name,

        email:
          authUsers.email,

        emailVerified:
          authUsers.emailVerified,
      })
      .from(
        authUsers,
      )
      .where(
        sql`
          lower(
            btrim(
              ${authUsers.email}
            )
          ) = ${canonicalEmail}
        `,
      )
      .limit(2);

  if (
    matches.length === 0
  ) {
    return {
      status:
        "not-found",

      canonicalEmail,
    };
  }

  if (
    matches.length > 1
  ) {
    return {
      status:
        "ambiguous",

      canonicalEmail,
    };
  }

  return {
    status: "found",

    canonicalEmail,

    user:
      matches[0],
  };
}