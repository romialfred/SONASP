-- ============================================================================
-- QUICK FIX: Just check and fix the data (run this first!)
-- ============================================================================

-- 1. Check what you have
SELECT
  'BEFORE FIX' as status,
  COUNT(*) as total,
  COUNT(CASE WHEN title IS NOT NULL THEN 1 END) as has_title,
  COUNT(CASE WHEN title IS NULL THEN 1 END) as missing_title
FROM license_requests;

-- 2. Show current data
SELECT id, request_number, title, mine_name, status
FROM license_requests
ORDER BY created_at DESC;

-- 3. Fix NULL titles
UPDATE license_requests
SET title = 'Export License Request for ' || COALESCE(mine_name, 'Unknown Mine')
WHERE title IS NULL OR title = '';

-- 4. Verify fix
SELECT
  'AFTER FIX' as status,
  COUNT(*) as total,
  COUNT(CASE WHEN title IS NOT NULL THEN 1 END) as has_title
FROM license_requests;

-- 5. Show fixed data
SELECT id, request_number, title, mine_name, status, planned_quantity_oz
FROM license_requests
ORDER BY created_at DESC;
