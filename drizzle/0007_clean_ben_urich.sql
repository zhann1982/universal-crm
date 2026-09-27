ALTER TABLE "roles"
ADD COLUMN "system_key" varchar(80);

--> statement-breakpoint

UPDATE "roles"
SET "system_key" = CASE
  WHEN "name" = 'Owner' THEN 'owner'
  WHEN "name" = 'Admin' THEN 'admin'
  WHEN "name" = 'Manager' THEN 'manager'
  WHEN "name" = 'Viewer' THEN 'viewer'
  ELSE NULL
END
WHERE
  "system_key" IS NULL
  AND "name" IN (
    'Owner',
    'Admin',
    'Manager',
    'Viewer'
  );

--> statement-breakpoint

CREATE UNIQUE INDEX "roles_org_system_key_unique"
ON "roles" USING btree (
  "organization_id",
  "system_key"
);