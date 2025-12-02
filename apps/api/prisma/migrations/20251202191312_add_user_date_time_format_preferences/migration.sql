-- Add date and time format preferences to User
ALTER TABLE "users" ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY';
ALTER TABLE "users" ADD COLUMN "timeFormat" TEXT NOT NULL DEFAULT '24h';

-- Comment for clarity
COMMENT ON COLUMN "users"."dateFormat" IS 'User preferred date format (e.g., DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)';
COMMENT ON COLUMN "users"."timeFormat" IS 'User preferred time format: 12h or 24h';

