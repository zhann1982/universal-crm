import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./schema";
export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entity: varchar("entity", { length: 20 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    required: boolean("required").notNull().default(false),
    position: integer("position").notNull().default(0),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    archived: boolean("archived").notNull().default(false),
  },
  (t) => [
    check(
      "custom_field_entity_check",
      sql`${t.entity} IN ('client','company','deal')`,
    ),
    check(
      "custom_field_type_check",
      sql`${t.type} IN ('text','number','date','boolean','select')`,
    ),
    check("custom_field_position_check", sql`${t.position} BETWEEN 0 AND 999`),
    check(
      "custom_field_options_check",
      sql`jsonb_typeof(${t.options})='array' AND jsonb_array_length(${t.options})<=30`,
    ),
    uniqueIndex("custom_field_active_name_idx")
      .on(t.organizationId, t.entity, t.name)
      .where(sql`NOT ${t.archived}`),
    index("custom_field_org_entity_idx").on(t.organizationId, t.entity),
  ],
);
