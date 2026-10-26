import type { creditLedger } from "@/db/schema";

export const MIN_AMOUNT_PENCE = 1000;

export function meetsMinimum(amountPence: number): boolean {
  return Number.isSafeInteger(amountPence) && amountPence >= MIN_AMOUNT_PENCE;
}

/** Card fee rounded up to the nearest penny using integer arithmetic to avoid float drift. */
export function cardFeePence(amountPence: number): number {
  if (!Number.isSafeInteger(amountPence) || amountPence <= 0) {
    throw new RangeError("Amount must be a positive safe integer in pence");
  }

  const numerator = (amountPence + 20) * 1000;
  if (!Number.isSafeInteger(numerator + 984)) {
    throw new RangeError("Amount is too large to compute the fee exactly");
  }
  const totalPence = Math.floor((numerator + 984) / 985);
  return totalPence - amountPence;
}

export function parsePoundsToPence(input: string): number | null {
  if (typeof input !== "string") {
    return null;
  }
  let trimmed = input.trim();
  if (trimmed.startsWith("£")) {
    trimmed = trimmed.slice(1).trim();
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [poundsStr, penceStr = ""] = trimmed.split(".");
  const pencePadded = penceStr.padEnd(2, "0");
  const totalPenceStr = `${poundsStr}${pencePadded}`.replace(/^0+(?=\d)/, "");
  const totalPence = Number(totalPenceStr);
  if (!Number.isSafeInteger(totalPence)) {
    return null;
  }
  return totalPence;
}

export function formatPence(pence: number): string {
  if (!Number.isSafeInteger(pence)) {
    throw new RangeError("Pence must be a safe integer");
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function parseIsoDate(dateStr: string): { year: number; month: number; day: number } {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new RangeError(`Invalid date format (expected YYYY-MM-DD): "${dateStr}"`);
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: "${dateStr}"`);
  }
  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function closeDateFor(dueDate: string): string {
  const { year, month, day } = parseIsoDate(dueDate);
  const date = new Date(Date.UTC(year, month - 1, day + 28));
  return formatIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

/** Computes the credit expiry date as close date plus 12 months, clamped to month end. */
export function expiryDateFor(closeDate: string): string {
  const { year, month, day } = parseIsoDate(closeDate);
  const targetYear = year + 1;
  const targetMonth = month;
  const maxDays = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDays);
  return formatIsoDate(targetYear, targetMonth, clampedDay);
}

export type FundStatus = "open" | "closed" | "expired";

export function fundStatus(closeDate: string, today: string): FundStatus {
  const expiryDate = expiryDateFor(closeDate);
  parseIsoDate(today);

  if (today <= closeDate) {
    return "open";
  }
  if (today <= expiryDate) {
    return "closed";
  }
  return "expired";
}

export type LedgerEntryItem = Pick<
  typeof creditLedger.$inferSelect,
  "entry" | "amountPence"
>;

export function ledgerBalancePence(entries: readonly LedgerEntryItem[]): number {
  let balance = 0;
  for (const entry of entries) {
    if (entry.entry === "credit") {
      balance += entry.amountPence;
    } else if (entry.entry === "debit") {
      balance -= entry.amountPence;
    }
  }
  return balance;
}

export function creditBalancePence(
  entries: readonly LedgerEntryItem[],
  closeDate: string,
  today: string
): number {
  if (fundStatus(closeDate, today) === "expired") {
    return 0;
  }
  return ledgerBalancePence(entries);
}
