import { desc } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db";
import { outbox } from "@/db/schema";

export const metadata = {
  title: "Outbox",
};

const mutedClass = "text-sm text-zinc-600 dark:text-zinc-400";

const sentAtFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

async function OutboxList() {
  await connection();
  const emails = await getDb()
    .select()
    .from(outbox)
    .orderBy(desc(outbox.createdAt));

  if (emails.length === 0) {
    return (
      <p className={mutedClass}>
        No emails yet. Emails appear here when a fund is created, a gift or
        top-up is paid, or credit is requested or used.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {emails.map((email) => (
        <li
          key={email.id}
          className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">To</dt>
              <dd className="break-all text-zinc-900 dark:text-zinc-100">
                {email.to}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">Subject</dt>
              <dd className="font-semibold text-zinc-900 dark:text-zinc-100">
                {email.subject}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">Sent</dt>
              <dd className="text-zinc-900 dark:text-zinc-100">
                {sentAtFormat.format(email.createdAt)}
              </dd>
            </div>
          </dl>
          <p className="whitespace-pre-wrap break-words border-t border-zinc-200 pt-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            {email.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function OutboxPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Outbox
          </h1>
          <p className={mutedClass}>
            Demo emails. These were recorded here and never sent to a real
            inbox.
          </p>
        </header>
        <Suspense fallback={<p className={mutedClass}>Loading emails...</p>}>
          <OutboxList />
        </Suspense>
      </main>
    </div>
  );
}
