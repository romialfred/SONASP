-- ================================================
-- VÉRIFICATION DE LA MIGRATION D'ACTIVATION
-- ================================================

-- 1. Vérifier que les 4 nouvelles tables existent
SELECT
  'Tables existantes' as check_type,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_activation_tokens',
    'user_acceptance_logs',
    'user_2fa_setup',
    'password_history'
  )
ORDER BY table_name;

-- 2. Vérifier les nouvelles colonnes sur user_profiles
SELECT
  'Colonnes user_profiles' as check_type,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN (
    'account_activated',
    'activation_completed_at',
    'last_password_change',
    'password_expiry_days',
    'failed_login_attempts',
    'account_locked_until'
  )
ORDER BY column_name;

-- 3. Vérifier les fonctions RPC créées
SELECT
  'Fonctions RPC' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_password_strength',
    'generate_activation_token',
    'validate_activation_token',
    'mark_token_used',
    'check_user_policies_accepted'
  )
ORDER BY routine_name;

-- 4. Vérifier les RLS policies
SELECT
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE tablename IN (
  'user_activation_tokens',
  'user_acceptance_logs',
  'user_2fa_setup',
  'password_history'
)
ORDER BY tablename, policyname;

-- 5. Résumé
SELECT
  'Résumé' as check_type,
  'Tables' as category,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_activation_tokens',
    'user_acceptance_logs',
    'user_2fa_setup',
    'password_history'
  )
UNION ALL
SELECT
  'Résumé' as check_type,
  'Colonnes user_profiles' as category,
  COUNT(*) as count
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN (
    'account_activated',
    'activation_completed_at',
    'last_password_change',
    'password_expiry_days',
    'failed_login_attempts',
    'account_locked_until'
  )
UNION ALL
SELECT
  'Résumé' as check_type,
  'Fonctions RPC' as category,
  COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_password_strength',
    'generate_activation_token',
    'validate_activation_token',
    'mark_token_used',
    'check_user_policies_accepted'
  );
