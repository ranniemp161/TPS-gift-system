import { getDemoDate } from "@/lib/demo-clock";
import {
  DemoBarLinks,
  DemoBarLinksForRoute,
  DemoDateControls,
} from "./demo-bar-controls";

const barClass =
  "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-zinc-200 bg-zinc-100 px-4 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";

export function DemoBarFallback() {
  return (
    <div className={barClass}>
      <DemoBarLinks />
    </div>
  );
}

export async function DemoBar() {
  const demoDate = await getDemoDate();
  const demoDateLabel = demoDate
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(`${demoDate}T00:00:00Z`))
    : null;

  return (
    <div className={barClass}>
      <DemoBarLinksForRoute />
      <DemoDateControls demoDate={demoDate} demoDateLabel={demoDateLabel} />
    </div>
  );
}
