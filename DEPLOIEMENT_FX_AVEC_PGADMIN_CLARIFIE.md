# ⚠️ Clarification: PGAdmin vs Supabase Edge Functions

## 🔍 Comprendre la Différence

### PGAdmin est pour:
- ✅ Gérer la **base de données PostgreSQL**
- ✅ Exécuter des **requêtes SQL**
- ✅ Créer des tables, fonctions SQL, triggers
- ✅ Configurer **pg_cron** (tâches planifiées dans la DB)

### Edge Functions Supabase sont:
- ❌ **PAS** dans la base de données PostgreSQL
- ❌ **PAS** accessibles via PGAdmin
- ✅ Des fonctions serverless (Deno/TypeScript)
- ✅ Déployées sur l'infrastructure Supabase
- ✅ Accessibles via HTTP/API

## 🎯 Ce Que Vous Pouvez Faire avec PGAdmin

### ✅ Option 1: Configurer les Cron Jobs (APRÈS déploiement)

**Important:** Vous devez d'abord déployer les Edge Functions via Supabase CLI, puis configurer les cron jobs via PGAdmin.

#### Étapes dans PGAdmin:

1. **Ouvrir PGAdmin et se connecter à votre base Supabase**

2. **Créer la connexion:**
   - Host: `aws-0-eu-central-1.pooler.supabase.com`
   - Port: `6543`
   - Database: `postgres`
   - Username: `postgres.boolqagzdqbahqnpawpb`
   - Password: [votre mot de passe]

3. **Exécuter le SQL de configuration:**

```sql
-- ═══════════════════════════════════════════════════════════════
-- Configuration des Cron Jobs pour Mise à Jour Automatique FX
-- ═══════════════════════════════════════════════════════════════
--
-- PRÉREQUIS: Les Edge Functions doivent être déployées via Supabase CLI
--
-- Cette configuration utilise pg_cron pour appeler les Edge Functions
-- automatiquement selon un calendrier défini.
-- ═══════════════════════════════════════════════════════════════

-- 1. Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Supprimer les anciens cron jobs si ils existent
SELECT cron.unschedule('daily-fx-rates-update') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-fx-rates-update'
);

SELECT cron.unschedule('monthly-fx-aggregation') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'monthly-fx-aggregation'
);

-- 3. Créer la fonction d'appel pour les taux FX quotidiens
-- Cette fonction appelle l'Edge Function via HTTP
CREATE OR REPLACE FUNCTION public.trigger_daily_fx_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response text;
BEGIN
  -- Appeler l'Edge Function
  SELECT content::text INTO v_response
  FROM http((
    'POST',
    'https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTM0MzAxMCwiZXhwIjoyMDc2OTE5MDEwfQ.fFf3rOg5eDm1XAxOL7dUvbpVvURx26g-fSfaOd1-sls')
    ],
    'application/json',
    '{}'
  )::http_request);

  RAISE NOTICE 'FX rates update response: %', v_response;
END;
$$;

-- 4. Planifier la mise à jour quotidienne
-- Exécution: Lundi à Vendredi à 10h00 UTC (11h00 CET, 12h00 CEST)
SELECT cron.schedule(
  'daily-fx-rates-update',
  '0 10 * * 1-5',  -- Minute Heure Jour Mois JourSemaine (1-5 = Lundi-Vendredi)
  $$SELECT public.trigger_daily_fx_update()$$
);

-- 5. Créer la fonction d'agrégation mensuelle
CREATE OR REPLACE FUNCTION public.trigger_monthly_fx_aggregation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_month date;
  v_avg_rates record;
BEGIN
  -- Premier jour du mois en cours
  v_current_month := date_trunc('month', CURRENT_DATE)::date;

  -- Calculer les moyennes du mois précédent
  SELECT
    date_trunc('month', rate_date)::date as month_date,
    AVG(eur_usd) as avg_eur_usd,
    AVG(usd_xof) as avg_usd_xof,
    AVG(usd_gnf) as avg_usd_gnf,
    AVG(xof_gnf) as avg_xof_gnf,
    COUNT(*) as days_count
  INTO v_avg_rates
  FROM fx_rates_daily
  WHERE rate_date >= v_current_month - INTERVAL '1 month'
    AND rate_date < v_current_month
  GROUP BY date_trunc('month', rate_date);

  -- Insérer ou mettre à jour l'agrégation
  IF v_avg_rates.month_date IS NOT NULL THEN
    INSERT INTO fx_rates_monthly (
      month_date,
      avg_eur_usd,
      avg_usd_xof,
      avg_usd_gnf,
      avg_xof_gnf,
      days_count
    ) VALUES (
      v_avg_rates.month_date,
      v_avg_rates.avg_eur_usd,
      v_avg_rates.avg_usd_xof,
      v_avg_rates.avg_usd_gnf,
      v_avg_rates.avg_xof_gnf,
      v_avg_rates.days_count
    )
    ON CONFLICT (month_date) DO UPDATE SET
      avg_eur_usd = EXCLUDED.avg_eur_usd,
      avg_usd_xof = EXCLUDED.avg_usd_xof,
      avg_usd_gnf = EXCLUDED.avg_usd_gnf,
      avg_xof_gnf = EXCLUDED.avg_xof_gnf,
      days_count = EXCLUDED.days_count,
      updated_at = CURRENT_TIMESTAMP;

    RAISE NOTICE 'Monthly FX aggregation completed for %', v_avg_rates.month_date;
  END IF;
END;
$$;

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
  database
FROM cron.job
WHERE jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
ORDER BY jobname;

-- ═══════════════════════════════════════════════════════════════
-- ✅ Configuration terminée
-- ═══════════════════════════════════════════════════════════════
--
-- Calendrier d'exécution:
-- • daily-fx-rates-update: Lundi-Vendredi à 10h00 UTC
-- • monthly-fx-aggregation: 1er du mois à 11h00 UTC
--
-- Pour tester manuellement:
--   SELECT public.trigger_daily_fx_update();
--   SELECT public.trigger_monthly_fx_aggregation();
--
-- Pour voir l'historique d'exécution:
--   SELECT * FROM cron.job_run_details
--   WHERE jobid IN (
--     SELECT jobid FROM cron.job
--     WHERE jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
--   )
--   ORDER BY start_time DESC LIMIT 20;
-- ═══════════════════════════════════════════════════════════════
```

4. **Cliquer sur le bouton "Execute" (F5)**

5. **Vérifier que les cron jobs sont créés:**
```sql
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%fx%'
ORDER BY jobname;
```

**Résultat attendu:**
```
jobid | jobname                  | schedule      | active
------|--------------------------|---------------|-------
1     | daily-fx-rates-update    | 0 10 * * 1-5  | true
2     | monthly-fx-aggregation   | 0 11 1 * *    | true
```

### ✅ Option 2: Tester Manuellement dans PGAdmin

Après avoir configuré les cron jobs, vous pouvez tester:

```sql
-- Test de mise à jour quotidienne
SELECT public.trigger_daily_fx_update();

-- Test d'agrégation mensuelle
SELECT public.trigger_monthly_fx_aggregation();

-- Vérifier les données
SELECT * FROM fx_rates_daily
ORDER BY rate_date DESC
LIMIT 5;
```

### ✅ Option 3: Voir l'Historique d'Exécution

```sql
-- Voir les dernières exécutions des cron jobs
SELECT
  j.jobname,
  d.start_time,
  d.end_time,
  d.status,
  d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
ORDER BY d.start_time DESC
LIMIT 20;
```

---

## 🚫 Ce Que Vous NE Pouvez PAS Faire avec PGAdmin

### ❌ Déployer les Edge Functions
Les Edge Functions **NE SONT PAS** dans PostgreSQL. Elles sont sur l'infrastructure Supabase.

**Vous devez utiliser:**
1. **Supabase CLI** (recommandé)
2. **Supabase Dashboard** (interface web)

---

## 📋 Processus Complet en 2 Étapes

### Étape 1: Déployer les Edge Functions (OBLIGATOIRE)

**Via Supabase CLI:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref boolqagzdqbahqnpawpb
supabase functions deploy fetch-daily-fx-rates
supabase functions deploy scheduled-tasks
```

**Ou via Dashboard Supabase:**
- https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb/functions

### Étape 2: Configurer les Cron Jobs (via PGAdmin)

Exécutez le SQL ci-dessus dans PGAdmin.

---

## 🔧 Configuration PGAdmin pour Supabase

### Paramètres de Connexion

| Paramètre | Valeur |
|-----------|--------|
| Host | `aws-0-eu-central-1.pooler.supabase.com` |
| Port | `6543` |
| Database | `postgres` |
| Username | `postgres.boolqagzdqbahqnpawpb` |
| Password | [Votre mot de passe DB] |
| SSL Mode | `require` |

### Étapes de Connexion dans PGAdmin:

1. Ouvrir PGAdmin
2. Clic droit sur "Servers" > "Register" > "Server"
3. Onglet "General":
   - Name: `Supabase - Gold Shipper`
4. Onglet "Connection":
   - Host: `aws-0-eu-central-1.pooler.supabase.com`
   - Port: `6543`
   - Maintenance database: `postgres`
   - Username: `postgres.boolqagzdqbahqnpawpb`
   - Password: [cochez "Save password"]
5. Onglet "SSL":
   - SSL mode: `Require`
6. Cliquez "Save"

---

## ✅ Checklist Complète

### Phase 1: Déploiement Edge Functions (Supabase CLI)
- [ ] Installer Supabase CLI: `npm install -g supabase`
- [ ] Se connecter: `supabase login`
- [ ] Lier projet: `supabase link --project-ref boolqagzdqbahqnpawpb`
- [ ] Déployer: `supabase functions deploy fetch-daily-fx-rates`
- [ ] Déployer: `supabase functions deploy scheduled-tasks`
- [ ] Tester: `node manual_fx_update.mjs`

### Phase 2: Configuration Cron (PGAdmin)
- [ ] Se connecter à PGAdmin
- [ ] Ajouter serveur Supabase
- [ ] Exécuter le SQL de configuration des cron jobs
- [ ] Vérifier les jobs: `SELECT * FROM cron.job`
- [ ] Tester: `SELECT public.trigger_daily_fx_update()`
- [ ] Vérifier données: `SELECT * FROM fx_rates_daily`

---

## 🆘 Dépannage

### "La fonction Edge retourne 404"
→ Elle n'est pas déployée. Utilisez Supabase CLI, pas PGAdmin.

### "Permission denied for http_post"
→ La fonction `http_post` nécessite l'extension `http`. Vérifiez:
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

### "Cron job ne s'exécute pas"
→ Vérifiez que pg_cron est actif:
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-fx-rates-update';
```

### "Can't connect to Supabase in PGAdmin"
→ Vérifiez les paramètres de connexion et activez SSL mode "Require".

---

## 📖 Résumé Visuel

```
┌─────────────────────────────────────────────────────────────────┐
│                  ARCHITECTURE COMPLÈTE                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  1. Edge Functions (Supabase Infrastructure)                     │
│     • fetch-daily-fx-rates (Deno/TypeScript)                    │
│     • scheduled-tasks (Deno/TypeScript)                         │
│     Déploiement: Supabase CLI ou Dashboard                      │
│     ❌ PAS dans PostgreSQL                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP calls
┌─────────────────────────────────────────────────────────────────┐
│  2. Database Functions (PostgreSQL)                              │
│     • trigger_daily_fx_update() → appelle Edge Function         │
│     • trigger_monthly_fx_aggregation()                          │
│     Configuration: PGAdmin ou Supabase SQL Editor               │
│     ✅ Dans PostgreSQL                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ scheduled by
┌─────────────────────────────────────────────────────────────────┐
│  3. Cron Jobs (pg_cron)                                          │
│     • daily-fx-rates-update → 10h00 UTC Lun-Ven                │
│     • monthly-fx-aggregation → 1er du mois 11h00 UTC           │
│     Configuration: PGAdmin ou Supabase SQL Editor               │
│     ✅ Dans PostgreSQL                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ stores data in
┌─────────────────────────────────────────────────────────────────┐
│  4. Tables (PostgreSQL)                                          │
│     • fx_rates_daily                                            │
│     • fx_rates_monthly                                          │
│     Visible: PGAdmin, Supabase Dashboard, Application           │
│     ✅ Dans PostgreSQL                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 TL;DR

**Vous NE pouvez PAS déployer les Edge Functions via PGAdmin.**

**Processus correct:**
1. **Déployer Edge Functions** → Supabase CLI (`supabase functions deploy`)
2. **Configurer cron jobs** → PGAdmin (exécuter le SQL ci-dessus)
3. **Vérifier** → PGAdmin (`SELECT * FROM fx_rates_daily`)

**PGAdmin est pour la base de données, pas pour les fonctions serverless.**
