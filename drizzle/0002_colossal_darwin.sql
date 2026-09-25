CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_member_id" uuid,
	"name" varchar(200) NOT NULL,
	"legal_name" varchar(300),
	"tax_id" varchar(100),
	"email" varchar(320),
	"phone" varchar(50),
	"website" varchar(500),
	"industry" varchar(160),
	"address" text,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_member_id_organization_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_organization_idx" ON "companies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "companies_owner_idx" ON "companies" USING btree ("owner_member_id");--> statement-breakpoint
CREATE INDEX "companies_org_status_idx" ON "companies" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "companies_org_created_at_idx" ON "companies" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "companies_tax_id_idx" ON "companies" USING btree ("tax_id");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_org_tax_id_unique" ON "companies" USING btree ("organization_id","tax_id");