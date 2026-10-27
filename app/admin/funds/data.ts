import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  contributions,
  creditLedger,
  creditRequests,
  funds,
} from "@/db/schema";
import {
  creditBalancePence,
  expiryDateFor,
  fundStatus,
  type FundStatus,
  ledgerBalancePence,
  type LedgerEntryItem,
} from "@/lib/fund-rules";

export type AdminContribution = {
  id: string;
  type: "guest" | "topup";
  name: string;
  amountPence: number;
  createdAt: Date;
};

export type AdminCreditRequest = {
  id: string;
  service: string;
  amountRequestedPence: number;
  status: "new" | "done";
  createdAt: Date;
};

export type AdminFund = {
  id: string;
  slug: string;
  mumFirstName: string;
  mumEmail: string;
  closeDate: string;
  expiryDate: string;
  status: FundStatus;
  ledgerBalancePence: number;
  usableBalancePence: number;
  contributions: AdminContribution[];
  openRequests: AdminCreditRequest[];
  completedRequests: AdminCreditRequest[];
};

function groupByFund<T extends { fundId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.fundId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(row.fundId, [row]);
    }
  }
  return grouped;
}

export async function getAdminFunds(today: string): Promise<AdminFund[]> {
  const db = getDb();

  const [fundRows, ledgerRows, contributionRows, requestRows] =
    await Promise.all([
      db
        .select({
          id: funds.id,
          slug: funds.slug,
          mumFirstName: funds.mumFirstName,
          mumEmail: funds.mumEmail,
          closeDate: funds.closeDate,
        })
        .from(funds)
        .orderBy(desc(funds.createdAt)),
      db
        .select({
          fundId: creditLedger.fundId,
          entry: creditLedger.entry,
          amountPence: creditLedger.amountPence,
        })
        .from(creditLedger),
      db
        .select({
          id: contributions.id,
          fundId: contributions.fundId,
          type: contributions.type,
          name: contributions.name,
          amountPence: contributions.amountPence,
          createdAt: contributions.createdAt,
        })
        .from(contributions)
        .where(eq(contributions.status, "paid"))
        .orderBy(desc(contributions.createdAt)),
      db
        .select({
          id: creditRequests.id,
          fundId: creditRequests.fundId,
          service: creditRequests.service,
          amountRequestedPence: creditRequests.amountRequestedPence,
          status: creditRequests.status,
          createdAt: creditRequests.createdAt,
        })
        .from(creditRequests)
        .orderBy(asc(creditRequests.createdAt)),
    ]);

  const ledgerByFund = groupByFund(ledgerRows);
  const contributionsByFund = groupByFund(contributionRows);
  const requestsByFund = groupByFund(requestRows);

  return fundRows.map((fund) => {
    const ledger: LedgerEntryItem[] = ledgerByFund.get(fund.id) ?? [];
    const requests: AdminCreditRequest[] = requestsByFund.get(fund.id) ?? [];

    return {
      ...fund,
      expiryDate: expiryDateFor(fund.closeDate),
      status: fundStatus(fund.closeDate, today),
      ledgerBalancePence: ledgerBalancePence(ledger),
      usableBalancePence: creditBalancePence(ledger, fund.closeDate, today),
      contributions: contributionsByFund.get(fund.id) ?? [],
      openRequests: requests.filter((request) => request.status === "new"),
      completedRequests: requests
        .filter((request) => request.status === "done")
        .reverse(),
    };
  });
}
