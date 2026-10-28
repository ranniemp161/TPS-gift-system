import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { creditLedger, creditRequests, funds } from "@/db/schema";

// Derived from the ledger inside the write statement, so it reflects every
// debit committed before this transaction took the fund lock.
export function ledgerBalanceSql(fundId: string) {
  return sql`(select coalesce(sum(case when ${creditLedger.entry} = 'credit' then ${creditLedger.amountPence} else -${creditLedger.amountPence} end), 0) from ${creditLedger} where ${creditLedger.fundId} = ${fundId}::uuid)`;
}

// Credit reserved by requests that TPS has not applied yet, derived inside the
// write statement like the ledger balance.
export function openRequestsSql(fundId: string) {
  return sql`(select coalesce(sum(${creditRequests.amountRequestedPence}), 0) from ${creditRequests} where ${creditRequests.fundId} = ${fundId}::uuid and ${creditRequests.status} = 'new')`;
}

// Locks the fund row first, so competing writes for one fund run one at a
// time and each re-derives the balance after the previous one commits.
export function lockFund(fundId: string) {
  return getDb()
    .select({ id: funds.id })
    .from(funds)
    .where(eq(funds.id, fundId))
    .for("update");
}
