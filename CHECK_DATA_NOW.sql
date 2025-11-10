/*
  ============================================================================
  QUICK DATA CHECK - RUN THIS NOW
  ============================================================================
  This will show if you have data and if the title column has values
  ============================================================================
*/

-- 1. Check if any data exists
SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as records_with_title,
  COUNT(CASE WHEN title IS NULL OR title = '' THEN 1 END) as records_without_title
FROM license_requests;

-- 2. Show the actual data
SELECT
  id,
  request_number,
  title,
  mine_name,
  status,
  planned_quantity_oz,
  request_date,
  created_at
FROM license_requests
ORDER BY created_at DESC;

-- 3. If title is NULL, fix it now
UPDATE license_requests
SET title = 'Export License Request for ' || COALESCE(mine_name, 'Unknown Mine')
WHERE title IS NULL OR title = '';

-- 4. Verify the fix
SELECT
  'AFTER UPDATE' as status,
  COUNT(*) as total_records,
  COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as records_with_title
FROM license_requests;

-- 5. Show final data
SELECT
  id,
  request_number,
  title,
  mine_name,
  status,
  priority,
  planned_quantity_oz,
  request_date
FROM license_requests
ORDER BY created_at DESC;
