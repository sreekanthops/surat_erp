-- Migration: Make IntegrationConfig group-scoped
-- Adds groupId column, drops old unique constraint, adds composite index

-- 1. Add groupId column (nullable)
ALTER TABLE "integration_configs" ADD COLUMN "groupId" UUID;

-- 2. Add FK constraint to groups table
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Drop old unique constraint (tenantId, type)
ALTER TABLE "integration_configs" DROP CONSTRAINT IF EXISTS "integration_configs_tenantId_type_key";

-- 4. Add composite index for fast lookups by (tenantId, groupId, type)
CREATE INDEX IF NOT EXISTS "integration_configs_tenantId_groupId_type_idx"
  ON "integration_configs"("tenantId", "groupId", "type");
