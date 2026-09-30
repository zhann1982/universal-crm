CREATE TABLE "task_schedules" (
	"task_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reminder_at" timestamp with time zone,
	"reminder_dismissed_at" timestamp with time zone,
	"recurrence_frequency" varchar(32) DEFAULT 'none' NOT NULL,
	"recurrence_interval" integer DEFAULT 1 NOT NULL,
	"recurrence_end_at" timestamp with time zone,
	"recurrence_series_id" uuid,
	"recurrence_sequence" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_schedules" ADD CONSTRAINT "task_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_schedules_org_reminder_idx" ON "task_schedules" USING btree ("organization_id","reminder_at");--> statement-breakpoint
CREATE INDEX "task_schedules_org_task_idx" ON "task_schedules" USING btree ("organization_id","task_id");--> statement-breakpoint
CREATE INDEX "task_schedules_org_series_idx" ON "task_schedules" USING btree ("organization_id","recurrence_series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_schedules_org_series_sequence_unique" ON "task_schedules" USING btree ("organization_id","recurrence_series_id","recurrence_sequence");