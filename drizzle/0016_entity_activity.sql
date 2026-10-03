-- Application business writes install an authenticated Member transaction-locally.
-- Maintenance/seed writes without that context do not invent an actor or history.
CREATE FUNCTION crm_record_entity_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor uuid;
  scope uuid;
  entity text := TG_ARGV[0];
  label text := TG_ARGV[1];
  previous jsonb;
  current_row jsonb := to_jsonb(NEW);
  field_name text;
  field_label text;
BEGIN
  IF NULLIF(current_setting('crm.activity_actor', true), '') IS NULL THEN
    RETURN NEW;
  END IF;
  actor := current_setting('crm.activity_actor')::uuid;
  scope := NULLIF(current_setting('crm.activity_organization', true), '')::uuid;
  IF scope IS DISTINCT FROM NEW.organization_id OR NOT EXISTS (
    SELECT 1 FROM organization_members m JOIN organizations o ON o.id = m.organization_id
    WHERE m.id = actor AND m.organization_id = scope AND m.status = 'active' AND o.is_active
  ) THEN
    RAISE EXCEPTION 'Invalid Activity actor or organization' USING ERRCODE = '42501';
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_events(organization_id, entity_type, entity_id, actor_member_id, event_type, summary)
    VALUES(scope, entity, NEW.id, actor, entity || '.created', label || ': создание');
    RETURN NEW;
  END IF;
  previous := to_jsonb(OLD);
  IF OLD.is_archived IS DISTINCT FROM NEW.is_archived THEN
    INSERT INTO activity_events(organization_id, entity_type, entity_id, actor_member_id, event_type, summary)
    VALUES(scope, entity, NEW.id, actor, entity || CASE WHEN NEW.is_archived THEN '.archived' ELSE '.restored' END,
      label || CASE WHEN NEW.is_archived THEN ': архивирование' ELSE ': восстановление' END);
    RETURN NEW;
  END IF;
  -- Only allowlisted field labels enter history. No related names, emails,
  -- notes, amounts, or old/new values are copied into the Activity read surface.
  FOR field_name, field_label IN SELECT key, value FROM jsonb_each_text('{
    "first_name":"Имя", "last_name":"Фамилия", "middle_name":"Отчество",
    "name":"Название", "legal_name":"Юридическое название", "title":"Название",
    "phone":"Телефон", "email":"Email", "status":"Статус", "source":"Источник",
    "notes":"Заметки", "tax_id":"Идентификатор компании", "website":"Сайт",
    "industry":"Отрасль", "address":"Адрес", "owner_member_id":"Ответственный",
    "company_id":"Компания", "pipeline_id":"Воронка", "stage_id":"Этап",
    "amount":"Сумма", "currency":"Валюта", "expected_close_at":"Плановая дата закрытия"
  }'::jsonb) ORDER BY key LOOP
    IF current_row ? field_name AND (previous -> field_name) IS DISTINCT FROM (current_row -> field_name) THEN
      INSERT INTO activity_events(organization_id, entity_type, entity_id, actor_member_id, event_type, summary)
      VALUES(scope, entity, NEW.id, actor, entity || '.' || field_name || '_changed', field_label || ': изменение');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER clients_activity AFTER INSERT OR UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION crm_record_entity_activity('client', 'Клиент');
--> statement-breakpoint
CREATE TRIGGER companies_activity AFTER INSERT OR UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION crm_record_entity_activity('company', 'Компания');
--> statement-breakpoint
CREATE TRIGGER deals_activity AFTER INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION crm_record_entity_activity('deal', 'Сделка');
