CREATE TABLE "custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity" varchar(20) NOT NULL,
	"name" varchar(80) NOT NULL,
	"type" varchar(20) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "custom_field_entity_check" CHECK ("custom_field_definitions"."entity" IN ('client','company','deal')),
	CONSTRAINT "custom_field_type_check" CHECK ("custom_field_definitions"."type" IN ('text','number','date','boolean','select')),
	CONSTRAINT "custom_field_position_check" CHECK ("custom_field_definitions"."position" BETWEEN 0 AND 999),
	CONSTRAINT "custom_field_options_check" CHECK (jsonb_typeof("custom_field_definitions"."options")='array' AND jsonb_array_length("custom_field_definitions"."options")<=30)
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "custom_fields_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "custom_field_schema" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "custom_fields_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "custom_field_schema" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "custom_fields_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "custom_field_schema" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "custom_field_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_active_name_idx" ON "custom_field_definitions" USING btree ("organization_id","entity","name") WHERE NOT "custom_field_definitions"."archived";--> statement-breakpoint
CREATE INDEX "custom_field_org_entity_idx" ON "custom_field_definitions" USING btree ("organization_id","entity");--> statement-breakpoint
CREATE FUNCTION crm_custom_field_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE scope uuid; item jsonb;
BEGIN
  scope := CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  PERFORM id FROM organizations WHERE id=scope FOR UPDATE;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Archive custom fields instead of deleting' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (OLD.id,OLD.organization_id,OLD.entity,OLD.type,OLD.options) IS DISTINCT FROM (NEW.id,NEW.organization_id,NEW.entity,NEW.type,NEW.options) THEN
    RAISE EXCEPTION 'Custom field identity and type are immutable' USING ERRCODE='23514';
  END IF;
  IF length(btrim(NEW.name))=0 OR NEW.version<1 THEN RAISE EXCEPTION 'Invalid custom field' USING ERRCODE='23514'; END IF;
  IF NEW.type='select' THEN
    IF jsonb_array_length(NEW.options)=0 THEN RAISE EXCEPTION 'Empty options' USING ERRCODE='23514'; END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.options) LOOP
      IF jsonb_typeof(item)<>'string' OR length(item #>> '{}') NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid option' USING ERRCODE='23514'; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.options)) <> jsonb_array_length(NEW.options) THEN RAISE EXCEPTION 'Duplicate options' USING ERRCODE='23514'; END IF;
  ELSIF NEW.options<>'[]'::jsonb THEN RAISE EXCEPTION 'Unexpected options' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND (SELECT count(*) FROM custom_field_definitions WHERE organization_id=scope AND entity=NEW.entity)>=150 THEN RAISE EXCEPTION 'Field limit' USING ERRCODE='23514'; END IF;
  IF NOT NEW.archived AND (SELECT count(*) FROM custom_field_definitions WHERE organization_id=scope AND entity=NEW.entity AND NOT archived AND id<>NEW.id)>=50 THEN RAISE EXCEPTION 'Active field limit' USING ERRCODE='23514'; END IF;
  UPDATE organizations SET custom_field_revision=custom_field_revision+1 WHERE id=scope;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER custom_field_configuration BEFORE INSERT OR UPDATE OR DELETE ON custom_field_definitions FOR EACH ROW EXECUTE FUNCTION crm_custom_field_configuration();
--> statement-breakpoint
CREATE FUNCTION crm_validate_custom_fields() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision integer; pair record; f record; v text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.custom_fields IS NOT DISTINCT FROM NEW.custom_fields AND OLD.custom_field_schema=NEW.custom_field_schema AND OLD.organization_id=NEW.organization_id THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND (OLD.is_archived OR OLD.deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Archived record is immutable' USING ERRCODE='23514'; END IF;
  SELECT custom_field_revision INTO revision FROM organizations WHERE id=NEW.organization_id FOR SHARE;
  IF revision IS DISTINCT FROM NEW.custom_field_schema THEN RAISE EXCEPTION 'Stale custom field configuration' USING ERRCODE='23514'; END IF;
  IF jsonb_typeof(NEW.custom_fields)<>'object' OR octet_length(NEW.custom_fields::text)>150000 THEN RAISE EXCEPTION 'Invalid custom values' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    FOR f IN SELECT id FROM custom_field_definitions WHERE organization_id=OLD.organization_id AND entity=TG_ARGV[0] AND archived LOOP
      IF OLD.custom_fields->f.id::text IS DISTINCT FROM NEW.custom_fields->f.id::text THEN RAISE EXCEPTION 'Archived value must be preserved' USING ERRCODE='23514'; END IF;
    END LOOP;
  END IF;
  FOR pair IN SELECT key,value FROM jsonb_each(NEW.custom_fields) LOOP
    SELECT * INTO f FROM custom_field_definitions WHERE organization_id=NEW.organization_id AND entity=TG_ARGV[0] AND id::text=pair.key;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown custom field' USING ERRCODE='23514'; END IF;
    IF f.archived THEN
      IF TG_OP='INSERT' OR OLD.custom_fields->pair.key IS DISTINCT FROM pair.value THEN RAISE EXCEPTION 'Archived field is immutable' USING ERRCODE='23514'; END IF;
      CONTINUE;
    END IF;
    IF jsonb_typeof(pair.value)<>'string' THEN RAISE EXCEPTION 'Custom value must be a string' USING ERRCODE='23514'; END IF;
    v := btrim(pair.value #>> '{}');
    IF length(v)>2000 THEN RAISE EXCEPTION 'Custom value too long' USING ERRCODE='23514'; END IF;
    IF v='' THEN NEW.custom_fields:=NEW.custom_fields-pair.key; CONTINUE; END IF;
    IF f.type='number' AND v !~ '^-?[0-9]{1,12}(\.[0-9]{1,6})?$' THEN RAISE EXCEPTION 'Invalid number' USING ERRCODE='23514'; END IF;
    IF f.type='boolean' AND v NOT IN ('true','false') THEN RAISE EXCEPTION 'Invalid boolean' USING ERRCODE='23514'; END IF;
    IF f.type='select' AND NOT (f.options ? v) THEN RAISE EXCEPTION 'Invalid option' USING ERRCODE='23514'; END IF;
    IF f.type='date' THEN
      IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date' USING ERRCODE='23514'; END IF;
      BEGIN PERFORM v::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Invalid calendar date' USING ERRCODE='23514'; END;
    END IF;
    NEW.custom_fields:=jsonb_set(NEW.custom_fields,ARRAY[pair.key],to_jsonb(v));
  END LOOP;
  FOR f IN SELECT id FROM custom_field_definitions WHERE organization_id=NEW.organization_id AND entity=TG_ARGV[0] AND required AND NOT archived LOOP
    IF NOT (NEW.custom_fields ? f.id::text) THEN RAISE EXCEPTION 'Required custom field is missing' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF TG_OP='UPDATE' THEN
    NEW.custom_fields_version:=OLD.custom_fields_version+1;
    IF TG_ARGV[0]='deal' AND OLD.custom_fields IS DISTINCT FROM NEW.custom_fields THEN NEW.version:=OLD.version+1; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER clients_custom_fields BEFORE INSERT OR UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION crm_validate_custom_fields('client');
--> statement-breakpoint
CREATE TRIGGER companies_custom_fields BEFORE INSERT OR UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION crm_validate_custom_fields('company');
--> statement-breakpoint
CREATE TRIGGER deals_custom_fields BEFORE INSERT OR UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION crm_validate_custom_fields('deal');
--> statement-breakpoint
CREATE FUNCTION crm_custom_fields_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid; scope uuid;
BEGIN
  IF OLD.custom_fields IS NOT DISTINCT FROM NEW.custom_fields OR NULLIF(current_setting('crm.activity_actor',true),'') IS NULL THEN RETURN NEW; END IF;
  actor:=current_setting('crm.activity_actor')::uuid;
  scope:=NULLIF(current_setting('crm.activity_organization',true),'')::uuid;
  IF scope IS DISTINCT FROM NEW.organization_id OR NOT EXISTS(SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.id=actor AND m.organization_id=scope AND m.status='active' AND o.is_active) THEN RAISE EXCEPTION 'Invalid actor' USING ERRCODE='42501'; END IF;
  INSERT INTO activity_events(organization_id,entity_type,entity_id,actor_member_id,event_type,summary)
  VALUES(scope,TG_ARGV[0],NEW.id,actor,TG_ARGV[0]||'.custom_fields_changed','Пользовательские поля: изменение');
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER clients_custom_fields_activity AFTER UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION crm_custom_fields_activity('client');
--> statement-breakpoint
CREATE TRIGGER companies_custom_fields_activity AFTER UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION crm_custom_fields_activity('company');
--> statement-breakpoint
CREATE TRIGGER deals_custom_fields_activity AFTER UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION crm_custom_fields_activity('deal');
