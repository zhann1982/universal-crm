CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"comment_id" uuid,
	"event_type" varchar(80) NOT NULL,
	"summary" varchar(240) NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"entity_id" uuid NOT NULL,
	"author_member_id" uuid,
	"body" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_member_id_organization_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_member_id_organization_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_org_entity_created_idx" ON "activity_events" USING btree ("organization_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_org_actor_idx" ON "activity_events" USING btree ("organization_id","actor_member_id");--> statement-breakpoint
CREATE INDEX "activity_events_comment_idx" ON "activity_events" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comments_org_entity_created_idx" ON "comments" USING btree ("organization_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_org_author_idx" ON "comments" USING btree ("organization_id","author_member_id");