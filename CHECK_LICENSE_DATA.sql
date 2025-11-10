-- Check if any license requests exist in the database
SELECT 
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_count,
  COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted_count,
  COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_count
FROM license_requests;

-- Show the most recent license requests
SELECT 
  id,
  request_number,
  mine_name,
  title,
  status,
  planned_quantity_oz,
  created_at,
  created_by
FROM license_requests
ORDER BY created_at DESC
LIMIT 10;

-- Check RLS policies on license_requests
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'license_requests'
ORDER BY policyname;
