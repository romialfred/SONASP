-- =====================================================
-- COMPREHENSIVE DATABASE TRIGGERS & FUNCTIONS ANALYSIS
-- =====================================================
-- Run this script in your Supabase SQL Editor
-- It will extract all triggers and functions with detailed information

\echo '═══════════════════════════════════════════════════════════════'
\echo 'DATABASE TRIGGERS & FUNCTIONS COMPREHENSIVE ANALYSIS'
\echo '═══════════════════════════════════════════════════════════════'
\echo ''

-- =====================================================
-- SECTION 1: ALL CUSTOM FUNCTIONS SUMMARY
-- =====================================================
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 1: ALL CUSTOM FUNCTIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT
    n.nspname as "Schema",
    p.proname as "Function Name",
    pg_get_function_arguments(p.oid) as "Arguments",
    pg_catalog.format_type(p.prorettype, NULL) as "Return Type",
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END as "Volatility",
    CASE p.prosecdef
        WHEN true THEN 'DEFINER'
        ELSE 'INVOKER'
    END as "Security",
    pg_catalog.obj_description(p.oid, 'pg_proc') as "Description"
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
ORDER BY p.proname;

-- =====================================================
-- SECTION 2: ALL TRIGGERS SUMMARY
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 2: ALL TRIGGERS SUMMARY'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT
    t.tgname as "Trigger Name",
    c.relname as "Table",
    CASE t.tgtype::integer & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END as "Timing",
    CASE t.tgtype::integer & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 12 THEN 'INSERT OR DELETE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 24 THEN 'DELETE OR UPDATE'
        WHEN 28 THEN 'INSERT OR DELETE OR UPDATE'
    END as "Event",
    CASE t.tgtype::integer & 1
        WHEN 1 THEN 'ROW'
        ELSE 'STATEMENT'
    END as "Level",
    p.proname as "Function",
    CASE t.tgenabled
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
    END as "Status"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
ORDER BY c.relname, t.tgname;

-- =====================================================
-- SECTION 3: TRIGGER FUNCTIONS WITH FULL DEFINITIONS
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 3: TRIGGER FUNCTIONS - FULL DEFINITIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT
    p.proname as "Function Name",
    '------------------------' as "Separator",
    pg_get_functiondef(p.oid) as "Full Definition"
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND p.prorettype = (SELECT oid FROM pg_type WHERE typname = 'trigger')
ORDER BY p.proname;

-- =====================================================
-- SECTION 4: TRIGGERS GROUPED BY TABLE
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 4: TRIGGERS GROUPED BY TABLE'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT
    c.relname as "Table Name",
    COUNT(*) as "Trigger Count",
    string_agg(t.tgname, ', ' ORDER BY t.tgname) as "Triggers"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
GROUP BY c.relname
ORDER BY c.relname;

-- =====================================================
-- SECTION 5: KEY FUNCTIONS ANALYSIS
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 5: KEY BUSINESS FUNCTIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Production Status Tracking
\echo '1. PRODUCTION STATUS TRACKING:'
\echo '   Function: log_production_status_change()'
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'log_production_status_change'
) as "Exists";

-- Shipping Status Tracking
\echo ''
\echo '2. SHIPPING STATUS TRACKING:'
\echo '   Function: create_shipping_status_history_on_update()'
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'create_shipping_status_history_on_update'
) as "Exists";

-- License Quota Management
\echo ''
\echo '3. LICENSE QUOTA MANAGEMENT:'
SELECT
    p.proname as "Function",
    pg_get_function_arguments(p.oid) as "Arguments"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname IN ('check_license_availability', 'reserve_license_quota', 'release_license_quota', 'update_license_status')
ORDER BY p.proname;

-- =====================================================
-- SECTION 6: TRIGGER EXECUTION ORDER ANALYSIS
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 6: TRIGGER EXECUTION ORDER BY TABLE'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT
    c.relname as "Table",
    t.tgname as "Trigger",
    CASE t.tgtype::integer & 66
        WHEN 2 THEN 'BEFORE'
        ELSE 'AFTER'
    END as "Timing",
    CASE t.tgtype::integer & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 20 THEN 'INSERT OR UPDATE'
        WHEN 28 THEN 'INSERT OR DELETE OR UPDATE'
    END as "Event",
    p.proname as "Function",
    t.tgconstraint = 0 as "Non-Constraint"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_proc p ON t.tgfoid = p.oid
WHERE NOT t.tgisinternal
    AND n.nspname = 'public'
    AND c.relname IN ('daily_production', 'shipping_preparations', 'export_licenses')
ORDER BY c.relname,
    CASE WHEN t.tgtype::integer & 66 = 2 THEN 1 ELSE 2 END,
    t.tgname;

-- =====================================================
-- SECTION 7: DETAILED FUNCTION ANALYSIS
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 7: DETAILED FUNCTION ANALYSIS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Function dependencies
SELECT
    p.proname as "Function",
    CASE
        WHEN p.prorettype = (SELECT oid FROM pg_type WHERE typname = 'trigger') THEN 'Trigger Function'
        ELSE 'Regular Function'
    END as "Type",
    CASE p.prosecdef
        WHEN true THEN '⚠️ SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as "Security Context",
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE (Cacheable)'
        WHEN 's' THEN 'STABLE (Same result in transaction)'
        WHEN 'v' THEN 'VOLATILE (May change)'
    END as "Volatility"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
ORDER BY p.proname;

-- =====================================================
-- SECTION 8: CRITICAL TABLES WITH TRIGGERS
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 8: CRITICAL TABLES WITH TRIGGER PROTECTION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

WITH trigger_info AS (
    SELECT
        c.relname as table_name,
        COUNT(*) as trigger_count,
        bool_or(t.tgtype::integer & 2 = 2) as has_before_trigger,
        bool_or(t.tgtype::integer & 2 = 0) as has_after_trigger,
        bool_or(t.tgtype::integer & 4 = 4) as tracks_insert,
        bool_or(t.tgtype::integer & 16 = 16) as tracks_update,
        bool_or(t.tgtype::integer & 8 = 8) as tracks_delete
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE NOT t.tgisinternal
        AND n.nspname = 'public'
    GROUP BY c.relname
)
SELECT
    table_name as "Table",
    trigger_count as "# Triggers",
    CASE WHEN has_before_trigger THEN '✅' ELSE '❌' END as "Before",
    CASE WHEN has_after_trigger THEN '✅' ELSE '❌' END as "After",
    CASE WHEN tracks_insert THEN '✅' ELSE '❌' END as "INSERT",
    CASE WHEN tracks_update THEN '✅' ELSE '❌' END as "UPDATE",
    CASE WHEN tracks_delete THEN '✅' ELSE '❌' END as "DELETE"
FROM trigger_info
ORDER BY trigger_count DESC, table_name;

-- =====================================================
-- SECTION 9: AUDIT & HISTORY TRACKING ANALYSIS
-- =====================================================
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 9: AUDIT & HISTORY TRACKING SYSTEMS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Check history tables
SELECT
    c.relname as "History Table",
    pg_size_pretty(pg_total_relation_size(c.oid)) as "Size",
    (SELECT COUNT(*) FROM information_schema.table_constraints tc
     WHERE tc.table_name = c.relname AND tc.constraint_type = 'FOREIGN KEY') as "FK Count"
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname LIKE '%history%'
ORDER BY c.relname;

\echo ''
\echo '═══════════════════════════════════════════════════════════════'
\echo 'ANALYSIS COMPLETE'
\echo '═══════════════════════════════════════════════════════════════'
