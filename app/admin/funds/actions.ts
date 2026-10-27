"use server";

import { and, eq, type SQL, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { creditLedger, creditRequests, funds, outbox } from "@/db/schema";
import {
  formatPence,
  fundStatus,
  parsePoundsToPence,
  todayIsoDate,
} from "@/lib/fund-rules";

const CREDIT_USED_REASON = "Credit used";
const MAX_TEXT_LENGTH = 100;
// Largest value the integer amount_pence column can hold.
const MAX_AMOUNT_PENCE = 2_147_483_647;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreditUsedFieldName = "amount" | "bookingReference" | "recordedBy";

export type CreditUsedValues = Record<CreditUsedFieldName, string>;

export type CreditUsedState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "invalid";
      errors: Partial<Record<CreditUsedFieldName, string>>;
      values: CreditUsedValues;
    }
  | { status: "error"; message: string; values: CreditUsedValues };

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readValues(formData: FormData): CreditUsedValues {
  return {
    amount: readText(formData, "amount"),
    bookingReference: readText(formData, "bookingReference"),
    recordedBy: readText(formData, "recordedBy"),
  };
}

function validateOptionalText(
  values: CreditUsedValues,
  errors: Partial<Record<CreditUsedFieldName, string>>,
): { bookingReference: string | null; recordedBy: string | null } {
  const bookingReference = values.bookingReference.trim();
  const recordedBy = values.recordedBy.trim();
  if (bookingReference.length > MAX_TEXT_LENGTH) {
    errors.bookingReference = `Booking reference must be ${MAX_TEXT_LENGTH} characters or fewer.`;
  }
  if (recordedBy.length > MAX_TEXT_LENGTH) {
    errors.recordedBy = `Recorded by must be ${MAX_TEXT_LENGTH} characters or fewer.`;
  }
  return {
    bookingReference: bookingReference || null,
    recordedBy: recordedBy || null,
  };
}

type FundForDebit = {
  id: string;
  slug: string;
  mumFirstName: string;
  mumEmail: string;
  closeDate: string;
};

async function loadFund(fundId: string): Promise<FundForDebit | null> {
  const [fund] = await getDb()
    .select({
      id: funds.id,
      slug: funds.slug,
      mumFirstName: funds.mumFirstName,
      mumEmail: funds.mumEmail,
      closeDate: funds.closeDate,
    })
    .from(funds)
    .where(eq(funds.id, fundId))
    .limit(1);
  return fund ?? null;
}

// Derived from the ledger inside the write statement, so it reflects every
// debit committed before this transaction took the fund lock.
function ledgerBalanceSql(fundId: string) {
  return sql`(select coalesce(sum(case when ${creditLedger.entry} = 'credit' then ${creditLedger.amountPence} else -${creditLedger.amountPence} end), 0) from ${creditLedger} where ${creditLedger.fundId} = ${fundId}::uuid)`;
}

// Locks the fund row first, so competing debits for one fund run one at a
// time and each re-derives the balance after the previous one commits.
function lockFund(fundId: string) {
  return getDb()
    .select({ id: funds.id })
    .from(funds)
    .where(eq(funds.id, fundId))
    .for("update");
}

function creditUsedEmail(
  fund: FundForDebit,
  amountPence: number,
  details: { bookingReference: string | null; recordedBy: string | null },
  service: string | null,
) {
  const lines = [
    `Hi ${fund.mumFirstName},`,
    "",
    `TPS has used ${formatPence(amountPence)} of your gift credit.`,
    "",
  ];
  if (service) {
    lines.push(`Service: ${service}`);
  }
  if (details.bookingReference) {
    lines.push(`Booking reference: ${details.bookingReference}`);
  }
  if (details.recordedBy) {
    lines.push(`Recorded by: ${details.recordedBy}`);
  }
  lines.push(`Fund page: /fund/${fund.slug}/me`);
  return {
    to: fund.mumEmail,
    subject: `Credit used: ${formatPence(amountPence)}`,
    body: lines.join("\n"),
  };
}

// `source` yields one row when the debit is allowed and none when it is not.
// The debit and its email are written from that row in a single statement.
function insertDebitAndEmail(
  source: SQL,
  fundId: string,
  amountPence: number,
  details: { bookingReference: string | null; recordedBy: string | null },
  email: { to: string; subject: string; body: string },
) {
  return sql`
    with source as (${source}),
    debit as (
      insert into ${creditLedger} (fund_id, entry, amount_pence, reason, booking_reference, recorded_by)
      select ${fundId}::uuid, 'debit'::ledger_entry, ${amountPence}::integer, ${CREDIT_USED_REASON}::text, ${details.bookingReference}::text, ${details.recordedBy}::text
      from source
      returning id
    )
    insert into ${outbox} ("to", subject, body)
    select ${email.to}::text, ${email.subject}::text, ${email.body}::text
    from debit
    returning id`;
}

export async function recordCreditUsed(
  fundId: string,
  _prevState: CreditUsedState,
  formData: FormData,
): Promise<CreditUsedState> {
  const values = readValues(formData);
  const errors: Partial<Record<CreditUsedFieldName, string>> = {};

  let amountPence: number | null = null;
  const amountStr = values.amount.trim();
  if (amountStr.length === 0) {
    errors.amount = "Please enter the amount of credit used.";
  } else {
    const parsed = parsePoundsToPence(amountStr);
    if (parsed === null) {
      errors.amount = "Please enter an amount in pounds, like 50 or 25.50.";
    } else if (parsed <= 0) {
      errors.amount = "The amount must be more than £0.";
    } else if (parsed > MAX_AMOUNT_PENCE) {
      errors.amount = "Please enter a smaller amount.";
    } else {
      amountPence = parsed;
    }
  }
  const details = validateOptionalText(values, errors);

  if (amountPence === null || Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  try {
    const fund = UUID_PATTERN.test(fundId) ? await loadFund(fundId) : null;
    if (!fund) {
      return {
        status: "error",
        message: "This fund could not be found.",
        values,
      };
    }
    if (fundStatus(fund.closeDate, todayIsoDate()) === "expired") {
      return {
        status: "error",
        message: "This credit has expired and can no longer be used.",
        values,
      };
    }

    const db = getDb();
    const email = creditUsedEmail(fund, amountPence, details, null);
    const allowed = sql`select 1 where ${amountPence}::integer <= ${ledgerBalanceSql(fund.id)}`;
    const [, written] = await db.batch([
      lockFund(fund.id),
      db.execute(
        insertDebitAndEmail(allowed, fund.id, amountPence, details, email),
      ),
    ]);

    if (written.rows.length === 0) {
      return {
        status: "invalid",
        errors: {
          amount:
            "This is more than the current balance. Refresh to see the latest balance.",
        },
        values,
      };
    }

    revalidatePath("/admin/funds");
    return {
      status: "success",
      message: `Recorded ${formatPence(amountPence)} of credit used for ${fund.mumFirstName}.`,
    };
  } catch (error) {
    console.error("Failed to record credit used:", error);
    return {
      status: "error",
      message: "We couldn't record this credit. Please try again.",
      values,
    };
  }
}

export async function applyCreditRequest(
  fundId: string,
  requestId: string,
  _prevState: CreditUsedState,
  formData: FormData,
): Promise<CreditUsedState> {
  const values = readValues(formData);
  const errors: Partial<Record<CreditUsedFieldName, string>> = {};
  const details = validateOptionalText(values, errors);

  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }
  if (!UUID_PATTERN.test(fundId) || !UUID_PATTERN.test(requestId)) {
    return {
      status: "error",
      message: "This credit request could not be found.",
      values,
    };
  }

  try {
    const db = getDb();
    const [fund, [request]] = await Promise.all([
      loadFund(fundId),
      db
        .select({
          service: creditRequests.service,
          amountRequestedPence: creditRequests.amountRequestedPence,
          status: creditRequests.status,
        })
        .from(creditRequests)
        .where(
          and(eq(creditRequests.id, requestId), eq(creditRequests.fundId, fundId)),
        )
        .limit(1),
    ]);

    if (!fund || !request) {
      return {
        status: "error",
        message: "This credit request could not be found.",
        values,
      };
    }
    if (request.status !== "new") {
      revalidatePath("/admin/funds");
      return {
        status: "error",
        message: "This request has already been applied.",
        values,
      };
    }
    if (fundStatus(fund.closeDate, todayIsoDate()) === "expired") {
      return {
        status: "error",
        message: "This credit has expired and can no longer be used.",
        values,
      };
    }

    const amountPence = request.amountRequestedPence;
    const email = creditUsedEmail(fund, amountPence, details, request.service);
    // Marks the request done only while it is still open and affordable; the
    // debit and email are written only for the row this update returns.
    const markedDone = sql`
      update ${creditRequests} set status = 'done'
      where ${creditRequests.id} = ${requestId}::uuid
        and ${creditRequests.fundId} = ${fund.id}::uuid
        and ${creditRequests.status} = 'new'
        and ${creditRequests.amountRequestedPence} = ${amountPence}::integer
        and ${creditRequests.amountRequestedPence} <= ${ledgerBalanceSql(fund.id)}
      returning 1`;
    const [, written] = await db.batch([
      lockFund(fund.id),
      db.execute(
        insertDebitAndEmail(markedDone, fund.id, amountPence, details, email),
      ),
    ]);

    if (written.rows.length === 0) {
      revalidatePath("/admin/funds");
      return {
        status: "error",
        message: `This request needs ${formatPence(amountPence)}, which is more than the current balance, or it was already applied. It has been left unchanged.`,
        values,
      };
    }

    revalidatePath("/admin/funds");
    return {
      status: "success",
      message: `Applied ${formatPence(amountPence)} for ${request.service}.`,
    };
  } catch (error) {
    console.error("Failed to apply credit request:", error);
    return {
      status: "error",
      message: "We couldn't apply this request. Please try again.",
      values,
    };
  }
}
