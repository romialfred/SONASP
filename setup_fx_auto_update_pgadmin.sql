-- ═══════════════════════════════════════════════════════════════
-- Configuration des Cron Jobs pour Mise à Jour Automatique FX
-- À exécuter dans PGAdmin ou Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════
--
-- PRÉREQUIS IMPORTANT:
-- Les Edge Functions doivent être déployées AVANT via Supabase CLI:
--   1. supabase login
--   2. supabase link --project-ref boolqagzdqbahqnpawpb
--   3. supabase functions deploy fetch-daily-fx-rates
--   4. supabase functions deploy scheduled-tasks
--
-- Ce script configure les cron jobs qui appelleront automatiquement
-- les Edge Functions selon un calendrier défini.
-- ═══════════════════════════════════════════════════════════════

-- 1. Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- 2. Supprimer les anciens cron jobs si ils existent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-fx-rates-update') THEN
    PERFORM cron.unschedule('daily-fx-rates-update');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-fx-aggregation') THEN
    PERFORM cron.unschedule('monthly-fx-aggregation');
  END IF;
END $$;

-- 3. Créer la fonction d'appel pour les taux FX quotidiens
CREATE OR REPLACE FUNCTION public.trigger_daily_fx_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response http_response;
  v_status_code int;
BEGIN
  -- Appeler l'Edge Function fetch-daily-fx-rates
  SELECT * INTO v_response
  FROM http((
    'POST',
    'https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM0MzAxMCwiZXhwIjoyMDc2OTE5MDEwfQ.fFf3rOg5eDm1XAxOL7dUvbpVvURx26g-fSfaOd1-sls')
    ],
    'application/json',
    '{}'::text
  )::http_request);

  v_status_code := v_response.status;

  IF v_status_code = 200 THEN
    RAISE NOTICE '✅ FX rates update successful: %', v_response.content;
  ELSE
    RAISE WARNING '⚠️ FX rates update returned status %: %', v_status_code, v_response.content;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Error in trigger_daily_fx_update: %', SQLERRM;
END;
$$;

-- Ajouter un commentaire à la fonction
COMMENT ON FUNCTION public.trigger_daily_fx_update() IS
'Appelle l''Edge Function fetch-daily-fx-rates pour mettre à jour les taux FX quotidiens depuis ECB et autres sources';

-- 4. Créer la fonction d'agrégation mensuelle
CREATE OR REPLACE FUNCTION public.trigger_monthly_fx_aggregation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_month date;
  v_previous_month date;
  v_avg_rates record;
BEGIN
  -- Premier jour du mois en cours
  v_current_month := date_trunc('month', CURRENT_DATE)::date;
  v_previous_month := (v_current_month - INTERVAL '1 month')::date;

  -- Calculer les moyennes du mois précédent
  SELECT
    date_trunc('month', rate_date)::date as month_date,
    ROUND(AVG(eur_usd)::numeric, 5) as avg_eur_usd,
    ROUND(AVG(usd_xof)::numeric, 2) as avg_usd_xof,
    ROUND(AVG(usd_gnf)::numeric, 2) as avg_usd_gnf,
    ROUND(AVG(xof_gnf)::numeric, 4) as avg_xof_gnf,
    COUNT(*)::integer as days_count
  INTO v_avg_rates
  FROM fx_rates_daily
  WHERE rate_date >= v_previous_month
    AND rate_date < v_current_month
  GROUP BY date_trunc('month', rate_date);

  -- Insérer ou mettre à jour l'agrégation
  IF v_avg_rates.month_date IS NOT NULL AND v_avg_rates.days_count > 0 THEN
    INSERT INTO fx_rates_monthly (
      month_date,
      avg_eur_usd,
      avg_usd_xof,
      avg_usd_gnf,
      avg_xof_gnf,
      days_count,
      created_at,
      updated_at
    ) VALUES (
      v_avg_rates.month_date,
      v_avg_rates.avg_eur_usd,
      v_avg_rates.avg_usd_xof,
      v_avg_rates.avg_usd_gnf,
      v_avg_rates.avg_xof_gnf,
      v_avg_rates.days_count,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (month_date) DO UPDATE SET
      avg_eur_usd = EXCLUDED.avg_eur_usd,
      avg_usd_xof = EXCLUDED.avg_usd_xof,
      avg_usd_gnf = EXCLUDED.avg_usd_gnf,
      avg_xof_gnf = EXCLUDED.avg_xof_gnf,
      days_count = EXCLUDED.days_count,
      updated_at = CURRENT_TIMESTAMP;

    RAISE NOTICE '✅ Monthly FX aggregation completed for % (% days)',
      v_avg_rates.month_date, v_avg_rates.days_count;
  ELSE
    RAISE NOTICE 'ℹ️ No FX data to aggregate for %', v_previous_month;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ Error in trigger_monthly_fx_aggregation: %', SQLERRM;
END;
$$;

-- Ajouter un commentaire à la fonction
COMMENT ON FUNCTION public.trigger_monthly_fx_aggregation() IS
'Calcule et enregistre les moyennes mensuelles des taux FX dans fx_rates_monthly';

-- 5. Planifier la mise à jour quotidienne
-- Exécution: Lundi à Vendredi à 10h00 UTC
SELECT cron.schedule(
  'daily-fx-rates-update',
  '0 10 * * 1-5',  -- Minute Heure Jour Mois JourSemaine (1-5 = Lundi-Vendredi)
  $$SELECT public.trigger_daily_fx_update()$$
);

-- 6. Planifier l'agrégation mensuelle
-- Exécution: Le 1er de chaque mois à 11h00 UTC
SELECT cron.schedule(
  'monthly-fx-aggregation',
  '0 11 1 * *',  -- Le 1er jour de chaque mois à 11h00
  $$SELECT public.trigger_monthly_fx_aggregation()$$
);

-- 7. Vérifier les cron jobs créés
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  command
FROM cron.job
WHERE jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
ORDER BY jobname;

-- ═══════════════════════════════════════════════════════════════
-- ✅ Configuration terminée
-- ═══════════════════════════════════════════════════════════════
--
-- Résultat attendu:
-- ┌───────┬──────────────────────────┬──────────────┬────────┐
-- │ jobid │ jobname                  │ schedule     │ active │
-- ├───────┼──────────────────────────┼──────────────┼────────┤
-- │ 1     │ daily-fx-rates-update    │ 0 10 * * 1-5 │ t      │
-- │ 2     │ monthly-fx-aggregation   │ 0 11 1 * *   │ t      │
-- └───────┴──────────────────────────┴──────────────┴────────┘
--
-- Calendrier d'exécution:
-- • daily-fx-rates-update: Lundi-Vendredi à 10h00 UTC (11h00 CET)
-- • monthly-fx-aggregation: 1er du mois à 11h00 UTC
--
-- ═══════════════════════════════════════════════════════════════
-- TESTS MANUELS
-- ═══════════════════════════════════════════════════════════════

-- Test 1: Exécuter manuellement la mise à jour quotidienne
-- SELECT public.trigger_daily_fx_update();

-- Test 2: Exécuter manuellement l'agrégation mensuelle
-- SELECT public.trigger_monthly_fx_aggregation();

-- Test 3: Vérifier les données quotidiennes
-- SELECT * FROM fx_rates_daily
-- ORDER BY rate_date DESC
-- LIMIT 5;

-- Test 4: Vérifier les données mensuelles
-- SELECT * FROM fx_rates_monthly
-- ORDER BY month_date DESC
-- LIMIT 5;

-- Test 5: Voir l'historique d'exécution des cron jobs
-- SELECT
--   j.jobname,
--   d.start_time,
--   d.end_time,
--   d.status,
--   d.return_message
-- FROM cron.job_run_details d
-- JOIN cron.job j ON j.jobid = d.jobid
-- WHERE j.jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
-- ORDER BY d.start_time DESC
-- LIMIT 20;

-- ═══════════════════════════════════════════════════════════════
-- MAINTENANCE
-- ═══════════════════════════════════════════════════════════════

-- Pour désactiver temporairement un cron job:
-- UPDATE cron.job SET active = false WHERE jobname = 'daily-fx-rates-update';

-- Pour réactiver un cron job:
-- UPDATE cron.job SET active = true WHERE jobname = 'daily-fx-rates-update';

-- Pour supprimer un cron job:
-- SELECT cron.unschedule('daily-fx-rates-update');

-- Pour modifier le calendrier d'un cron job:
-- SELECT cron.unschedule('daily-fx-rates-update');
-- SELECT cron.schedule('daily-fx-rates-update', '0 10 * * 1-5',
--   $$SELECT public.trigger_daily_fx_update()$$);

-- ═══════════════════════════════════════════════════════════════
-- DÉPANNAGE
-- ═══════════════════════════════════════════════════════════════

-- Problème: "extension http does not exist"
-- Solution: CREATE EXTENSION IF NOT EXISTS http;

-- Problème: "extension pg_cron does not exist"
-- Solution: Contactez support Supabase (pg_cron devrait être pré-installé)

-- Problème: Les cron jobs ne s'exécutent pas
-- Vérification:
--   SELECT * FROM cron.job WHERE active = true;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Problème: Edge Function retourne 404
-- Solution: Déployez d'abord les Edge Functions via Supabase CLI

-- ═══════════════════════════════════════════════════════════════
