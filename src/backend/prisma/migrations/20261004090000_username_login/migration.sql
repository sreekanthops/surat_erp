-- Migration: Replace phone-based login with groupname/username login
-- 1. Add username column (default to phone or 'user' temporarily to satisfy NOT NULL)
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(100);

-- 2. Back-fill existing users: use phone as username if available, else user id prefix
UPDATE "users" SET "username" = COALESCE(
  REGEXP_REPLACE(phone, '[^a-zA-Z0-9_]', '', 'g'),
  SUBSTRING(id::text, 1, 8)
) WHERE "username" IS NULL;

-- 3. Make username NOT NULL now that all rows have a value
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- 4. Remove the old phone unique constraint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";

-- 5. Make groupId NOT NULL (all users must belong to a group)
--    First give any null groupId users a group — find their tenant's first group
UPDATE "users" u
SET "groupId" = (
  SELECT g.id FROM "groups" g WHERE g."tenantId" = u."tenantId" LIMIT 1
)
WHERE u."groupId" IS NULL;

-- 6. Add unique constraint on (groupId, username) — usernames are unique within a group
CREATE UNIQUE INDEX IF NOT EXISTS "users_groupId_username_key"
  ON "users"("groupId", "username");
