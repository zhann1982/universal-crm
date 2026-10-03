ALTER TABLE "pipelines" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
-- Deal writes share the parent lock with configuration. A write that waited
-- for configuration must validate its committed lifecycle before persisting.
CREATE FUNCTION crm_validate_deal_pipeline() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE archived boolean; stage_type text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id = OLD.organization_id AND NEW.pipeline_id = OLD.pipeline_id
      AND NEW.stage_id = OLD.stage_id AND NOT (OLD.is_archived AND NOT NEW.is_archived) THEN
      RETURN NEW;
    END IF;
  END IF;
  SELECT is_archived INTO archived FROM pipelines WHERE id=NEW.pipeline_id AND organization_id=NEW.organization_id FOR SHARE;
  -- Missing/cross-tenant references are reported by the existing named FKs.
  IF archived THEN RAISE EXCEPTION 'Deal pipeline is unavailable' USING ERRCODE='23514'; END IF;
  SELECT type INTO stage_type FROM pipeline_stages WHERE id=NEW.stage_id AND pipeline_id=NEW.pipeline_id AND organization_id=NEW.organization_id FOR SHARE;
  IF stage_type IS NOT NULL AND ((stage_type='open' AND NEW.closed_at IS NOT NULL) OR (stage_type<>'open' AND NEW.closed_at IS NULL)) THEN
    RAISE EXCEPTION 'Deal stage changed; retry the operation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER crm_deal_pipeline_guard BEFORE INSERT OR UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION crm_validate_deal_pipeline();
