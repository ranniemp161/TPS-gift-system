import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "@/db";
import { contributions, funds } from "@/db/schema";
import { expiryDateFor, formatPence } from "@/lib/fund-rules";
import { getStripe } from "@/lib/stripe";

const INVALID_SIGNATURE_RESPONSE = { error: "Invalid signature" };
const HANDLER_FAILED_RESPONSE = { error: "Webhook handler failed" };
const RECEIVED_RESPONSE = { received: true };

function buildGuestReceiptBody(params: {
  mumFirstName: string;
  slug: string;
  amountPence: number;
  feePence: number;
}): string {
  const { mumFirstName, slug, amountPence, feePence } = params;
  return [
    `Thank you for your gift to ${mumFirstName}'s TPS gift fund.`,
    "",
    `Gift amount: ${formatPence(amountPence)}`,
    `Card processing fee: ${formatPence(feePence)}`,
    `Total paid: ${formatPence(amountPence + feePence)}`,
    "",
    "Your gift becomes TPS gift credit for TPS services (not cash).",
    "",
    `Public fund page: /fund/${slug}`,
  ].join("\n");
}

function buildGiftReceivedBody(params: {
  mumFirstName: string;
  slug: string;
  closeDate: string;
  guestName: string;
  amountPence: number;
  message: string | null;
}): string {
  const { mumFirstName, slug, closeDate, guestName, amountPence, message } =
    params;
  return [
    `Hi ${mumFirstName},`,
    "",
    `${guestName} sent ${formatPence(amountPence)} of TPS gift credit to your fund.`,
    message ? `\nMessage from ${guestName}:\n${message}` : null,
    "",
    `Credit expiry date: ${expiryDateFor(closeDate)}`,
    `Manage your fund: /fund/${slug}/me`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return Response.json(HANDLER_FAILED_RESPONSE, { status: 500 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch {
    console.error("Stripe is not configured for webhook verification");
    return Response.json(HANDLER_FAILED_RESPONSE, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(INVALID_SIGNATURE_RESPONSE, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return Response.json(INVALID_SIGNATURE_RESPONSE, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json(RECEIVED_RESPONSE);
  }

  const session = event.data.object;

  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: contributions.id,
        type: contributions.type,
        status: contributions.status,
        name: contributions.name,
        email: contributions.email,
        message: contributions.message,
        amountPence: contributions.amountPence,
        feePence: contributions.feePence,
        slug: funds.slug,
        mumFirstName: funds.mumFirstName,
        mumEmail: funds.mumEmail,
        closeDate: funds.closeDate,
      })
      .from(contributions)
      .innerJoin(funds, eq(contributions.fundId, funds.id))
      .where(eq(contributions.stripeSessionId, session.id))
      .limit(1);

    if (!row) {
      console.info(`Webhook ignored: unknown session ${session.id}`);
      return Response.json(RECEIVED_RESPONSE);
    }

    if (session.metadata?.contribution_id !== row.id) {
      console.warn(
        `Webhook ignored: metadata mismatch for session ${session.id}`,
      );
      return Response.json(RECEIVED_RESPONSE);
    }

    if (session.payment_status !== "paid") {
      console.info(`Webhook ignored: unpaid session ${session.id}`);
      return Response.json(RECEIVED_RESPONSE);
    }

    if (
      session.currency !== "gbp" ||
      session.amount_total !== row.amountPence + row.feePence
    ) {
      console.warn(
        `Webhook ignored: amount or currency mismatch for session ${session.id}`,
      );
      return Response.json(RECEIVED_RESPONSE);
    }

    if (row.status === "paid") {
      console.info(`Webhook ignored: already paid session ${session.id}`);
      return Response.json(RECEIVED_RESPONSE);
    }

    const reason = row.type === "topup" ? "top-up" : "guest gift";
    const guestReceiptBody = buildGuestReceiptBody({
      mumFirstName: row.mumFirstName,
      slug: row.slug,
      amountPence: row.amountPence,
      feePence: row.feePence,
    });
    const giftReceivedBody = buildGiftReceivedBody({
      mumFirstName: row.mumFirstName,
      slug: row.slug,
      closeDate: row.closeDate,
      guestName: row.name,
      amountPence: row.amountPence,
      message: row.message,
    });

    // neon-http has no interactive transactions, so update the contribution and
    // insert the ledger credit and outbox emails in one statement gated on
    // status = 'pending' to stay atomic and idempotent under concurrent retries.
    await db.execute(sql`
      WITH paid AS (
        UPDATE contributions
        SET status = 'paid'
        WHERE id = ${row.id} AND status = 'pending'
        RETURNING id, fund_id, amount_pence, type
      ),
      ledger_insert AS (
        INSERT INTO credit_ledger (fund_id, entry, amount_pence, reason)
        SELECT fund_id, 'credit'::ledger_entry, amount_pence, ${reason}
        FROM paid
      ),
      receipt_insert AS (
        INSERT INTO outbox ("to", subject, body)
        SELECT ${row.email}, ${"Your TPS gift credit receipt"}, ${guestReceiptBody}
        FROM paid
        WHERE type = 'guest'
      )
      INSERT INTO outbox ("to", subject, body)
      SELECT ${row.mumEmail}, ${"You've received a gift"}, ${giftReceivedBody}
      FROM paid
      WHERE type = 'guest'
    `);

    return Response.json(RECEIVED_RESPONSE);
  } catch {
    console.error(`Webhook database failure for session ${session.id}`);
    return Response.json(HANDLER_FAILED_RESPONSE, { status: 500 });
  }
}
