"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { formatPence, parsePoundsToPence } from "@/lib/fund-rules";
import {
  calculateCreditRequest,
  getServiceById,
  SERVICES,
} from "@/lib/services";
import type { CreditRequestState } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const treatments = SERVICES.filter((service) => service.kind === "treatment");
const programmes = SERVICES.filter((service) => service.kind === "programme");

function creditPreview(
  serviceId: string,
  amount: string,
  availableCreditPence: number,
): string {
  const service = getServiceById(serviceId);
  if (!service) {
    return "Choose a service to see how much credit will be applied.";
  }
  if (service.kind === "treatment") {
    const { creditPence, shortfallPence } = calculateCreditRequest(
      service,
      availableCreditPence,
    );
    const summary = `${service.name} is ${formatPence(service.pricePence)}. ${formatPence(creditPence)} of your credit will be applied.`;
    return shortfallPence > 0
      ? `${summary} The remaining ${formatPence(shortfallPence)} will be settled with TPS.`
      : summary;
  }
  const amountPence = parsePoundsToPence(amount.trim());
  if (amountPence === null || amountPence <= 0) {
    return `Price agreed at consultation. Enter up to ${formatPence(availableCreditPence)} of credit to apply.`;
  }
  if (amountPence > availableCreditPence) {
    return `You can apply up to ${formatPence(availableCreditPence)}.`;
  }
  return `${formatPence(amountPence)} of your credit will be applied to the ${service.name}.`;
}

export function CreditRequestForm({
  action,
  availableCreditPence,
}: {
  action: (
    state: CreditRequestState,
    formData: FormData,
  ) => Promise<CreditRequestState>;
  availableCreditPence: number;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [serviceId, setServiceId] = useState("");
  const [amount, setAmount] = useState("");

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "invalid" || state.status === "error") {
      errorSummaryRef.current?.focus();
    }
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : {};
  const service = getServiceById(serviceId);

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
            There were problems with your request
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700 dark:text-red-300">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a
                  href={`#credit-${field}`}
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
            Request could not be sent
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        </div>
      )}

      <form action={formAction} noValidate className="space-y-6">
        <div>
          <label
            htmlFor="credit-service"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Service
          </label>
          <select
            id="credit-service"
            name="service"
            required
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
            aria-invalid={errors.service ? "true" : undefined}
            aria-describedby={
              errors.service
                ? "credit-preview credit-service-error"
                : "credit-preview"
            }
            className={inputClass}
          >
            <option value="">Choose a service</option>
            <optgroup label="Treatments">
              {treatments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.kind === "treatment"
                    ? ` (${formatPence(item.pricePence)})`
                    : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="Programmes (price agreed at consultation)">
              {programmes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          </select>
          {errors.service && (
            <p
              id="credit-service-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.service}
            </p>
          )}
        </div>

        {service?.kind === "programme" && (
          <div>
            <label
              htmlFor="credit-amount"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              Credit to apply in pounds
            </label>
            <input
              id="credit-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 100"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={errors.amount ? "true" : undefined}
              aria-describedby={
                errors.amount
                  ? "credit-preview credit-amount-error"
                  : "credit-preview"
              }
              className={inputClass}
            />
            {errors.amount && (
              <p
                id="credit-amount-error"
                className="mt-1 text-sm text-red-600 dark:text-red-400"
              >
                {errors.amount}
              </p>
            )}
          </div>
        )}

        <p
          id="credit-preview"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {creditPreview(serviceId, amount, availableCreditPence)}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Submitting request..." : "Request this credit"}
        </button>
      </form>
    </div>
  );
}
