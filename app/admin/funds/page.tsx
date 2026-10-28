import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentIsoDate } from "@/lib/demo-clock";
import { formatPence } from "@/lib/fund-rules";
import { applyCreditRequest, recordCreditUsed } from "./actions";
import { CreditUsedForm } from "./credit-used-form";
import { type AdminFund, getAdminFunds } from "./data";

export const metadata = {
  title: "Admin: funds",
};

function formatIsoDateEnGb(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatDateEnGb(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/London",
  }).format(date);
}

const statusLabels: Record<AdminFund["status"], string> = {
  open: "Open",
  closed: "Closed",
  expired: "Expired",
};

const badgeClass =
  "rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

const subheadingClass =
  "text-sm font-semibold text-zinc-900 dark:text-zinc-100";

const mutedClass = "text-sm text-zinc-600 dark:text-zinc-400";

function FundCard({ fund }: { fund: AdminFund }) {
  const headingId = `fund-${fund.id}-heading`;
  const canDebit = fund.status !== "expired" && fund.usableBalancePence > 0;

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-8"
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id={headingId}
            className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            {fund.mumFirstName}
          </h2>
          <span className={badgeClass}>{statusLabels[fund.status]}</span>
        </div>
        <p className={`${mutedClass} break-all`}>{fund.mumEmail}</p>
        <Link
          href={`/fund/${fund.slug}/me`}
          className="text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
        >
          Open {fund.mumFirstName}&apos;s mum page
        </Link>
      </header>

      <dl className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Usable balance</dt>
          <dd className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatPence(fund.usableBalancePence)}
          </dd>
          {fund.status === "expired" && fund.ledgerBalancePence > 0 ? (
            <dd className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatPence(fund.ledgerBalancePence)} left on the ledger, expired
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Closes</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatIsoDateEnGb(fund.closeDate)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Credit expires</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatIsoDateEnGb(fund.expiryDate)}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <h3 className={subheadingClass}>
          Open credit requests ({fund.openRequests.length})
        </h3>
        {fund.openRequests.length === 0 ? (
          <p className={mutedClass}>No open requests.</p>
        ) : (
          <ul className="space-y-4">
            {fund.openRequests.map((request) => (
              <li
                key={request.id}
                className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {request.service}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatPence(request.amountRequestedPence)}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Requested{" "}
                  <time dateTime={request.createdAt.toISOString()}>
                    {formatDateEnGb(request.createdAt)}
                  </time>
                  {request.amountRequestedPence > fund.usableBalancePence
                    ? ". More than the usable balance, cannot be applied."
                    : ""}
                </p>
                {fund.status !== "expired" ? (
                  <CreditUsedForm
                    action={applyCreditRequest.bind(null, fund.id, request.id)}
                    idPrefix={`request-${request.id}`}
                    withAmount={false}
                    submitLabel={`Apply ${formatPence(request.amountRequestedPence)}`}
                    pendingLabel="Applying..."
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className={subheadingClass}>Record credit used</h3>
        {canDebit ? (
          <CreditUsedForm
            action={recordCreditUsed.bind(null, fund.id)}
            idPrefix={`debit-${fund.id}`}
            withAmount
            submitLabel="Record credit used"
            pendingLabel="Recording..."
          />
        ) : (
          <p className={mutedClass}>
            {fund.status === "expired"
              ? "This credit has expired and can no longer be used."
              : "There is no balance to use."}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className={subheadingClass}>
          Paid contributions ({fund.contributions.length})
        </h3>
        {fund.contributions.length === 0 ? (
          <p className={mutedClass}>No paid contributions yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {fund.contributions.map((contribution) => (
              <li
                key={contribution.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="text-zinc-900 dark:text-zinc-100">
                  {contribution.type === "topup"
                    ? "Top-up"
                    : `Gift from ${contribution.name}`}
                </span>
                <span className="flex items-baseline gap-3">
                  <time
                    dateTime={contribution.createdAt.toISOString()}
                    className="text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {formatDateEnGb(contribution.createdAt)}
                  </time>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatPence(contribution.amountPence)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {fund.completedRequests.length > 0 ? (
        <div className="space-y-3">
          <h3 className={subheadingClass}>Applied requests</h3>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {fund.completedRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="text-zinc-900 dark:text-zinc-100">
                  {request.service}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className={badgeClass}>Applied</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatPence(request.amountRequestedPence)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

async function AdminFundsContent() {
  await connection();
  const funds = await getAdminFunds(await currentIsoDate());

  if (funds.length === 0) {
    return (
      <p className={mutedClass}>
        No funds yet. Funds appear here once a mum page is created.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {funds.map((fund) => (
        <FundCard key={fund.id} fund={fund} />
      ))}
    </div>
  );
}

export default function AdminFundsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Funds admin
          </h1>
          <p className={mutedClass}>
            Demo TPS team view. There is no sign-in in this demo, so use test
            data only.
          </p>
        </header>
        <Suspense fallback={<p className={mutedClass}>Loading funds...</p>}>
          <AdminFundsContent />
        </Suspense>
      </main>
    </div>
  );
}
