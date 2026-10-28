"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useActionState } from "react";
import { clearDemoDate, type DemoDateState, setDemoDate } from "./demo-actions";

const linkClass = "underline-offset-2 hover:underline";
const buttonClass =
  "cursor-pointer rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900";

export function DemoBarLinks({ slug }: { slug?: string }) {
  return (
    <nav aria-label="Demo links" className="flex flex-wrap gap-x-4 gap-y-1">
      <Link href="/" className={linkClass}>
        Home
      </Link>
      {slug ? (
        <Link href={`/fund/${slug}/me`} className={linkClass}>
          Mum page
        </Link>
      ) : null}
      <Link href="/admin/funds" className={linkClass}>
        Admin
      </Link>
      <Link href="/outbox" className={linkClass}>
        Outbox
      </Link>
    </nav>
  );
}

export function DemoBarLinksForRoute() {
  const { slug } = useParams<{ slug?: string }>();
  return <DemoBarLinks slug={slug} />;
}

export function DemoDateControls({
  demoDate,
  demoDateLabel,
}: {
  demoDate: string | null;
  demoDateLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState<DemoDateState, FormData>(
    setDemoDate,
    { status: "idle" },
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p>
        {demoDateLabel ? `Demo date: ${demoDateLabel}` : "Using today's date"}
      </p>
      <form action={formAction} className="flex items-center gap-2">
        <label htmlFor="demo-date">Pretend today is</label>
        <input
          id="demo-date"
          name="demoDate"
          type="date"
          key={demoDate ?? "real"}
          defaultValue={demoDate ?? ""}
          aria-describedby="demo-date-status"
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          Set
        </button>
      </form>
      {demoDate ? (
        <form action={clearDemoDate}>
          <button type="submit" className={buttonClass}>
            Use real date
          </button>
        </form>
      ) : null}
      <p
        id="demo-date-status"
        role="status"
        aria-live="polite"
        className="text-red-700 dark:text-red-400"
      >
        {state.status === "error" ? state.message : ""}
      </p>
    </div>
  );
}
