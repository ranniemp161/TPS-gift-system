"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createFund, type CreateFundState } from "./actions";

const initialState: CreateFundState = { status: "idle" };

function formatDateEnGb(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export function CreateFundForm() {
  const [state, formAction, pending] = useActionState(createFund, initialState);
  const [submissionCount, setSubmissionCount] = useState(0);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.status === "invalid" || state.status === "error") {
      errorSummaryRef.current?.focus();
    } else if (state.status === "created") {
      confirmationHeadingRef.current?.focus();
    }
  }, [state]);

  if (state.status === "created") {
    return (
      <div className="space-y-6">
        <h2
          ref={confirmationHeadingRef}
          tabIndex={-1}
          className="text-2xl font-bold tracking-tight text-zinc-900 outline-none dark:text-zinc-50"
        >
          {state.mumFirstName}&apos;s gift fund is live
        </h2>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">
                Public fund page
              </dt>
              <dd className="mt-1">
                <Link
                  href={`/fund/${state.slug}`}
                  className="font-mono text-zinc-950 underline hover:no-underline dark:text-zinc-50"
                >
                  /fund/{state.slug}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">
                Mum page (manage fund)
              </dt>
              <dd className="mt-1">
                <Link
                  href={`/fund/${state.slug}/me`}
                  className="font-mono text-zinc-950 underline hover:no-underline dark:text-zinc-50"
                >
                  /fund/{state.slug}/me
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">
                Fund closes (28 days after the due date)
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatDateEnGb(state.closeDate)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600 dark:text-zinc-400">
                Credit expires (12 months after the fund closes)
              </dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {formatDateEnGb(state.expiryDate)}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <Link
            href="/fund/new"
            className="inline-flex items-center text-sm font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
          >
            Create another fund
          </Link>
        </div>
      </div>
    );
  }

  const values =
    state.status === "invalid" || state.status === "error"
      ? state.values
      : {
          mumFirstName: "",
          mumEmail: "",
          organiserEmail: "",
          dueDate: "",
          goal: "",
          note: "",
        };

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
            There were problems with your submission
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
            Submission failed
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {state.message}
          </p>
        </div>
      )}

      <form
        key={`create-fund-${submissionCount}`}
        action={async (formData) => {
          setSubmissionCount((c) => c + 1);
          await formAction(formData);
        }}
        noValidate
        className="space-y-6"
      >
        <div>
          <label
            htmlFor="mumFirstName"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Mum&apos;s first name
          </label>
          <input
            id="mumFirstName"
            name="mumFirstName"
            type="text"
            required
            maxLength={50}
            defaultValue={values.mumFirstName}
            aria-invalid={errors.mumFirstName ? "true" : undefined}
            aria-describedby={
              errors.mumFirstName ? "mumFirstName-error" : undefined
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {errors.mumFirstName && (
            <p
              id="mumFirstName-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.mumFirstName}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="mumEmail"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Mum&apos;s email
          </label>
          <input
            id="mumEmail"
            name="mumEmail"
            type="email"
            required
            maxLength={254}
            defaultValue={values.mumEmail}
            aria-invalid={errors.mumEmail ? "true" : undefined}
            aria-describedby={errors.mumEmail ? "mumEmail-error" : undefined}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {errors.mumEmail && (
            <p
              id="mumEmail-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.mumEmail}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="organiserEmail"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Your email{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional, leave blank if you are the mum)
            </span>
          </label>
          <input
            id="organiserEmail"
            name="organiserEmail"
            type="email"
            maxLength={254}
            defaultValue={values.organiserEmail}
            aria-invalid={errors.organiserEmail ? "true" : undefined}
            aria-describedby={
              errors.organiserEmail ? "organiserEmail-error" : undefined
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {errors.organiserEmail && (
            <p
              id="organiserEmail-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.organiserEmail}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="dueDate"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Baby&apos;s due date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={values.dueDate}
            aria-invalid={errors.dueDate ? "true" : undefined}
            aria-describedby={
              errors.dueDate ? "dueDate-hint dueDate-error" : "dueDate-hint"
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <p
            id="dueDate-hint"
            className="mt-1 text-sm text-zinc-600 dark:text-zinc-400"
          >
            Guests can give until 28 days after the baby&apos;s due date. The
            gift credit then lasts 12 months from that day.
          </p>
          {errors.dueDate && (
            <p
              id="dueDate-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.dueDate}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="goal"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Goal in pounds{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional)
            </span>
          </label>
          <input
            id="goal"
            name="goal"
            type="text"
            placeholder="e.g. 250"
            defaultValue={values.goal}
            aria-invalid={errors.goal ? "true" : undefined}
            aria-describedby={errors.goal ? "goal-error" : undefined}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {errors.goal && (
            <p
              id="goal-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.goal}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="note"
            className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Note{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional)
            </span>
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={1000}
            defaultValue={values.note}
            aria-invalid={errors.note ? "true" : undefined}
            aria-describedby={errors.note ? "note-error" : undefined}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          {errors.note && (
            <p
              id="note-error"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {errors.note}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Creating..." : "Create fund"}
        </button>
      </form>
    </div>
  );
}
