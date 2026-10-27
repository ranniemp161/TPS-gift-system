"use client";

import { useActionState, useEffect, useRef } from "react";
import type { CreditUsedFieldName, CreditUsedState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const emptyValues: Record<CreditUsedFieldName, string> = {
  amount: "",
  bookingReference: "",
  recordedBy: "",
};

function TextField({
  id,
  name,
  label,
  defaultValue,
  error,
  inputMode,
  placeholder,
}: {
  id: string;
  name: CreditUsedFieldName;
  label: string;
  defaultValue: string;
  error?: string;
  inputMode?: "decimal";
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Records credit used. With `withAmount` it asks for a pounds amount (manual
 * debit); without it, the action applies a fixed request amount.
 */
export function CreditUsedForm({
  action,
  idPrefix,
  withAmount,
  submitLabel,
  pendingLabel,
}: {
  action: (state: CreditUsedState, formData: FormData) => Promise<CreditUsedState>;
  idPrefix: string;
  withAmount: boolean;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "invalid" || state.status === "error") {
      feedbackRef.current?.focus();
    }
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : {};
  // React resets the form after each submission, so failed attempts refill
  // from the returned values and successful ones clear.
  const values =
    state.status === "invalid" || state.status === "error"
      ? state.values
      : emptyValues;

  return (
    <div className="space-y-4">
      {(state.status === "invalid" || state.status === "error") && (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 outline-none dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          {state.status === "error" ? (
            state.message
          ) : (
            <ul className="list-inside list-disc space-y-1">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>
                  <a
                    href={`#${idPrefix}-${field}`}
                    className="underline hover:no-underline"
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div role="status" aria-live="polite">
        {state.status === "success" && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {state.message}
          </p>
        )}
      </div>

      <form action={formAction} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {withAmount && (
            <TextField
              id={`${idPrefix}-amount`}
              name="amount"
              label="Amount in pounds"
              inputMode="decimal"
              placeholder="e.g. 45"
              defaultValue={values.amount}
              error={errors.amount}
            />
          )}
          <TextField
            id={`${idPrefix}-bookingReference`}
            name="bookingReference"
            label="Booking reference (optional)"
            defaultValue={values.bookingReference}
            error={errors.bookingReference}
          />
          <TextField
            id={`${idPrefix}-recordedBy`}
            name="recordedBy"
            label="Recorded by (optional)"
            defaultValue={values.recordedBy}
            error={errors.recordedBy}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </form>
    </div>
  );
}
