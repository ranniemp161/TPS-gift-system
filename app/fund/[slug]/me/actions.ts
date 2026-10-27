"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { funds } from "@/db/schema";
import { startContributionCheckout } from "@/lib/checkout";
import {
  cardFeePence,
  fundStatus,
  MAX_CHARGE_PENCE,
  meetsMinimum,
  parsePoundsToPence,
  todayIsoDate,
} from "@/lib/fund-rules";

export type TopUpFieldName = "amount";

export type TopUpValues = Record<TopUpFieldName, string>;

export type TopUpState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<TopUpFieldName, string>>;
      values: TopUpValues;
    }
  | {
      status: "error";
      message: string;
      values: TopUpValues;
    };

function readValues(formData: FormData): TopUpValues {
  const value = formData.get("amount");
  return {
    amount: typeof value === "string" ? value : "",
  };
}

export async function topUpFund(
  slug: string,
  _prevState: TopUpState,
  formData: FormData,
): Promise<TopUpState> {
  const values = readValues(formData);
  const errors: Partial<Record<TopUpFieldName, string>> = {};

  let amountPence: number | null = null;
  const amountStr = values.amount.trim();
  if (amountStr.length === 0) {
    errors.amount = "Please enter a top-up amount.";
  } else {
    const parsed = parsePoundsToPence(amountStr);
    if (parsed === null) {
      errors.amount = "Please enter an amount in pounds, like 50 or 25.50.";
    } else if (!meetsMinimum(parsed)) {
      errors.amount = "The minimum top-up is £10.";
    } else if (
      parsed > MAX_CHARGE_PENCE ||
      parsed + cardFeePence(parsed) > MAX_CHARGE_PENCE
    ) {
      errors.amount = "Please enter a smaller amount.";
    } else {
      amountPence = parsed;
    }
  }

  if (amountPence === null || Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  const feePence = cardFeePence(amountPence);
  let checkoutUrl: string;

  try {
    const db = getDb();
    const [fund] = await db
      .select({
        id: funds.id,
        slug: funds.slug,
        mumFirstName: funds.mumFirstName,
        mumEmail: funds.mumEmail,
        closeDate: funds.closeDate,
      })
      .from(funds)
      .where(eq(funds.slug, slug))
      .limit(1);

    if (!fund) {
      return {
        status: "error",
        message: "This fund could not be found.",
        values,
      };
    }
    if (fundStatus(fund.closeDate, todayIsoDate()) !== "open") {
      return {
        status: "error",
        message: "This fund is closed and no longer accepts top-ups.",
        values,
      };
    }

    checkoutUrl = await startContributionCheckout({
      fund,
      contribution: {
        type: "topup",
        name: fund.mumFirstName,
        email: fund.mumEmail,
        message: null,
        amountPence,
        feePence,
        showAmount: false,
      },
      lineItemName: `Top-up to ${fund.mumFirstName}'s fund`,
      successPath: `/fund/${fund.slug}/me?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelPath: `/fund/${fund.slug}/me`,
    });
  } catch (error) {
    console.error("Failed to start top-up checkout:", error);
    return {
      status: "error",
      message: "We couldn't start the payment. Please try again.",
      values,
    };
  }

  redirect(checkoutUrl);
}
