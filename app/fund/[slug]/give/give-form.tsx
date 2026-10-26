"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  cardFeePence,
  formatPence,
  MAX_CHARGE_PENCE,
  meetsMinimum,
  parsePoundsToPence,
} from "@/lib/fund-rules";
import type { GiveState, GiveValues } from "./actions";

const emptyValues: GiveValues = {
  amount: "",
  name: "",
  email: "",
  message: "",
  showAmount: false,
};

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function feePreview(input: string): string {
  const amountPence = parsePoundsToPence(input.trim());
  if (amountPence === null) {
    return "Enter an amount in pounds, for example 50.";
  }
  if (!meetsMinimum(amountPence)) {
    return "Minimum gift £10.";
  }
  if (amountPence > MAX_CHARGE_PENCE) {
    return "Please enter a smaller amount.";
  }
  const feePence = cardFeePence(amountPence);
  if (amountPence + feePence > MAX_CHARGE_PENCE) {
    return "Please enter a smaller amount.";
  }
  return `Gift ${formatPence(amountPence)} + card fee ${formatPence(feePence)} = ${formatPence(amountPence + feePence)} total`;
}

export function GiveForm({
  action,
}: {
  action: (state: GiveState, formData: FormData) => Promise<GiveState>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [amount, setAmount] = useState("");

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "invalid" || state.status === "error") {
      errorSummaryRef.current?.focus();
    }
  }, [state]);

  const values = state.status === "idle" ? emptyValues : state.values;
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
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
            There were problems with your gift
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-300">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`} className="underline hover:no-underline">
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
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
            Payment could not start
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        </div>
      )}

      <form action={formAction} noValidate className="space-y-6">
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Gift amount in pounds
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 50"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={errors.amount ? "true" : undefined}
            aria-describedby={
              errors.amount ? "amount-preview amount-error" : "amount-preview"
            }
            className={inputClass}
          />
          <p
            id="amount-preview"
            aria-live="polite"
            className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
          >
            {feePreview(amount)}
          </p>
          {errors.amount && (
            <p
              id="amount-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.amount}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Your name{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (shown with your message on the fund page)
            </span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={values.name}
            aria-invalid={errors.name ? "true" : undefined}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputClass}
          />
          {errors.name && (
            <p
              id="name-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Your email{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (for your receipt)
            </span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            defaultValue={values.email}
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass}
          />
          {errors.email && (
            <p
              id="email-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Message{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional)
            </span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            maxLength={1000}
            defaultValue={values.message}
            aria-invalid={errors.message ? "true" : undefined}
            aria-describedby={errors.message ? "message-error" : undefined}
            className={inputClass}
          />
          {errors.message && (
            <p
              id="message-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.message}
            </p>
          )}
        </div>

        <div className="flex items-start gap-3">
          <input
            id="showAmount"
            name="showAmount"
            type="checkbox"
            defaultChecked={values.showAmount}
            className="mt-1 size-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          <label
            htmlFor="showAmount"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Show my gift amount on the fund page
            <span className="block font-normal text-zinc-500 dark:text-zinc-400">
              The total always includes your gift, and the mum always sees it.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Taking you to payment..." : "Continue to payment"}
        </button>
      </form>
    </div>
  );
}
