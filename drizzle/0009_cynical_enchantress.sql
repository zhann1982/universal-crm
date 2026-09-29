CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_member_id" uuid,
	"created_by_member_id" uuid,
	"client_id" uuid,
	"company_id" uuid,
	"deal_id" uuid,
	"title" varchar(240) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'todo' NOT NULL,
	"priority" varchar(32) DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_member_id_organization_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_member_id_organization_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_organization_idx" ON "tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_org_status_due_at_idx" ON "tasks" USING btree ("organization_id","status","due_at");--> statement-breakpoint
CREATE INDEX "tasks_org_owner_status_idx" ON "tasks" USING btree ("organization_id","owner_member_id","status");--> statement-breakpoint
CREATE INDEX "tasks_client_idx" ON "tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "tasks_company_idx" ON "tasks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tasks_deal_idx" ON "tasks" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "tasks_org_created_at_idx" ON "tasks" USING btree ("organization_id","created_at");