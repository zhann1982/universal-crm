ALTER TABLE "deals"
ALTER COLUMN "expected_close_at"
SET DATA TYPE date
USING ("expected_close_at" AT TIME ZONE 'UTC')::date;