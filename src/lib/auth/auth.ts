import {
  drizzleAdapter,
} from "@better-auth/drizzle-adapter";
import {
  betterAuth,
} from "better-auth";
import {
  nextCookies,
} from "better-auth/next-js";

import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";

export const auth =
  betterAuth({
    database:
      drizzleAdapter(
        db,
        {
          provider: "pg",
          schema:
            authSchema,
        },
      ),

    emailVerification: {
      sendVerificationEmail:
        async ({
          user,
          url,
        }) => {
          /*
           * Локальная разработка.
           *
           * Пока реальный email-provider
           * не подключён, verification URL
           * выводится только в серверный
           * терминал.
           *
           * НИКОГДА не использовать такой
           * режим в production.
           */
          if (
            process.env
              .NODE_ENV !==
            "production"
          ) {
            console.log(
              "",
            );

            console.log(
              "========================================",
            );

            console.log(
              "DEV EMAIL VERIFICATION",
            );

            console.log(
              "Email:",
              user.email,
            );

            console.log(
              "Verification URL:",
            );

            console.log(
              url,
            );

            console.log(
              "========================================",
            );

            console.log(
              "",
            );

            return;
          }

          /*
           * До подключения production
           * email provider не делаем вид,
           * что письмо было отправлено.
           */
          console.error(
            "Email verification requested, but production email delivery is not configured.",
          );

          throw new Error(
            "EMAIL_DELIVERY_NOT_CONFIGURED",
          );
        },

      sendOnSignUp:
        true,

      expiresIn:
        60 * 60,
    },

    emailAndPassword: {
      enabled: true,

      /*
       * Пока НЕ блокируем сам вход
       * через Better Auth.
       *
       * Это позволяет уже существующему
       * development-пользователю войти
       * и подтвердить email.
       *
       * CRM-доступ блокируется отдельно
       * в getCurrentMember().
       *
       * После подключения настоящей
       * email-доставки сможем включить:
       *
       * requireEmailVerification: true
       */
      requireEmailVerification:
        false,
    },

    plugins: [
      nextCookies(),
    ],
  });