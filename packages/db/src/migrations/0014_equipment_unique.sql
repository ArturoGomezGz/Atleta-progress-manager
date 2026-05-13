-- Remove duplicate global equipment rows (keep one per name, lowest UUID wins)
DELETE FROM "equipment"
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM "equipment"
  WHERE is_global = true AND created_by IS NULL
  ORDER BY name, id
)
AND is_global = true AND created_by IS NULL;

-- Add partial unique index: global platform equipment must have unique names
CREATE UNIQUE INDEX IF NOT EXISTS "equipment_global_name_unique"
ON "equipment" (name)
WHERE is_global = true AND created_by IS NULL;
