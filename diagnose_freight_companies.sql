-- ========================================
-- FREIGHT COMPANIES DIAGNOSTIC SCRIPT
-- ========================================

-- 1. Check if transport_companies table exists
SELECT 
  'transport_companies table exists: ' || EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'transport_companies'
  )::text as check_result;

-- 2. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transport_companies'
ORDER BY ordinal_position;

-- 3. Count existing records
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_records,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_records
FROM transport_companies;

-- 4. Show all existing data
SELECT 
  id,
  name,
  email,
  phone,
  company_type,
  contact_person,
  address,
  is_active,
  created_at
FROM transport_companies
ORDER BY created_at DESC;

-- 5. Check for RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'transport_companies';

-- 6. Try to insert a test record (will rollback)
BEGIN;
INSERT INTO transport_companies (
  name,
  email,
  phone,
  company_type,
  contact_person,
  address,
  is_active
) VALUES (
  'Test Transport Company',
  'test@transport.com',
  '+1234567890',
  'both',
  'Test Contact',
  'Test Address',
  true
)
RETURNING id, name, created_at;
ROLLBACK;

-- 7. Check if there are any constraints that might fail
SELECT
  con.conname as constraint_name,
  con.contype as constraint_type,
  CASE con.contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    ELSE con.contype::text
  END as constraint_type_label,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'transport_companies';
