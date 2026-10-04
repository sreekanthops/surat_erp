-- ============================================================
-- One-time setup: create default group + assign usernames
-- to all existing users in the seed tenant.
-- Run from the backend directory:
--   psql "$DATABASE_URL" -f scripts/setup-groups-usernames.sql
-- ============================================================

-- 1. Create the default group for the seed tenant (idempotent)
INSERT INTO groups (id, "tenantId", name, description, "isActive", "createdAt")
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'textileiq',
  'Default group for GSpaces TextileIQ',
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Assign all existing users in the seed tenant to this group
--    (any user whose groupId is NULL gets the default group)
UPDATE users
SET "groupId" = '00000000-0000-0000-0000-000000000002'
WHERE "tenantId" = '00000000-0000-0000-0000-000000000001'
  AND "groupId" IS NULL;

-- 3. Back-fill username for any users still missing one.
--    Use phone digits if available, else first 8 chars of UUID.
UPDATE users
SET username = COALESCE(
  NULLIF(REGEXP_REPLACE(phone, '[^a-zA-Z0-9_]', '', 'g'), ''),
  SUBSTRING(id::text, 1, 8)
)
WHERE username IS NULL OR username = '';

-- 4. Ensure the owner user (phone 7075077384) gets username 'owner'
UPDATE users
SET username = 'owner'
WHERE phone = '7075077384'
  AND "tenantId" = '00000000-0000-0000-0000-000000000001';

-- 5. Ensure the manager user (phone 9876543210) gets username 'ramesh'
UPDATE users
SET username = 'ramesh'
WHERE phone = '9876543210'
  AND "tenantId" = '00000000-0000-0000-0000-000000000001';

-- 6. If there are duplicate usernames within the same group, suffix them
--    (safety net — unlikely but run just in case)
WITH dupes AS (
  SELECT id,
         "groupId",
         username,
         ROW_NUMBER() OVER (PARTITION BY "groupId", username ORDER BY "createdAt") AS rn
  FROM users
)
UPDATE users u
SET username = u.username || '_' || d.rn
FROM dupes d
WHERE u.id = d.id AND d.rn > 1;

-- 7. Verify
SELECT u.id, u.name, u.username, u.phone, u.role, g.name AS "groupName"
FROM users u
LEFT JOIN groups g ON g.id = u."groupId"
WHERE u."tenantId" = '00000000-0000-0000-0000-000000000001'
ORDER BY u."createdAt";
