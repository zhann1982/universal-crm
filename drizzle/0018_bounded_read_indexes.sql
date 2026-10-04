CREATE INDEX "deals_board_page_idx" ON "deals" USING btree ("organization_id","pipeline_id","stage_id","created_at","id") WHERE NOT "deals"."is_archived" AND "deals"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "deals_archive_page_idx" ON "deals" USING btree ("organization_id","updated_at","id") WHERE "deals"."is_archived" AND "deals"."deleted_at" IS NULL;
--> statement-breakpoint
DROP INDEX "comments_org_entity_created_idx";--> statement-breakpoint
CREATE INDEX "comments_org_entity_created_idx" ON "comments" USING btree ("organization_id","entity_type","entity_id","created_at","id");--> statement-breakpoint
DROP INDEX "activity_events_org_entity_created_idx";--> statement-breakpoint
CREATE INDEX "activity_events_org_entity_created_idx" ON "activity_events" USING btree ("organization_id","entity_type","entity_id","created_at","id");
