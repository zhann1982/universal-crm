import Link from "@/components/app-link";
import {
  headers,
} from "next/headers";

import {
  auth,
} from "@/lib/auth/auth";

import {
  acceptInvitationAction,
} from "./actions";

type SearchParams = {
  token?:
    | string
    | string[]
    | undefined;

  error?:
    | string
    | string[]
    | undefined;
};

function firstValue(
  value:
    | string
    | string[]
    | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

function getErrorMessage(
  error:
    | string
    | undefined,
) {
  switch (error) {
    case "invalid":
      return "Ссылка приглашения недействительна.";

    case "identity":
      return "Не удалось однозначно определить учётную запись.";

    case "email-mismatch":
      return "Это приглашение предназначено для другого email.";

    case "already-accepted":
      return "Это приглашение уже было принято.";

    case "revoked":
      return "Это приглашение было отозвано.";

    case "expired":
      return "Срок действия приглашения истёк.";

    case "organization-inactive":
      return "Организация сейчас недоступна.";

    case "role-invalid":
      return "Роль из приглашения больше недоступна.";

    case "member-exists":
      return "Вы уже состоите в этой организации.";

    case "conflict":
      return "Приглашение изменилось во время обработки. Попробуйте ещё раз.";

    default:
      return null;
  }
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams:
    Promise<SearchParams>;
}) {
  const params =
    await searchParams;

  const token =
    firstValue(
      params.token,
    )?.trim() ?? "";

  const error =
    firstValue(
      params.error,
    );

  const errorMessage =
    getErrorMessage(
      error,
    );

  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  const invitePath =
    token
      ? `/invite?token=${encodeURIComponent(
          token,
        )}`
      : "/invite";

  const nextParam =
    encodeURIComponent(
      invitePath,
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-medium text-slate-500">
          Universal CRM
        </div>

        <h1 className="mt-3 text-3xl font-bold">
          Приглашение в команду
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          После принятия
          приглашения ваша
          учётная запись будет
          добавлена в организацию
          с назначенной ролью.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        )}

        {!token && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            В ссылке отсутствует
            token приглашения.
          </div>
        )}

        {token &&
          !session && (
            <div className="mt-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                Чтобы принять
                приглашение,
                необходимо войти
                в аккаунт или
                зарегистрироваться.
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/login?next=${nextParam}`}
                  className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Войти
                </Link>

                <Link
                  href={`/register?next=${nextParam}`}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium transition hover:bg-slate-50"
                >
                  Создать аккаунт
                </Link>
              </div>
            </div>
          )}

        {token &&
          session &&
          !session.user
            .emailVerified && (
            <div className="mt-6">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                Перед принятием
                приглашения нужно
                подтвердить email{" "}
                <strong>
                  {
                    session.user
                      .email
                  }
                </strong>
                .
              </div>

              <Link
                href={`/verify-email?next=${nextParam}`}
                className="mt-5 inline-block rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Подтвердить email
              </Link>
            </div>
          )}

        {token &&
          session?.user
            .emailVerified && (
            <div className="mt-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Вы вошли как
                </div>

                <div className="mt-1 break-all text-sm font-medium text-slate-800">
                  {
                    session.user
                      .email
                  }
                </div>
              </div>

              <form
                action={
                  acceptInvitationAction
                }
                className="mt-5"
              >
                <input
                  type="hidden"
                  name="token"
                  value={token}
                />

                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800"
                >
                  Принять приглашение
                </button>
              </form>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Приглашение может
                принять только
                аккаунт с тем email,
                для которого оно
                было создано.
              </p>
            </div>
          )}

        {error ===
          "member-exists" && (
          <div className="mt-5">
            <Link
              href="/crm"
              className="text-sm font-medium text-slate-950 hover:underline"
            >
              Перейти в CRM
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}