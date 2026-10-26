"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { contributions, funds } from "@/db/schema";
import {
  cardFeePence,
  fundStatus,
  MAX_CHARGE_PENCE,
  meetsMinimum,
  parsePoundsToPence,
  todayIsoDate,
} from "@/lib/fund-rules";
import { requestOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe";
import { isValidEmail } from "@/lib/validation";

export type GiveFieldName = "amount" | "name" | "email" | "message";

export type GiveValues = Record<GiveFieldName, string> & {
  showAmount: boolean;
};

export type GiveState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<GiveFieldName, string>>;
      values: GiveValues;
    }
  | {
      status: "error";
      message: string;
      values: GiveValues;
    };

function readValues(formData: FormData): GiveValues {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    amount: text("amount"),
    name: text("name"),
    email: text("email"),
    message: text("message"),
    showAmount: formData.get("showAmount") === "on",
  };
}

export async function giveToFund(
  slug: string,
  _prevState: GiveState,
  formData: FormData,
): Promise<GiveState> {
  const values = readValues(formData);
  const errors: Partial<Record<GiveFieldName, string>> = {};

  let amountPence: number | null = null;
  const amountStr = values.amount.trim();
  if (amountStr.length === 0) {
    errors.amount = "Please enter a gift amount.";
  } else {
    const parsed = parsePoundsToPence(amountStr);
    if (parsed === null) {
      errors.amount = "Please enter an amount in pounds, like 50 or 25.50.";
    } else if (!meetsMinimum(parsed)) {
      errors.amount = "The minimum gift is £10.";
    } else if (
      parsed > MAX_CHARGE_PENCE ||
      parsed + cardFeePence(parsed) > MAX_CHARGE_PENCE
    ) {
      errors.amount = "Please enter a smaller amount.";
    } else {
      amountPence = parsed;
    }
  }

  const name = values.name.trim();
  if (name.length === 0) {
    errors.name = "Please enter your name.";
  } else if (name.length > 100) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  const email = values.email.trim();
  if (email.length === 0) {
    errors.email = "Please enter your email address.";
  } else if (!isValidEmail(email)) {
    errors.email = "Please enter a valid email address.";
  }

  const message = values.message.trim();
  if (message.length > 1000) {
    errors.message = "Message must be 1000 characters or fewer.";
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
        message: "This fund is closed and no longer accepts gifts.",
        values,
      };
    }

    const [contribution] = await db
      .insert(contributions)
      .values({
        fundId: fund.id,
        type: "guest",
        status: "pending",
        name,
        email,
        message: message.length > 0 ? message : null,
        amountPence,
        feePence,
        showAmount: values.showAmount,
      })
      .returning({ id: contributions.id });

    const origin = requestOrigin(await headers());
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            product_data: {
              name: `Gift to ${fund.mumFirstName}'s fund`,
              description: "TPS gift credit",
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: feePence,
            product_data: { name: "Card processing fee" },
          },
        },
      ],
      metadata: { contribution_id: contribution.id },
      success_url: `${origin}/fund/${fund.slug}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/fund/${fund.slug}/give`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }

    await db
      .update(contributions)
      .set({ stripeSessionId: session.id })
      .where(eq(contributions.id, contribution.id));

    checkoutUrl = session.url;
  } catch (error) {
    console.error("Failed to start guest checkout:", error);
    return {
      status: "error",
      message: "We couldn't start the payment. Please try again.",
      values,
    };
  }

  redirect(checkoutUrl);
}
