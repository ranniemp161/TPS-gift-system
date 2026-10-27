import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { contributions } from "@/db/schema";
import { requestOrigin } from "@/lib/request-origin";
import { getStripe } from "@/lib/stripe";

export type CheckoutFund = {
  id: string;
  slug: string;
  mumFirstName: string;
};

export type CheckoutContributionInput = {
  type: "guest" | "topup";
  name: string;
  email: string;
  message: string | null;
  amountPence: number;
  feePence: number;
  showAmount: boolean;
};

export async function startContributionCheckout(params: {
  fund: CheckoutFund;
  contribution: CheckoutContributionInput;
  lineItemName: string;
  successPath: string;
  cancelPath: string;
}): Promise<string> {
  const { fund, contribution: input, lineItemName, successPath, cancelPath } =
    params;

  const db = getDb();
  const [contribution] = await db
    .insert(contributions)
    .values({
      fundId: fund.id,
      type: input.type,
      status: "pending",
      name: input.name,
      email: input.email,
      message: input.message,
      amountPence: input.amountPence,
      feePence: input.feePence,
      showAmount: input.showAmount,
    })
    .returning({ id: contributions.id });

  const origin = requestOrigin(await headers());
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: input.amountPence,
          product_data: {
            name: lineItemName,
            description: "TPS gift credit",
          },
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: input.feePence,
          product_data: { name: "Card processing fee" },
        },
      },
    ],
    metadata: { contribution_id: contribution.id },
    success_url: `${origin}${successPath}`,
    cancel_url: `${origin}${cancelPath}`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL");
  }

  await db
    .update(contributions)
    .set({ stripeSessionId: session.id })
    .where(eq(contributions.id, contribution.id));

  return session.url;
}
