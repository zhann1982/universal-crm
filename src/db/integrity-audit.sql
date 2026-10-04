-- Read-only preflight for migration 0013. No personal data or credentials are returned.
SELECT 'stage_pipeline_tenant' AS invariant, count(*)::integer AS violations
FROM pipeline_stages s LEFT JOIN pipelines p ON p.id = s.pipeline_id
WHERE s.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'deal_pipeline_tenant', count(*)::integer
FROM deals d LEFT JOIN pipelines p ON p.id = d.pipeline_id
WHERE d.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'deal_stage_pipeline_tenant', count(*)::integer
FROM deals d LEFT JOIN pipeline_stages s ON s.id = d.stage_id
WHERE d.organization_id IS DISTINCT FROM s.organization_id OR d.pipeline_id IS DISTINCT FROM s.pipeline_id
UNION ALL
SELECT 'member_role_tenant', count(*)::integer
FROM member_roles mr
LEFT JOIN organization_members m ON m.id = mr.member_id LEFT JOIN roles r ON r.id = mr.role_id
WHERE m.organization_id IS DISTINCT FROM r.organization_id
UNION ALL
SELECT 'client_company_tenant', count(*)::integer
FROM client_companies cc
LEFT JOIN clients c ON c.id = cc.client_id LEFT JOIN companies co ON co.id = cc.company_id
WHERE cc.organization_id IS DISTINCT FROM c.organization_id OR cc.organization_id IS DISTINCT FROM co.organization_id
UNION ALL
SELECT 'client_owner_tenant', count(*)::integer
FROM clients c LEFT JOIN organization_members m ON m.id = c.owner_member_id
WHERE c.owner_member_id IS NOT NULL AND c.organization_id IS DISTINCT FROM m.organization_id
UNION ALL
SELECT 'company_owner_tenant', count(*)::integer
FROM companies c LEFT JOIN organization_members m ON m.id = c.owner_member_id
WHERE c.owner_member_id IS NOT NULL AND c.organization_id IS DISTINCT FROM m.organization_id
UNION ALL
SELECT 'deal_owner_tenant', count(*)::integer
FROM deals d LEFT JOIN organization_members m ON m.id = d.owner_member_id
WHERE d.owner_member_id IS NOT NULL AND d.organization_id IS DISTINCT FROM m.organization_id
UNION ALL
SELECT 'deal_company_tenant', count(*)::integer
FROM deals d LEFT JOIN companies c ON c.id = d.company_id
WHERE d.company_id IS NOT NULL AND d.organization_id IS DISTINCT FROM c.organization_id
UNION ALL
SELECT 'stage_type', count(*)::integer FROM pipeline_stages WHERE type NOT IN ('open', 'won', 'lost')
UNION ALL
SELECT 'stage_probability', count(*)::integer FROM pipeline_stages WHERE probability NOT BETWEEN 0 AND 100
UNION ALL
SELECT 'deal_amount_currency', count(*)::integer FROM deals
WHERE (amount IS NOT NULL AND (amount < 0 OR amount = 'NaN'::numeric OR currency IS NULL))
   OR (currency IS NOT NULL AND currency !~ '^[A-Z]{3}$')
UNION ALL
SELECT 'task_owner_tenant', count(*)::integer FROM tasks t LEFT JOIN organization_members p ON p.id=t.owner_member_id
WHERE t.owner_member_id IS NOT NULL AND t.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'task_creator_tenant', count(*)::integer FROM tasks t LEFT JOIN organization_members p ON p.id=t.created_by_member_id
WHERE t.created_by_member_id IS NOT NULL AND t.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'task_client_tenant', count(*)::integer FROM tasks t LEFT JOIN clients p ON p.id=t.client_id
WHERE t.client_id IS NOT NULL AND t.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'task_company_tenant', count(*)::integer FROM tasks t LEFT JOIN companies p ON p.id=t.company_id
WHERE t.company_id IS NOT NULL AND t.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'task_deal_tenant', count(*)::integer FROM tasks t LEFT JOIN deals p ON p.id=t.deal_id
WHERE t.deal_id IS NOT NULL AND t.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'schedule_task_tenant', count(*)::integer FROM task_schedules s LEFT JOIN tasks t ON t.id=s.task_id WHERE s.organization_id IS DISTINCT FROM t.organization_id
UNION ALL
SELECT 'comments_member_tenant', count(*)::integer FROM comments e LEFT JOIN organization_members m ON m.id=e.author_member_id WHERE e.author_member_id IS NOT NULL AND e.organization_id IS DISTINCT FROM m.organization_id
UNION ALL
SELECT 'comments_parent_tenant', count(*)::integer FROM comments e LEFT JOIN (
SELECT 'client' AS type,id,organization_id FROM clients UNION ALL SELECT 'company',id,organization_id FROM companies UNION ALL SELECT 'deal',id,organization_id FROM deals UNION ALL SELECT 'task',id,organization_id FROM tasks
) p ON p.type=e.entity_type AND p.id=e.entity_id WHERE e.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'activity_events_member_tenant', count(*)::integer FROM activity_events e LEFT JOIN organization_members m ON m.id=e.actor_member_id WHERE e.actor_member_id IS NOT NULL AND e.organization_id IS DISTINCT FROM m.organization_id
UNION ALL
SELECT 'activity_events_parent_tenant', count(*)::integer FROM activity_events e LEFT JOIN (
SELECT 'client' AS type,id,organization_id FROM clients UNION ALL SELECT 'company',id,organization_id FROM companies UNION ALL SELECT 'deal',id,organization_id FROM deals UNION ALL SELECT 'task',id,organization_id FROM tasks
) p ON p.type=e.entity_type AND p.id=e.entity_id WHERE e.organization_id IS DISTINCT FROM p.organization_id
UNION ALL
SELECT 'activity_comment_target', count(*)::integer FROM activity_events e LEFT JOIN comments c ON c.id=e.comment_id
WHERE e.comment_id IS NOT NULL AND (e.organization_id IS DISTINCT FROM c.organization_id OR e.entity_type IS DISTINCT FROM c.entity_type OR e.entity_id IS DISTINCT FROM c.entity_id);
