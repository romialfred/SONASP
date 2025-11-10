-- Check if title column exists in license_requests table

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'license_requests'
ORDER BY ordinal_position;

-- Also check current data in license_requests
SELECT
  id,
  request_number,
  mine_name,
  status,
  created_at
FROM license_requests
ORDER BY created_at DESC
LIMIT 5;
