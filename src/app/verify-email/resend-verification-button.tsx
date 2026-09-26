"use client";

import {
  useState,
} from "react";

import {
  authClient,
} from "@/lib/auth/auth-client";

export function ResendVerificationButton({
  email,
  developmentMode,
}: {
  email: string;
  developmentMode: boolean;
}) {
  const [
    isPending,
    setIsPending,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState<
    string | null
  >(null);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  async function handleSend() {
    setIsPending(true);
    setMessage(null);
    setError(null);

    try {
      const result =
        await authClient
          .sendVerificationEmail({
            email,

            callbackURL:
              "/verify-email?verified=1",
          });

      if (result.error) {
        setError(
          result.error.message ??
            "Не удалось отправить ссылку подтверждения.",
        );

        return;
      }

      if (
        developmentMode
      ) {
        setMessage(
          "Ссылка создана. Откройте терминал, где работает npm run dev, найдите DEV EMAIL VERIFICATION и перейдите по Verification URL.",
        );
      } else {
        setMessage(
          "Письмо с подтверждением отправлено.",
        );
      }
    } catch (cause) {
      console.error(
        "Failed to send verification email:",
        cause,
      );

      setError(
        "Не удалось создать ссылку подтверждения.",
      );
    } finally {
      setIsPending(
        false,
      );
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={
          isPending
        }
        onClick={
          handleSend
        }
        className="w-full rounded-lg bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "Создание ссылки..."
          : "Отправить ссылку подтверждения"}
      </button>

      {message && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}