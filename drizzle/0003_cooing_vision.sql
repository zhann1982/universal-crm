CREATE TABLE "client_companies" (
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_companies_client_id_company_id_pk" PRIMARY KEY("client_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_companies" ADD CONSTRAINT "client_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_companies_org_client_idx" ON "client_companies" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "client_companies_org_company_idx" ON "client_companies" USING btree ("organization_id","company_id");