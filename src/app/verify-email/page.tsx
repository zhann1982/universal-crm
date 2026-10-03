import Link from "@/components/app-link";
import {
  headers,
} from "next/headers";
import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/lib/auth/auth";
import {
  getSafeNextPath,
} from "@/lib/auth/safe-next-path";

import {
  ResendVerificationButton,
} from "./resend-verification-button";

type SearchParams = {
  verified?:
    | string
    | string[]
    | undefined;

  error?:
    | string
    | string[]
    | undefined;

  next?:
    | string
    | string[]
    | undefined;
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const params =
    await searchParams;

  const nextPath =
    getSafeNextPath(
      params.next,
      "/crm",
    );

  const currentVerifyPath =
    `/verify-email?next=${encodeURIComponent(
      nextPath,
    )}`;

  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  if (!session) {
    redirect(
      `/login?next=${encodeURIComponent(
        currentVerifyPath,
      )}`,
    );
  }

  const verified =
    session.user
      .emailVerified;

  const verificationError =
    Array.isArray(
      params.error,
    )
      ? params.error[0]
      : params.error;

  const verificationCallbackURL =
    `/verify-email?verified=1&next=${encodeURIComponent(
      nextPath,
    )}`;

  const continueLabel =
    nextPath === "/crm"
      ? "Открыть CRM"
      : "Продолжить";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-medium text-slate-500">
          Universal CRM
        </div>

        {verified ? (
          <>
            <div className="mt-6 inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              Email подтверждён
            </div>

            <h1 className="mt-4 text-3xl font-bold">
              Адрес подтверждён
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Владение адресом{" "}
              <strong>
                {
                  session.user
                    .email
                }
              </strong>{" "}
              подтверждено.
            </p>

            {nextPath !==
              "/crm" && (
              <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                Теперь можно
                продолжить действие,
                которое потребовало
                подтверждения email.
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={
                  nextPath
                }
                className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {
                  continueLabel
                }
              </Link>

              <Link
                href="/auth-test"
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium transition hover:bg-slate-50"
              >
                Данные сессии
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              Требуется подтверждение
            </div>

            <h1 className="mt-4 text-3xl font-bold">
              Подтвердите email
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Перед доступом к CRM
              или принятием
              приглашения необходимо
              подтвердить, что адрес
              принадлежит вам.
            </p>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Email
              </div>

              <div className="mt-1 break-all text-sm font-medium text-slate-800">
                {
                  session.user
                    .email
                }
              </div>
            </div>

            {verificationError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Ссылка подтверждения
                недействительна или
                истекла. Создайте
                новую.
              </div>
            )}

            <ResendVerificationButton
              email={
                session.user
                  .email
              }
              developmentMode={
                process.env
                  .NODE_ENV !==
                "production"
              }
              callbackURL={
                verificationCallbackURL
              }
            />

            {process.env
              .NODE_ENV !==
              "production" && (
              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                <strong>
                  Development:
                </strong>{" "}
                настоящее письмо пока
                не отправляется.
                Verification URL
                появится в терминале,
                где запущен{" "}
                <code>
                  npm run dev
                </code>
                .
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}