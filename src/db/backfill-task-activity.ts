import { sql } from "./index";

async function main() {
  console.log(
    "Backfilling task.created activity...",
  );

  const result = await sql`
    INSERT INTO activity_events (
      organization_id,
      entity_type,
      entity_id,
      actor_member_id,
      event_type,
      summary,
      created_at
    )
    SELECT
      t.organization_id,
      'task',
      t.id,
      t.created_by_member_id,
      'task.created',
      'Задача создана',
      t.created_at
    FROM tasks t
    WHERE
      t.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM activity_events ae
        WHERE
          ae.organization_id =
            t.organization_id
          AND ae.entity_type =
            'task'
          AND ae.entity_id = t.id
          AND ae.event_type =
            'task.created'
      )
    RETURNING id
  `;

  console.log(
    `Created ${result.length} historical task activity event(s).`,
  );
}

main().catch((error) => {
  console.error(
    "Task activity backfill failed:",
    error,
  );
  process.exitCode = 1;
});
