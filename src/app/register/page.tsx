"use client";

import Link from "next/link";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [error, setError] =
    useState<string | null>(null);

  const [isPending, setIsPending] =
    useState(false);

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    if (!name.trim()) {
      setError(
        "Введите имя.",
      );

      return;
    }

    if (
      password.length < 8
    ) {
      setError(
        "Пароль должен содержать минимум 8 символов.",
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Пароли не совпадают.",
      );

      return;
    }

    setIsPending(true);

    try {
      const {
        error:
          signUpError,
      } =
        await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });

      if (signUpError) {
        setError(
          signUpError.message ??
            "Не удалось создать аккаунт.",
        );

        return;
      }

      router.push("/auth-test");
      router.refresh();
    } catch (cause) {
      console.error(
        "Registration failed:",
        cause,
      );

      setError(
        "Произошла ошибка регистрации.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <div className="text-sm font-medium text-slate-500">
            Universal CRM
          </div>

          <h1 className="mt-2 text-3xl font-bold">
            Регистрация
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Создайте тестовый аккаунт
            Better Auth.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium"
            >
              Имя
            </label>

            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              Пароль
            </label>

            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium"
            >
              Повторите пароль
            </label>

            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Создание..."
              : "Создать аккаунт"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium text-slate-950 hover:underline"
          >
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}