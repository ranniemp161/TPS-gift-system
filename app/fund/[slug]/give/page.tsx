import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  formatPence,
  fundStatus,
  MIN_AMOUNT_PENCE,
  todayIsoDate,
} from "@/lib/fund-rules";
import { getPublicFund } from "../data";
import { giveToFund } from "./actions";
import { GiveForm } from "./give-form";

export const instant = false;

export const metadata = {
  title: "Give to a gift fund",
};

function formatIsoDateEnGb(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

export default async function GivePage({ params }: PageProps<"/fund/[slug]/give">) {
  const { slug } = await params;
  await connection();
  const fund = await getPublicFund(slug);

  if (!fund) {
    notFound();
  }

  const isClosed = fundStatus(fund.closeDate, todayIsoDate()) !== "open";

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        {isClosed ? (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {fund.mumFirstName}&apos;s gift fund
            </h1>
            <p className="text-base text-zinc-600 dark:text-zinc-400">
              This fund closed on {formatIsoDateEnGb(fund.closeDate)} and no longer
              accepts gifts.
            </p>
            <Link
              href={`/fund/${fund.slug}`}
              className="inline-flex text-sm font-medium text-zinc-900 underline hover:no-underline dark:text-zinc-100"
            >
              Back to the fund page
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <header className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Give to {fund.mumFirstName}&apos;s gift fund
              </h1>
              <p className="text-base text-zinc-600 dark:text-zinc-400">
                Your gift becomes prepaid TPS gift credit for postpartum support
                services. The card fee is added on top and shown before you pay.
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Minimum gift {formatPence(MIN_AMOUNT_PENCE)}.
              </p>
            </header>

            <GiveForm action={giveToFund.bind(null, fund.slug)} />
          </div>
        )}
      </main>
    </div>
  );
}
