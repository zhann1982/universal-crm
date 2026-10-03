-- Tenant integrity. Audit with npm run db:audit-integrity before deployment.
-- Add nullable first: existing assignments derive their tenant from Membership.
ALTER TABLE "member_roles" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
UPDATE "member_roles" mr SET "organization_id" = m."organization_id" FROM "organization_members" m WHERE m."id" = mr."member_id";--> statement-breakpoint
ALTER TABLE "member_roles" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
-- Referenced composite UNIQUE constraints must exist before foreign keys.
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_org_pipeline_id_unique" UNIQUE("organization_id","pipeline_id","id");--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_org_client_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_org_company_fk" FOREIGN KEY ("organization_id","company_id") REFERENCES "public"."companies"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_owner_fk" FOREIGN KEY ("organization_id","owner_member_id") REFERENCES "public"."organization_members"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_org_owner_fk" FOREIGN KEY ("organization_id","owner_member_id") REFERENCES "public"."organization_members"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_pipeline_fk" FOREIGN KEY ("organization_id","pipeline_id") REFERENCES "public"."pipelines"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_pipeline_stage_fk" FOREIGN KEY ("organization_id","pipeline_id","stage_id") REFERENCES "public"."pipeline_stages"("organization_id","pipeline_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_company_fk" FOREIGN KEY ("organization_id","company_id") REFERENCES "public"."companies"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_owner_fk" FOREIGN KEY ("organization_id","owner_member_id") REFERENCES "public"."organization_members"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_org_member_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organization_members"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_org_role_fk" FOREIGN KEY ("organization_id","role_id") REFERENCES "public"."roles"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_org_pipeline_fk" FOREIGN KEY ("organization_id","pipeline_id") REFERENCES "public"."pipelines"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_amount_currency_check" CHECK (("deals"."amount" IS NULL OR ("deals"."amount" >= 0 AND "deals"."amount" <> 'NaN'::numeric AND "deals"."currency" IS NOT NULL)) AND ("deals"."currency" IS NULL OR "deals"."currency" ~ '^[A-Z]{3}$'));--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_type_check" CHECK ("pipeline_stages"."type" IN ('open', 'won', 'lost'));--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_probability_check" CHECK ("pipeline_stages"."probability" BETWEEN 0 AND 100);
