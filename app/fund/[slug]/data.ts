import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { contributions, funds } from "@/db/schema";

export type PublicGift = {
  id: string;
  name: string;
  message: string | null;
  amountPence: number | null; // null when show_amount is false
  createdAt: Date;
};

export type PublicFund = {
  slug: string;
  mumFirstName: string;
  closeDate: string; // YYYY-MM-DD
  goalPence: number | null;
  note: string | null;
  totalPence: number; // all paid guest gifts, hidden amounts included
  gifts: PublicGift[];
};

export async function getPublicFund(slug: string): Promise<PublicFund | null> {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 100) {
    return null;
  }

  const db = getDb();

  const [fundRow] = await db
    .select({
      id: funds.id,
      slug: funds.slug,
      mumFirstName: funds.mumFirstName,
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

  const contributionRows = await db
    .select({
      id: contributions.id,
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
        eq(contributions.type, "guest"),
        eq(contributions.status, "paid"),
      ),
    )
    .orderBy(desc(contributions.createdAt));

  let totalPence = 0;
  for (const row of contributionRows) {
    totalPence += row.amountPence;
  }

  const gifts: PublicGift[] = contributionRows.map((row) => ({
    id: row.id,
    name: row.name,
    message: row.message,
    amountPence: row.showAmount ? row.amountPence : null,
    createdAt: row.createdAt,
  }));

  return {
    slug: fundRow.slug,
    mumFirstName: fundRow.mumFirstName,
    closeDate: fundRow.closeDate,
    goalPence: fundRow.goalPence,
    note: fundRow.note,
    totalPence,
    gifts,
  };
}
