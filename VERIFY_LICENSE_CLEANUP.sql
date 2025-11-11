-- Vérification de la suppression complète du système de licences

-- 1. Vérifier les tables de licences
SELECT 'TABLES:' as check_type, tablename as name 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%license%'
ORDER BY tablename;

-- 2. Vérifier les vues de licences
SELECT 'VIEWS:' as check_type, viewname as name
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname LIKE '%license%'
ORDER BY viewname;

-- 3. Vérifier les fonctions de licences
SELECT 'FUNCTIONS:' as check_type, proname as name
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname LIKE '%license%'
ORDER BY proname;

-- 4. Vérifier les types ENUM de licences
SELECT 'ENUMS:' as check_type, typname as name
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND typname LIKE '%license%'
ORDER BY typname;

-- 5. Vérifier les politiques RLS contenant 'license'
SELECT 'RLS POLICIES:' as check_type, 
       schemaname || '.' || tablename || '.' || policyname as name
FROM pg_policies 
WHERE schemaname = 'public' 
  AND (policyname LIKE '%license%' OR tablename LIKE '%license%')
ORDER BY tablename, policyname;

-- 6. Vérifier les colonnes contenant 'license_id'
SELECT 'COLUMNS WITH license_id:' as check_type,
       table_name || '.' || column_name as name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name LIKE '%license%'
ORDER BY table_name, column_name;

-- 7. Vérifier les buckets de stockage
SELECT 'STORAGE BUCKETS:' as check_type, name
FROM storage.buckets
WHERE name LIKE '%license%'
ORDER BY name;

-- 8. Vérifier les politiques de storage
SELECT 'STORAGE POLICIES:' as check_type, 
       bucket_id || '.' || name as name
FROM storage.policies
WHERE name LIKE '%license%' OR bucket_id LIKE '%license%'
ORDER BY bucket_id, name;
