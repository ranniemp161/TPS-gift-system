CREATE TYPE "public"."contribution_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."contribution_type" AS ENUM('guest', 'topup');--> statement-breakpoint
CREATE TYPE "public"."credit_request_status" AS ENUM('new', 'done');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"type" "contribution_type" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text,
	"amount_pence" integer NOT NULL,
	"fee_pence" integer NOT NULL,
	"show_amount" boolean DEFAULT false NOT NULL,
	"stripe_session_id" text,
	"status" "contribution_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributions_stripe_session_id_unique" UNIQUE("stripe_session_id"),
	CONSTRAINT "contributions_amount_pence_positive" CHECK ("contributions"."amount_pence" > 0),
	CONSTRAINT "contributions_fee_pence_non_negative" CHECK ("contributions"."fee_pence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"entry" "ledger_entry" NOT NULL,
	"amount_pence" integer NOT NULL,
	"reason" text NOT NULL,
	"booking_reference" text,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_amount_pence_positive" CHECK ("credit_ledger"."amount_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"service" text NOT NULL,
	"amount_requested_pence" integer NOT NULL,
	"status" "credit_request_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_requests_amount_requested_pence_positive" CHECK ("credit_requests"."amount_requested_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"mum_first_name" text NOT NULL,
	"mum_email" text NOT NULL,
	"created_by_email" text NOT NULL,
	"due_date" date NOT NULL,
	"close_date" date NOT NULL,
	"goal_pence" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funds_slug_unique" UNIQUE("slug"),
	CONSTRAINT "funds_goal_pence_positive" CHECK ("funds"."goal_pence" is null or "funds"."goal_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contributions_fund_id_idx" ON "contributions" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_fund_id_idx" ON "credit_ledger" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "credit_requests_fund_id_idx" ON "credit_requests" USING btree ("fund_id");