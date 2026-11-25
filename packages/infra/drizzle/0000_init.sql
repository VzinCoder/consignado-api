CREATE TYPE "public"."bank_result_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."simulation_origin" AS ENUM('CUSTOMER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "bank_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"simulation_id" uuid NOT NULL,
	"bank_slug" varchar(32) NOT NULL,
	"status" "bank_result_status" DEFAULT 'PENDING' NOT NULL,
	"monthly_rate" double precision,
	"approved_amount_cents" integer,
	"installment_cents" integer,
	"total_cents" integer,
	"term_months" integer,
	"rejection_reason" text,
	"failure_reason" text,
	"raw_response" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"duration_ms" integer,
	CONSTRAINT "bank_results_simulation_bank_unique" UNIQUE("simulation_id","bank_slug")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cpf" varchar(11) NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_cpf_unique" UNIQUE("cpf")
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"employer_cnpj" varchar(14) NOT NULL,
	"salary_cents" integer NOT NULL,
	"requested_amount_cents" integer NOT NULL,
	"term_months" integer NOT NULL,
	"origin" "simulation_origin" DEFAULT 'CUSTOMER' NOT NULL,
	"chosen_bank_slug" varchar(32),
	"interest_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_results" ADD CONSTRAINT "bank_results_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_results_status_idx" ON "bank_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "simulations_created_at_idx" ON "simulations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "simulations_customer_id_idx" ON "simulations" USING btree ("customer_id");