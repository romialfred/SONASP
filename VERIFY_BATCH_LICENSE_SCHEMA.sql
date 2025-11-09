-- Verify batches table has license_id column
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name IN ('id', 'batch_number', 'license_id', 'weight_grams', 'weight_ounces', 'mining_company_id')
ORDER BY ordinal_position;

-- Check if there are any batches in the database
SELECT COUNT(*) as total_batches FROM batches;

-- Check if there are any licenses
SELECT COUNT(*) as total_licenses FROM licenses WHERE status = 'ACTIVE';

-- Check sample batches with license info
SELECT
  b.id,
  b.batch_number,
  b.license_id,
  b.weight_grams,
  b.weight_ounces,
  b.status,
  l.license_number,
  l.approved_quantity_oz,
  l.status as license_status
FROM batches b
LEFT JOIN licenses l ON b.license_id = l.id
ORDER BY b.created_at DESC
LIMIT 5;
