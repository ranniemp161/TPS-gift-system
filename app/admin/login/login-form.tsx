"use client";

import { useActionState } from "react";
import { type AdminLoginState, signInAdmin } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(
    signInAdmin,
    { status: "idle" },
  );
  const error = state.status === "error" ? state.message : "";

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="admin-password"
          className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          Admin password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby="admin-password-error"
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <p
          id="admin-password-error"
          aria-live="polite"
          className="mt-1 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
