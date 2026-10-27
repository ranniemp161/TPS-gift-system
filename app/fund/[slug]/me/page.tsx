import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  creditBalancePence,
  expiryDateFor,
  formatPence,
  fundStatus,
  todayIsoDate,
} from "@/lib/fund-rules";
import { requestOrigin } from "@/lib/request-origin";
import { topUpFund } from "./actions";
import { getMumFund } from "./data";
import { TopUpForm } from "./topup-form";

export const metadata = {
  title: "My gift credit",
};

function formatIsoDateEnGb(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function formatDateEnGb(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

async function MumFundContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  await connection();
  const today = todayIsoDate();
  const fund = await getMumFund(slug);

  if (!fund) {
    notFound();
  }

  const headerList = await headers();
  const shareUrl = `${requestOrigin(headerList)}/fund/${fund.slug}`;
  const status = fundStatus(fund.closeDate, today);
  const expiryDate = expiryDateFor(fund.closeDate);
  const balancePence = creditBalancePence(fund.ledger, fund.closeDate, today);
  const showTopUpSuccess = query.topup === "success";

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {fund.mumFirstName}&apos;s gift credit
        </h1>
        {fund.note ? (
          <p className="whitespace-pre-line text-base text-zinc-600 dark:text-zinc-400">
            {fund.note}
          </p>
        ) : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gifts and top-ups become prepaid TPS gift credit for postpartum
          support services.
        </p>
      </header>

      {showTopUpSuccess ? (
        <div
          role="status"
          className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          Thanks, your top-up will be added to your balance once your payment is
          confirmed.
        </div>
      ) : null}

      <section
        aria-labelledby="balance-heading"
        className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2
          id="balance-heading"
          className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          TPS gift credit balance
        </h2>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatPence(balancePence)}
          </span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {status === "expired"
              ? `Expired on ${formatIsoDateEnGb(expiryDate)}`
              : `Expires on ${formatIsoDateEnGb(expiryDate)}`}
          </span>
        </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {status === "open"
            ? `Open for gifts until ${formatIsoDateEnGb(fund.closeDate)}.`
            : status === "closed"
              ? `Closed on ${formatIsoDateEnGb(fund.closeDate)}, credit can still be used until ${formatIsoDateEnGb(expiryDate)}.`
              : `Credit expired on ${formatIsoDateEnGb(expiryDate)}.`}
        </p>
      </section>

      <section aria-labelledby="public-page-heading" className="space-y-2">
        <h2
          id="public-page-heading"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Public fund page
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Share link:{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-900 select-all dark:bg-zinc-900 dark:text-zinc-100">
            {shareUrl}
          </code>
        </p>
        <div>
          <Link
            href={`/fund/${fund.slug}`}
            className="text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
          >
            View public fund page
          </Link>
        </div>
      </section>

      <section aria-labelledby="topup-heading" className="space-y-4">
        <h2
          id="topup-heading"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Top up my credit
        </h2>

        {status === "open" ? (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Add your own money as TPS gift credit with the same expiry date
              ({formatIsoDateEnGb(expiryDate)}). Top-ups are private and never
              shown on the public page. Minimum £10, with the card processing
              fee added on top.
            </p>
            <TopUpForm action={topUpFund.bind(null, fund.slug)} />
          </>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Top-ups closed on {formatIsoDateEnGb(fund.closeDate)}.
          </p>
        )}
      </section>

      <section aria-labelledby="gifts-heading" className="space-y-4">
        <h2
          id="gifts-heading"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Gifts
        </h2>

        {fund.gifts.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No gifts yet
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {fund.gifts.map((gift) => (
              <li
                key={gift.id}
                className="space-y-1 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {gift.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatPence(gift.amountPence)}
                    </span>
                    {!gift.showAmount ? (
                      <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        Hidden on the public page
                      </span>
                    ) : null}
                    <time dateTime={gift.createdAt.toISOString()}>
                      {formatDateEnGb(gift.createdAt)}
                    </time>
                  </div>
                </div>
                {gift.message ? (
                  <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
                    {gift.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="topups-heading" className="space-y-4">
        <h2
          id="topups-heading"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Top-ups
        </h2>

        {fund.topups.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No top-ups yet
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {fund.topups.map((topup) => (
              <li
                key={topup.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-4 text-sm first:pt-0 last:pb-0"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatPence(topup.amountPence)}
                </span>
                <time
                  dateTime={topup.createdAt.toISOString()}
                  className="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {formatDateEnGb(topup.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MumFundPage({
  params,
  searchParams,
}: PageProps<"/fund/[slug]/me">) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <Suspense
          fallback={
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading gift credit...
            </p>
          }
        >
          <MumFundContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
