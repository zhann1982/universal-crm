CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"entity" varchar(20) NOT NULL,
	"name" varchar(80) NOT NULL,
	"filters" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_entity_check" CHECK ("saved_views"."entity" IN ('clients','companies','deals')),
	CONSTRAINT "saved_views_filters_check" CHECK (jsonb_typeof("saved_views"."filters") = 'object')
);
--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_org_member_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."organization_members"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_active_name_unique" ON "saved_views" USING btree ("organization_id","member_id","entity","name") WHERE NOT "saved_views"."is_archived";--> statement-breakpoint
CREATE INDEX "saved_views_member_entity_idx" ON "saved_views" USING btree ("organization_id","member_id","entity");