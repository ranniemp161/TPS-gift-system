import type { FundStatus } from "@/lib/fund-rules";

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const statusText: Record<FundStatus, string> = {
  open: "Open for gifts",
  closed: "Closed to new gifts, credit can still be used",
  expired: "Credit has expired",
};

/** Explains how a fund's dates fit together: due date, close date, credit expiry. */
export function FundTimeline({
  dueDate,
  closeDate,
  expiryDate,
  status,
}: {
  dueDate: string;
  closeDate: string;
  expiryDate: string;
  status?: FundStatus;
}) {
  const steps = [
    {
      title: "Baby's due date",
      date: dueDate,
      note: "Everything is counted from this date.",
    },
    {
      title: "Fund closes",
      date: closeDate,
      note: "28 days after the due date. No new gifts after this.",
    },
    {
      title: "Credit expires",
      date: expiryDate,
      note: "12 months after the fund closes. Unused credit ends.",
    },
  ];

  return (
    <div className="space-y-3">
      {status ? (
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Right now: {statusText[status]}
        </p>
      ) : null}
      <ol className="space-y-3 border-l-2 border-zinc-300 pl-4 dark:border-zinc-700">
        {steps.map((step) => (
          <li key={step.title}>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {step.title}: {formatDate(step.date)}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {step.note}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
