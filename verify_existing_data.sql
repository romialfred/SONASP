-- Verification script to check existing mining companies and customers

-- Check for Mansa Ressources in mining_companies
SELECT 
  'Mining Companies' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE code = 'MANSA-SA') as mansa_count,
  MAX(CASE WHEN code = 'MANSA-SA' THEN id END) as mansa_id
FROM mining_companies;

-- Check for Mansa Ressources in customers
SELECT 
  'Customers (Mansa)' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE LOWER(email) = 'sales@mansaressources.com') as mansa_count,
  MAX(CASE WHEN LOWER(email) = 'sales@mansaressources.com' THEN id END) as mansa_id
FROM customers;

-- Check for Auramet in customers
SELECT 
  'Customers (Auramet)' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE LOWER(email) = 'trading@auramet.com') as auramet_count,
  MAX(CASE WHEN LOWER(email) = 'trading@auramet.com' THEN id END) as auramet_id
FROM customers;

-- Check for StoneX in customers
SELECT 
  'Customers (StoneX)' as table_name,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE LOWER(email) = 'metals@stonex.com') as stonex_count,
  MAX(CASE WHEN LOWER(email) = 'metals@stonex.com' THEN id END) as stonex_id
FROM customers;

-- Show all mining companies
SELECT id, name, code, country, is_active, created_at
FROM mining_companies
ORDER BY created_at DESC;

-- Show all customers
SELECT id, name, email, country, status, created_at
FROM customers
ORDER BY created_at DESC;
