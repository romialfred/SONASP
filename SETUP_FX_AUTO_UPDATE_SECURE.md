# 🔐 Configuration FX Auto-Update SÉCURISÉE

## ⚠️ ATTENTION SÉCURITÉ

Le fichier `setup_fx_auto_update_pgadmin.sql` contient votre **service_role key** en clair.
Ceci est acceptable UNIQUEMENT si le fichier reste privé.

## 🎯 Procédure d'Exécution

### Étape 1: Vérifier que les Edge Functions sont Déployées

1. Ouvrez Supabase Dashboard → **Edge Functions**
2. Vérifiez que vous voyez:
   - ✅ `fetch-daily-fx-rates`
   - ✅ `fetch-daily-lbma-prices`

Si elles ne sont PAS là → Déployez-les d'abord (voir guide séparé)

### Étape 2: Exécuter le Script SQL

1. **Ouvrez Supabase SQL Editor**
   ```
   Supabase Dashboard → SQL Editor → New query
   ```

2. **Copiez TOUT le contenu** de `setup_fx_auto_update_pgadmin.sql`

3. **Collez-le** dans l'éditeur SQL

4. **Cliquez "Run"**

### Étape 3: Vérifier l'Installation

Exécutez cette requête dans SQL Editor:

```sql
-- Vérifier que les cron jobs sont créés
SELECT
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
ORDER BY jobname;
```

**Résultat attendu:**
```
jobname                  | schedule     | active
-------------------------+--------------+--------
daily-fx-rates-update    | 0 10 * * 1-5 | t
monthly-fx-aggregation   | 0 11 1 * *   | t
```

### Étape 4: Tester Manuellement

```sql
-- Test 1: Appeler la fonction de mise à jour FX
SELECT public.trigger_daily_fx_update();

-- Test 2: Vérifier les données
SELECT * FROM fx_rates_daily
ORDER BY rate_date DESC
LIMIT 5;
```

## 📅 Calendrier d'Exécution

Une fois configuré, les tâches s'exécuteront automatiquement:

### 1. Mise à Jour FX Quotidienne
- **Quand:** Lundi-Vendredi à 10h00 UTC (11h00 CET)
- **Fait quoi:** Récupère les taux USD/CFA, USD/GNF depuis ECB
- **Stocke dans:** `fx_rates_daily`

### 2. Agrégation Mensuelle FX
- **Quand:** 1er de chaque mois à 11h00 UTC
- **Fait quoi:** Calcule les moyennes du mois précédent
- **Stocke dans:** `fx_rates_monthly`

## 🔍 Surveillance

### Voir l'Historique d'Exécution

```sql
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

### Désactiver Temporairement

```sql
-- Désactiver
UPDATE cron.job SET active = false
WHERE jobname = 'daily-fx-rates-update';

-- Réactiver
UPDATE cron.job SET active = true
WHERE jobname = 'daily-fx-rates-update';
```

## ❌ Problèmes Courants

### Problème: "extension http does not exist"
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

### Problème: "extension pg_cron does not exist"
Contactez le support Supabase (devrait être pré-installé)

### Problème: Edge Function retourne 404
Les Edge Functions doivent être déployées AVANT d'exécuter ce script.

### Problème: Rien ne se passe
1. Vérifiez que les jobs sont actifs:
   ```sql
   SELECT * FROM cron.job WHERE active = true;
   ```
2. Regardez les logs:
   ```sql
   SELECT * FROM cron.job_run_details
   ORDER BY start_time DESC LIMIT 10;
   ```

## 🎯 Prochaine Étape

**Faites la même chose pour Gold Prices:**
- Créez un cron similaire pour `fetch-daily-lbma-prices`
- Schedule: `45 16 * * 1-5` (Lundi-Vendredi à 16h45 UTC)
- Après la fermeture des marchés LBMA

---

## Alternative: Supabase CLI

Si vous préférez utiliser CLI au lieu de pg_cron:

```bash
# Installer
npm install -g supabase

# Se connecter
supabase login
supabase link --project-ref boolqagzdqbahqnpawpb

# Configurer cron (si supporté)
supabase functions schedule fetch-daily-fx-rates --cron "0 10 * * 1-5"
```

**Note:** Cette commande pourrait ne pas fonctionner si votre version de Supabase ne supporte pas les cron schedules via CLI.
