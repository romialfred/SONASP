/*
  Configuration Automatique des Mises à Jour FX Rates

  Ce script configure:
  1. La table scheduled_tasks
  2. Les extensions nécessaires (pg_cron, pg_net)
  3. Les cron jobs pour l'exécution automatique

  À exécuter dans: Supabase Dashboard > SQL Editor
*/

-- =====================================================
-- 1. Activer les extensions nécessaires
-- =====================================================

-- Extension pour les cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Extension pour les appels HTTP depuis PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- 2. Créer la table scheduled_tasks
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text UNIQUE NOT NULL,
  description text,
  schedule text NOT NULL,
  is_active boolean DEFAULT true,
  last_run timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre la lecture à tous les utilisateurs authentifiés
CREATE POLICY "Allow authenticated users to read scheduled tasks"
  ON scheduled_tasks
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy pour permettre au service role de tout faire
CREATE POLICY "Allow service role full access to scheduled tasks"
  ON scheduled_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. Insérer les tâches planifiées
-- =====================================================

INSERT INTO scheduled_tasks (task_name, description, schedule, is_active)
VALUES
  ('fetch_exchange_rates', 'Fetch daily FX rates from ECB and other sources', '0 10 * * 1-5', true),
  ('fetch_gold_prices', 'Fetch daily LBMA gold prices', '0 10 * * 1-5', true)
ON CONFLICT (task_name)
DO UPDATE SET
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- =====================================================
-- 4. Créer la table fx_rate_sources si pas déjà créée
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fx_rate_sources') THEN
    CREATE TABLE fx_rate_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text UNIQUE NOT NULL,
      name text NOT NULL,
      description text,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );

    ALTER TABLE fx_rate_sources ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow all to read fx_rate_sources"
      ON fx_rate_sources
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Insérer la source ECB si elle n'existe pas
INSERT INTO fx_rate_sources (code, name, description)
VALUES ('ECB', 'European Central Bank', 'Official ECB exchange rates via Frankfurter API')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 5. Configurer les Cron Jobs
-- =====================================================

-- Note: pg_cron nécessite que vous stockiez l'anon_key quelque part
-- Créer une table pour stocker les configs de manière sécurisée

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role to manage app_config"
  ON app_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Vous devez remplacer 'YOUR_ANON_KEY_HERE' par votre vraie clé
-- La clé est: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE

INSERT INTO app_config (key, value, description)
VALUES
  ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE', 'Supabase anonymous key for internal API calls'),
  ('supabase_url', 'https://boolqagzdqbahqnpawpb.supabase.co', 'Supabase project URL')
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Supprimer les anciens cron jobs s'ils existent
SELECT cron.unschedule('fetch_exchange_rates') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch_exchange_rates');
SELECT cron.unschedule('fetch_gold_prices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch_gold_prices');

-- Créer le cron job pour les taux de change FX
-- S'exécute du lundi au vendredi à 10h00 UTC
SELECT cron.schedule(
  'fetch_exchange_rates',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url:=(SELECT value FROM app_config WHERE key = 'supabase_url') || '/functions/v1/scheduled-tasks',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'supabase_anon_key')
      ),
      body:=jsonb_build_object('task_name', 'fetch_exchange_rates')
    );
  $$
);

-- Créer le cron job pour les prix de l'or
SELECT cron.schedule(
  'fetch_gold_prices',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url:=(SELECT value FROM app_config WHERE key = 'supabase_url') || '/functions/v1/scheduled-tasks',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'supabase_anon_key')
      ),
      body:=jsonb_build_object('task_name', 'fetch_gold_prices')
    );
  $$
);

-- =====================================================
-- 6. Vérification
-- =====================================================

-- Afficher tous les cron jobs configurés
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname IN ('fetch_exchange_rates', 'fetch_gold_prices');

-- Afficher les tâches planifiées
SELECT
  task_name,
  description,
  schedule,
  is_active,
  last_run,
  last_status
FROM scheduled_tasks
ORDER BY task_name;

-- Message de succès
DO $$
BEGIN
  RAISE NOTICE '✅ Configuration terminée avec succès!';
  RAISE NOTICE '📅 Les taux de change seront mis à jour automatiquement tous les jours ouvrables à 10h00 UTC';
  RAISE NOTICE '🔍 Pour tester manuellement, appelez: POST /functions/v1/fetch-daily-fx-rates';
  RAISE NOTICE '📊 Pour voir les résultats: SELECT * FROM fx_rates_daily ORDER BY rate_date DESC LIMIT 10;';
END $$;
