"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  cardFeePence,
  formatPence,
  MAX_CHARGE_PENCE,
  meetsMinimum,
  parsePoundsToPence,
} from "@/lib/fund-rules";
import type { TopUpState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function feePreview(input: string): string {
  const amountPence = parsePoundsToPence(input.trim());
  if (amountPence === null) {
    return "Enter an amount in pounds, for example 50.";
  }
  if (!meetsMinimum(amountPence)) {
    return "Minimum top-up £10.";
  }
  if (amountPence > MAX_CHARGE_PENCE) {
    return "Please enter a smaller amount.";
  }
  const feePence = cardFeePence(amountPence);
  if (amountPence + feePence > MAX_CHARGE_PENCE) {
    return "Please enter a smaller amount.";
  }
  return `Top-up ${formatPence(amountPence)} + card fee ${formatPence(feePence)} = ${formatPence(amountPence + feePence)} total`;
}

export function TopUpForm({
  action,
}: {
  action: (state: TopUpState, formData: FormData) => Promise<TopUpState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [amount, setAmount] = useState("");

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "invalid" || state.status === "error") {
      errorSummaryRef.current?.focus();
    }
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : {};

  return (
    <div className="space-y-6">
      {state.status === "invalid" && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 outline-none dark:border-red-900 dark:bg-red-950/50"
        >
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            There were problems with your top-up
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-300">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a
                  href={`#topup-${field}`}
                  className="underline hover:no-underline"
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.status === "error" && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4 outline-none dark:border-red-900 dark:bg-red-950/50"
        >
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
            Payment could not start
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        </div>
      )}

      <form action={formAction} noValidate className="space-y-6">
        <div>
          <label
            htmlFor="topup-amount"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Top-up amount in pounds
          </label>
          <input
            id="topup-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 50"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={errors.amount ? "true" : undefined}
            aria-describedby={
              errors.amount
                ? "topup-amount-preview topup-amount-error"
                : "topup-amount-preview"
            }
            className={inputClass}
          />
          <p
            id="topup-amount-preview"
            aria-live="polite"
            className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
          >
            {feePreview(amount)}
          </p>
          {errors.amount && (
            <p
              id="topup-amount-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.amount}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Taking you to payment..." : "Top up my credit"}
        </button>
      </form>
    </div>
  );
}
