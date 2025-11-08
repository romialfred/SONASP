-- Vérification de l'état de la base de données

-- 1. Vérifier les tables liées aux licenses
SELECT 'License Tables Check' as section, 
       table_name, 
       'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'licenses',
    'license_requests', 
    'license_request_documents',
    'license_quota_transactions',
    'license_events',
    'license_kpi_thresholds'
  )
ORDER BY table_name;

-- 2. Vérifier si la colonne license_id existe dans batches
SELECT 'Batches License Column' as section,
       'license_id' as column_name,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'batches' AND column_name = 'license_id'
         ) THEN 'EXISTS'
         ELSE 'MISSING'
       END as status;

-- 3. Vérifier les enums liés aux licenses
SELECT 'License Enums Check' as section,
       typname as enum_name,
       'EXISTS' as status
FROM pg_type 
WHERE typname IN (
  'license_status',
  'license_request_status',
  'license_event_type',
  'quota_transaction_type'
)
ORDER BY typname;

-- 4. Compter les licenses existantes
SELECT 'License Data Count' as section,
       'licenses' as table_name,
       COALESCE((SELECT COUNT(*) FROM licenses WHERE license_number LIKE 'LIC-2024-%'), 0) as count;

-- 5. Vérifier les autres tables importantes
SELECT 'Other Important Tables' as section,
       table_name,
       'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'batches',
    'sales',
    'payments',
    'customers',
    'mining_companies',
    'user_profiles',
    'pre_sales',
    'assay_certificates',
    'batch_documents',
    'customer_banks',
    'fx_rate_analysis',
    'reports',
    'report_schedules'
  )
ORDER BY table_name;
