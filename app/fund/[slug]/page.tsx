import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { currentIsoDate } from "@/lib/demo-clock";
import {
  expiryDateFor,
  formatPence,
  fundStatus,
} from "@/lib/fund-rules";
import { requestOrigin } from "@/lib/request-origin";
import { getPublicFund } from "./data";
import { ShareLink } from "./share-link";

export const metadata = {
  title: "Gift fund",
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

async function FundContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await connection();
  const today = await currentIsoDate();
  const fund = await getPublicFund(slug);

  if (!fund) {
    notFound();
  }

  const headerList = await headers();
  const shareUrl = `${requestOrigin(headerList)}/fund/${fund.slug}`;
  const status = fundStatus(fund.closeDate, today);
  const expiryDate = expiryDateFor(fund.closeDate);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {fund.mumFirstName}&apos;s gift fund
        </h1>
        {fund.note ? (
          <p className="whitespace-pre-line text-base text-zinc-600 dark:text-zinc-400">
            {fund.note}
          </p>
        ) : null}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gifts become prepaid TPS gift credit for postpartum support services.
        </p>
      </header>

      <section aria-labelledby="total-heading" className="space-y-3">
        <h2 id="total-heading" className="sr-only">
          Total given
        </h2>
        <div className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatPence(fund.totalPence)} given
        </div>
        {fund.goalPence !== null ? (
          <div className="space-y-1.5">
            <label
              htmlFor="fund-goal-progress"
              id="fund-goal-label"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {formatPence(fund.totalPence)} given of{" "}
              {formatPence(fund.goalPence)} goal
            </label>
            <progress
              id="fund-goal-progress"
              aria-labelledby="fund-goal-label"
              value={Math.min(fund.totalPence, fund.goalPence)}
              max={fund.goalPence}
              className="h-3 w-full overflow-hidden rounded-full accent-zinc-900 dark:accent-zinc-100"
            />
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-1 text-sm">
          {status === "open" ? (
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              Open for gifts until {formatIsoDateEnGb(fund.closeDate)}
            </p>
          ) : (
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              This fund closed on {formatIsoDateEnGb(fund.closeDate)}
            </p>
          )}
          <p className="text-zinc-600 dark:text-zinc-400">
            Gift credit can be used until {formatIsoDateEnGb(expiryDate)}
          </p>
        </div>

        {status === "open" ? (
          <div>
            <Link
              href={`/fund/${fund.slug}/give`}
              className="inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Contribute
            </Link>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="share-heading">
        <h2 id="share-heading" className="sr-only">
          Share fund
        </h2>
        <ShareLink shareUrl={shareUrl} />
      </section>

      <section aria-labelledby="messages-heading" className="space-y-4">
        <h2
          id="messages-heading"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          Messages
        </h2>

        {fund.gifts.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No gifts yet.{status === "open" ? " Be the first to give." : ""}
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
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {gift.amountPence !== null ? (
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatPence(gift.amountPence)}
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
    </div>
  );
}

export default function FundPage({ params }: PageProps<"/fund/[slug]">) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <Suspense
          fallback={
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Loading fund...
            </p>
          }
        >
          <FundContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}
