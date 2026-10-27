import Link from "next/link";

const linkClass =
  "inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-4 py-16 dark:bg-black sm:px-6">
      <main className="w-full max-w-xl space-y-8 rounded-xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-950 sm:p-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            TPS Gift Fund
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Friends and family give any amount toward The Postpartum Suite.
            Everything becomes prepaid TPS credit for postpartum support
            services.
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            This is a demo. Payments use Stripe test mode and emails are only
            recorded in the app, never sent to a real inbox.
          </p>
        </header>

        <nav aria-label="Demo screens" className="space-y-3">
          <Link
            href="/fund/new"
            className={`${linkClass} w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200`}
          >
            Create a gift fund
          </Link>
          <Link
            href="/admin/funds"
            className={`${linkClass} w-full border border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900`}
          >
            TPS team screen
          </Link>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            The TPS team screen asks for the admin password.
          </p>
        </nav>
      </main>
    </div>
  );
}
