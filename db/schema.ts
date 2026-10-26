import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Money is always integer pence.

export const contributionType = pgEnum("contribution_type", ["guest", "topup"]);
export const contributionStatus = pgEnum("contribution_status", [
  "pending",
  "paid",
]);
export const ledgerEntry = pgEnum("ledger_entry", ["credit", "debit"]);
export const creditRequestStatus = pgEnum("credit_request_status", [
  "new",
  "done",
]);

export const funds = pgTable(
  "funds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    mumFirstName: text("mum_first_name").notNull(),
    mumEmail: text("mum_email").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    dueDate: date("due_date").notNull(),
    // due_date + 28 days, computed in app code and stored.
    closeDate: date("close_date").notNull(),
    goalPence: integer("goal_pence"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "funds_goal_pence_positive",
      sql`${t.goalPence} is null or ${t.goalPence} > 0`,
    ),
  ],
);

export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id),
    type: contributionType("type").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message"),
    amountPence: integer("amount_pence").notNull(),
    feePence: integer("fee_pence").notNull(),
    showAmount: boolean("show_amount").notNull().default(false),
    // Unique so the Stripe webhook can find exactly one contribution.
    stripeSessionId: text("stripe_session_id").unique(),
    status: contributionStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contributions_fund_id_idx").on(t.fundId),
    check("contributions_amount_pence_positive", sql`${t.amountPence} > 0`),
    check("contributions_fee_pence_non_negative", sql`${t.feePence} >= 0`),
  ],
);

// Balance is derived from entries; amount is always positive and
// direction comes from `entry`.
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id),
    entry: ledgerEntry("entry").notNull(),
    amountPence: integer("amount_pence").notNull(),
    reason: text("reason").notNull(),
    bookingReference: text("booking_reference"),
    recordedBy: text("recorded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("credit_ledger_fund_id_idx").on(t.fundId),
    check("credit_ledger_amount_pence_positive", sql`${t.amountPence} > 0`),
  ],
);

export const creditRequests = pgTable(
  "credit_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id),
    service: text("service").notNull(),
    amountRequestedPence: integer("amount_requested_pence").notNull(),
    status: creditRequestStatus("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("credit_requests_fund_id_idx").on(t.fundId),
    check(
      "credit_requests_amount_requested_pence_positive",
      sql`${t.amountRequestedPence} > 0`,
    ),
  ],
);

export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
