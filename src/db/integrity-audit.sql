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
   OR (currency IS NOT NULL AND currency !~ '^[A-Z]{3}$');
