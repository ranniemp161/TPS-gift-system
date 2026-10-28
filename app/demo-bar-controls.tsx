"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
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

type PageRole = { label: string; audience: string };

function pageRole(pathname: string): PageRole | null {
  if (pathname === "/") {
    return { label: "Home", audience: "For anyone trying the demo" };
  }
  if (pathname === "/fund/new") {
    return {
      label: "Create a fund",
      audience:
        "For the organiser (a friend or family member) or the mum herself",
    };
  }
  if (/^\/fund\/[^/]+\/me$/.test(pathname)) {
    return {
      label: "Mum page (private)",
      audience:
        "For the mum only: her balance, top-ups and credit requests",
    };
  }
  if (/^\/fund\/[^/]+$/.test(pathname)) {
    return {
      label: "Public page",
      audience: "For guests: family and friends who want to give",
    };
  }
  if (/^\/fund\/[^/]+\/give$/.test(pathname)) {
    return { label: "Public page", audience: "For guests: giving to the fund" };
  }
  if (/^\/fund\/[^/]+\/thanks$/.test(pathname)) {
    return { label: "Public page", audience: "For guests, after paying" };
  }
  if (pathname === "/admin/login") {
    return { label: "Admin sign-in", audience: "For the TPS team" };
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return {
      label: "Admin (TPS team)",
      audience: "For the TPS team: all funds and credit used",
    };
  }
  if (pathname === "/outbox") {
    return {
      label: "Outbox (demo emails)",
      audience: "Demo only: every email the system would send",
    };
  }
  return null;
}

export function DemoBarLinksForRoute() {
  const { slug } = useParams<{ slug?: string }>();
  const role = pageRole(usePathname());
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {role ? (
        <>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {role.label}
          </span>
          <span>{role.audience}</span>
        </>
      ) : null}
      <DemoBarLinks slug={slug} />
    </div>
  );
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
