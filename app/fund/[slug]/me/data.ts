import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  contributions,
  creditLedger,
  creditRequests,
  funds,
} from "@/db/schema";
import {
  creditBalancePence,
  type LedgerEntryItem,
  todayIsoDate,
} from "@/lib/fund-rules";

export type MumGift = {
  id: string;
  name: string;
  message: string | null;
  amountPence: number;
  showAmount: boolean;
  createdAt: Date;
};

export type MumTopup = {
  id: string;
  amountPence: number;
  createdAt: Date;
};

export type MumCreditRequest = {
  id: string;
  service: string;
  amountRequestedPence: number;
  status: "new" | "done";
  createdAt: Date;
};

export type MumFund = {
  id: string;
  slug: string;
  mumFirstName: string;
  mumEmail: string;
  closeDate: string;
  goalPence: number | null;
  note: string | null;
  ledger: LedgerEntryItem[];
  gifts: MumGift[];
  topups: MumTopup[];
  creditRequests: MumCreditRequest[];
  openRequestsPence: number;
  availableCreditPence: number;
};

export async function getMumFund(slug: string): Promise<MumFund | null> {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 100) {
    return null;
  }

  const db = getDb();

  const [fundRow] = await db
    .select({
      id: funds.id,
      slug: funds.slug,
      mumFirstName: funds.mumFirstName,
      mumEmail: funds.mumEmail,
      closeDate: funds.closeDate,
      goalPence: funds.goalPence,
      note: funds.note,
    })
    .from(funds)
    .where(eq(funds.slug, slug))
    .limit(1);

  if (!fundRow) {
    return null;
  }

  const [ledger, contributionRows, creditRequestRows] = await Promise.all([
    db
      .select({
        entry: creditLedger.entry,
        amountPence: creditLedger.amountPence,
      })
      .from(creditLedger)
      .where(eq(creditLedger.fundId, fundRow.id)),
    db
      .select({
        id: contributions.id,
        type: contributions.type,
        name: contributions.name,
        message: contributions.message,
        amountPence: contributions.amountPence,
        showAmount: contributions.showAmount,
        createdAt: contributions.createdAt,
      })
      .from(contributions)
      .where(
        and(
          eq(contributions.fundId, fundRow.id),
          eq(contributions.status, "paid"),
        ),
      )
      .orderBy(desc(contributions.createdAt)),
    db
      .select({
        id: creditRequests.id,
        service: creditRequests.service,
        amountRequestedPence: creditRequests.amountRequestedPence,
        status: creditRequests.status,
        createdAt: creditRequests.createdAt,
      })
      .from(creditRequests)
      .where(eq(creditRequests.fundId, fundRow.id))
      .orderBy(desc(creditRequests.createdAt)),
  ]);

  const openRequestsPence = creditRequestRows
    .filter((row) => row.status === "new")
    .reduce((sum, row) => sum + row.amountRequestedPence, 0);
  const balancePence = creditBalancePence(
    ledger,
    fundRow.closeDate,
    todayIsoDate(),
  );

  const gifts: MumGift[] = [];
  const topups: MumTopup[] = [];

  for (const row of contributionRows) {
    if (row.type === "guest") {
      gifts.push({
        id: row.id,
        name: row.name,
        message: row.message,
        amountPence: row.amountPence,
        showAmount: row.showAmount,
        createdAt: row.createdAt,
      });
    } else if (row.type === "topup") {
      topups.push({
        id: row.id,
        amountPence: row.amountPence,
        createdAt: row.createdAt,
      });
    }
  }

  return {
    id: fundRow.id,
    slug: fundRow.slug,
    mumFirstName: fundRow.mumFirstName,
    mumEmail: fundRow.mumEmail,
    closeDate: fundRow.closeDate,
    goalPence: fundRow.goalPence,
    note: fundRow.note,
    ledger,
    gifts,
    topups,
    creditRequests: creditRequestRows,
    openRequestsPence,
    availableCreditPence: Math.max(0, balancePence - openRequestsPence),
  };
}
