# 🎯 Guide PGAdmin: Déploiement FX en 2 Étapes

## ⚠️ IMPORTANT À COMPRENDRE

**PGAdmin ne peut PAS déployer les Edge Functions.**

PGAdmin sert uniquement à:
- ✅ Configurer les cron jobs (tâches planifiées)
- ✅ Exécuter des requêtes SQL
- ✅ Vérifier les données

Les Edge Functions se déploient via **Supabase CLI**.

---

## 📋 Processus Complet

### ÉTAPE 1: Déployer les Edge Functions (Supabase CLI)

**Vous devez faire cela EN PREMIER, sinon les cron jobs ne fonctionneront pas.**

```bash
# 1. Installer Supabase CLI
npm install -g supabase

# 2. Se connecter
supabase login

# 3. Lier le projet
cd /tmp/cc-agent/59164212/project
supabase link --project-ref boolqagzdqbahqnpawpb

# 4. Déployer les fonctions
supabase functions deploy fetch-daily-fx-rates
supabase functions deploy scheduled-tasks
```

**Résultat attendu:**
```
✓ Deployed function fetch-daily-fx-rates
Function URL: https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates

✓ Deployed function scheduled-tasks
Function URL: https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/scheduled-tasks
```

**✅ ÉTAPE 1 TERMINÉE**

---

### ÉTAPE 2: Configurer les Cron Jobs (PGAdmin)

**Maintenant vous pouvez utiliser PGAdmin.**

#### A. Ouvrir PGAdmin et se connecter

**Paramètres de connexion:**
- **Host:** `aws-0-eu-central-1.pooler.supabase.com`
- **Port:** `6543`
- **Database:** `postgres`
- **Username:** `postgres.boolqagzdqbahqnpawpb`
- **Password:** [votre mot de passe]
- **SSL Mode:** Require

#### B. Exécuter le script SQL

1. Dans PGAdmin, cliquez sur "Query Tool" (icône SQL)

2. **Ouvrez le fichier:** `setup_fx_auto_update_pgadmin.sql`

3. **Copiez TOUT le contenu** du fichier

4. **Collez** dans la fenêtre Query Tool de PGAdmin

5. **Cliquez sur "Execute" (F5)**

**Résultat attendu:**
```
CREATE EXTENSION
CREATE EXTENSION
CREATE FUNCTION
CREATE FUNCTION
schedule
--------
1

schedule
--------
2

jobid | jobname                | schedule     | active
------|------------------------|--------------|-------
1     | daily-fx-rates-update  | 0 10 * * 1-5 | t
2     | monthly-fx-aggregation | 0 11 1 * *   | t

Query returned successfully
```

**✅ ÉTAPE 2 TERMINÉE**

---

## 🧪 Tests dans PGAdmin

### Test 1: Exécuter manuellement la mise à jour

```sql
SELECT public.trigger_daily_fx_update();
```

**Résultat attendu:**
```
NOTICE: ✅ FX rates update successful: {"success":true,"message":"FX rates recorded successfully",...}
```

### Test 2: Vérifier les données

```sql
SELECT
  rate_date,
  eur_usd,
  usd_xof,
  usd_gnf,
  xof_gnf
FROM fx_rates_daily
ORDER BY rate_date DESC
LIMIT 5;
```

**Résultat attendu:**
```
rate_date  | eur_usd  | usd_xof | usd_gnf  | xof_gnf
-----------|----------|---------|----------|--------
2025-12-15 | 1.16340  | 563.83  | 8715.75  | 15.4581
2025-12-12 | 1.16522  | 564.46  | 8730.25  | 15.4683
...
```

### Test 3: Vérifier les cron jobs

```sql
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%fx%';
```

### Test 4: Voir l'historique d'exécution

```sql
SELECT
  j.jobname,
  d.start_time,
  d.end_time,
  d.status,
  LEFT(d.return_message, 100) as message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname IN ('daily-fx-rates-update', 'monthly-fx-aggregation')
ORDER BY d.start_time DESC
LIMIT 10;
```

---

## 📅 Calendrier d'Exécution

Une fois configuré, les mises à jour se feront automatiquement:

| Tâche | Fréquence | Heure UTC | Heure Paris (CET) |
|-------|-----------|-----------|-------------------|
| Taux FX quotidiens | Lundi-Vendredi | 10h00 | 11h00 |
| Agrégation mensuelle | 1er du mois | 11h00 | 12h00 |

---

## 🔍 Vérification Visuelle dans PGAdmin

### Vue des Tables

Dans PGAdmin, naviguez vers:
```
Servers > Supabase - Gold Shipper > Databases > postgres > Schemas > public > Tables
```

Vous devriez voir:
- ✅ `fx_rates_daily` (taux quotidiens)
- ✅ `fx_rates_monthly` (moyennes mensuelles)

Clic droit sur chaque table > "View/Edit Data" > "All Rows"

---

## 🛠️ Commandes de Maintenance dans PGAdmin

### Désactiver temporairement un cron job
```sql
UPDATE cron.job
SET active = false
WHERE jobname = 'daily-fx-rates-update';
```

### Réactiver un cron job
```sql
UPDATE cron.job
SET active = true
WHERE jobname = 'daily-fx-rates-update';
```

### Supprimer un cron job
```sql
SELECT cron.unschedule('daily-fx-rates-update');
```

### Modifier le calendrier
```sql
-- D'abord supprimer
SELECT cron.unschedule('daily-fx-rates-update');

-- Puis recréer avec nouveau calendrier
SELECT cron.schedule(
  'daily-fx-rates-update',
  '0 8 * * 1-5',  -- Nouveau: 8h00 UTC au lieu de 10h00
  $$SELECT public.trigger_daily_fx_update()$$
);
```

---

## 🆘 Résolution de Problèmes

### ❌ "extension http does not exist"

**Dans PGAdmin:**
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

### ❌ "extension pg_cron does not exist"

pg_cron devrait être pré-installé sur Supabase. Si ce n'est pas le cas, contactez le support Supabase.

### ❌ "Function returned 404"

La Edge Function n'est pas déployée. Retournez à l'ÉTAPE 1 (Supabase CLI).

### ❌ "Could not connect to server"

Vérifiez:
1. Les paramètres de connexion (host, port, username)
2. Votre mot de passe
3. SSL Mode = Require
4. Votre connexion internet

### ❌ "Permission denied"

Vous devez vous connecter avec le user `postgres.boolqagzdqbahqnpawpb` (pas un autre user).

---

## 📊 Diagramme du Processus

```
┌─────────────────────────────────────────────────────────┐
│ ÉTAPE 1: Déploiement Edge Functions (Supabase CLI)      │
│ ✅ Obligatoire - À faire EN PREMIER                     │
└─────────────────────────────────────────────────────────┘
                          ↓
        supabase functions deploy fetch-daily-fx-rates
        supabase functions deploy scheduled-tasks
                          ↓
┌─────────────────────────────────────────────────────────┐
│      Edge Functions Déployées sur Supabase               │
│   https://...supabase.co/functions/v1/fetch-daily-fx... │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ ÉTAPE 2: Configuration Cron Jobs (PGAdmin)              │
│ ✅ Se fait APRÈS le déploiement                         │
└─────────────────────────────────────────────────────────┘
                          ↓
        Exécuter setup_fx_auto_update_pgadmin.sql
                          ↓
┌─────────────────────────────────────────────────────────┐
│      Cron Jobs Configurés dans PostgreSQL               │
│   • daily-fx-rates-update → appelle Edge Function       │
│   • monthly-fx-aggregation → calcule moyennes           │
└─────────────────────────────────────────────────────────┘
                          ↓
                Exécution Automatique
                          ↓
┌─────────────────────────────────────────────────────────┐
│             Données dans les Tables                      │
│   • fx_rates_daily (taux quotidiens)                   │
│   • fx_rates_monthly (moyennes)                        │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist Finale

### Phase 1: Déploiement (Supabase CLI)
- [ ] Supabase CLI installé
- [ ] Connexion effectuée (`supabase login`)
- [ ] Projet lié
- [ ] Edge Functions déployées
- [ ] Test manuel réussi (`curl` ou `node manual_fx_update.mjs`)

### Phase 2: Configuration (PGAdmin)
- [ ] Connexion à Supabase dans PGAdmin
- [ ] Script SQL exécuté (`setup_fx_auto_update_pgadmin.sql`)
- [ ] Cron jobs visibles (`SELECT * FROM cron.job`)
- [ ] Test manuel réussi (`SELECT public.trigger_daily_fx_update()`)
- [ ] Données visibles (`SELECT * FROM fx_rates_daily`)

**✅ CONFIGURATION COMPLÈTE!**

---

## 📖 Fichiers Créés

1. **DEPLOIEMENT_FX_AVEC_PGADMIN_CLARIFIE.md** - Explication détaillée
2. **setup_fx_auto_update_pgadmin.sql** - Script SQL à exécuter
3. **GUIDE_PGADMIN_2_ETAPES.md** - Ce guide (étapes simples)
4. **GUIDE_DEPLOIEMENT_EDGE_FUNCTIONS.md** - Guide CLI complet
5. **deploy-fx-functions.sh** / **.bat** - Scripts automatiques

**Commencez par l'ÉTAPE 1 (Supabase CLI), puis l'ÉTAPE 2 (PGAdmin SQL).**
