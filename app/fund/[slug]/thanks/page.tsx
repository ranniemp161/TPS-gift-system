import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicFund } from "../data";

export const instant = false;

export const metadata = {
  title: "Thank you",
};

export default async function ThanksPage({ params }: PageProps<"/fund/[slug]/thanks">) {
  const { slug } = await params;
  await connection();
  const fund = await getPublicFund(slug);

  if (!fund) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <div className="space-y-6">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Thank you for your gift to {fund.mumFirstName}&apos;s fund
            </h1>
            <p className="text-base text-zinc-600 dark:text-zinc-400">
              Your gift becomes TPS gift credit. It will appear on the fund page once
              your payment is confirmed.
            </p>
          </header>

          <Link
            href={`/fund/${fund.slug}`}
            className="inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back to the fund page
          </Link>
        </div>
      </main>
    </div>
  );
}
