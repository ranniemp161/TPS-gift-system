"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { creditRequests, funds, outbox } from "@/db/schema";
import { startContributionCheckout } from "@/lib/checkout";
import { currentIsoDate } from "@/lib/demo-clock";
import {
  cardFeePence,
  expiryDateFor,
  formatPence,
  fundStatus,
  MAX_CHARGE_PENCE,
  meetsMinimum,
  parsePoundsToPence,
} from "@/lib/fund-rules";
import { calculateCreditRequest, getServiceById } from "@/lib/services";
import { getMumFund } from "./data";

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
    if (fundStatus(fund.closeDate, await currentIsoDate()) !== "open") {
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

export type CreditRequestFieldName = "service" | "amount";

export type CreditRequestValues = Record<CreditRequestFieldName, string>;

export type CreditRequestState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<CreditRequestFieldName, string>>;
      values: CreditRequestValues;
    }
  | {
      status: "error";
      message: string;
      values: CreditRequestValues;
    };

const TPS_TEAM_EMAIL = "team@postpartumsuite.co.uk";

function readCreditRequestValues(formData: FormData): CreditRequestValues {
  const service = formData.get("service");
  const amount = formData.get("amount");
  return {
    service: typeof service === "string" ? service : "",
    amount: typeof amount === "string" ? amount : "",
  };
}

export async function requestCredit(
  slug: string,
  _prevState: CreditRequestState,
  formData: FormData,
): Promise<CreditRequestState> {
  const values = readCreditRequestValues(formData);

  let fund: Awaited<ReturnType<typeof getMumFund>>;
  let today: string;
  try {
    today = await currentIsoDate();
    fund = await getMumFund(slug, today);
  } catch (error) {
    console.error("Failed to load fund for credit request:", error);
    return {
      status: "error",
      message: "We couldn't submit your request. Please try again.",
      values,
    };
  }

  if (!fund) {
    return {
      status: "error",
      message: "This fund could not be found.",
      values,
    };
  }
  if (fundStatus(fund.closeDate, today) === "expired") {
    return {
      status: "error",
      message: "This credit has expired and can no longer be used.",
      values,
    };
  }
  if (fund.availableCreditPence <= 0) {
    return {
      status: "error",
      message: "There is no available credit to use right now.",
      values,
    };
  }

  const service = getServiceById(values.service);
  if (!service) {
    return {
      status: "invalid",
      errors: { service: "Please choose a service." },
      values,
    };
  }

  let amountPence: number;
  if (service.kind === "treatment") {
    amountPence = calculateCreditRequest(
      service,
      fund.availableCreditPence,
    ).creditPence;
  } else {
    const amountStr = values.amount.trim();
    if (amountStr.length === 0) {
      return {
        status: "invalid",
        errors: { amount: "Please enter how much credit to apply." },
        values,
      };
    }
    const parsed = parsePoundsToPence(amountStr);
    if (parsed === null) {
      return {
        status: "invalid",
        errors: {
          amount: "Please enter an amount in pounds, like 50 or 25.50.",
        },
        values,
      };
    }
    if (parsed <= 0) {
      return {
        status: "invalid",
        errors: { amount: "The amount must be more than £0." },
        values,
      };
    }
    if (parsed > fund.availableCreditPence) {
      return {
        status: "invalid",
        errors: {
          amount: `You can apply up to ${formatPence(fund.availableCreditPence)}.`,
        },
        values,
      };
    }
    amountPence = parsed;
  }

  const remainingPence = fund.availableCreditPence - amountPence;
  const emailBody = [
    `${fund.mumFirstName} would like to use TPS gift credit.`,
    "",
    `Mum: ${fund.mumFirstName} (${fund.mumEmail})`,
    `Fund page: /fund/${fund.slug}/me`,
    `Service: ${service.name}`,
    `Credit requested: ${formatPence(amountPence)}`,
    `Credit remaining after this request: ${formatPence(remainingPence)}`,
    `Credit expires: ${expiryDateFor(fund.closeDate)}`,
    "",
    "Review this request in the admin screen.",
  ].join("\n");

  try {
    const db = getDb();
    await db.batch([
      db.insert(creditRequests).values({
        fundId: fund.id,
        service: service.name,
        amountRequestedPence: amountPence,
      }),
      db.insert(outbox).values({
        to: TPS_TEAM_EMAIL,
        subject: `Credit request: ${fund.mumFirstName} - ${service.name}`,
        body: emailBody,
      }),
    ]);
  } catch (error) {
    console.error("Failed to save credit request:", error);
    return {
      status: "error",
      message: "We couldn't submit your request. Please try again.",
      values,
    };
  }

  redirect(`/fund/${fund.slug}/me?request=success`);
}
