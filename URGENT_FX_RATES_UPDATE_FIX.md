# URGENT: Correction de la Mise à Jour Automatique des Taux de Change (FX Rates)

## PROBLÈME IDENTIFIÉ

Les taux de change (FX Rates) ne se mettent pas à jour automatiquement car la fonction Edge `fetch-daily-fx-rates` n'est **PAS DÉPLOYÉE** dans Supabase.

**Symptôme:** Les taux restent bloqués au 11 décembre 2025.

## SOLUTION EN 3 ÉTAPES

### Étape 1: Déployer la fonction `fetch-daily-fx-rates`

La fonction existe dans le code mais n'est pas déployée. Vous avez 2 options:

#### Option A: Déploiement via Supabase CLI (Recommandé)

```bash
# 1. Installer Supabase CLI si pas déjà fait
npm install -g supabase

# 2. Se connecter à votre projet
supabase login

# 3. Lier votre projet local
supabase link --project-ref boolqagzdqbahqnpawpb

# 4. Déployer TOUTES les edge functions
supabase functions deploy

# OU déployer seulement fetch-daily-fx-rates
supabase functions deploy fetch-daily-fx-rates
```

#### Option B: Déploiement Manuel via Dashboard Supabase

1. Allez sur https://supabase.com/dashboard/project/boolqagzdqbahqnpawpb
2. Cliquez sur "Edge Functions" dans le menu
3. Cliquez sur "New Function"
4. Nommez-la: `fetch-daily-fx-rates`
5. Copiez le contenu du fichier `supabase/functions/fetch-daily-fx-rates/index.ts`
6. Cliquez sur "Deploy Function"

### Étape 2: Déployer la fonction `scheduled-tasks`

Cette fonction orchestre les tâches automatiques:

```bash
supabase functions deploy scheduled-tasks
```

### Étape 3: Configurer le Cron Job dans Supabase

Il faut configurer un cron job pour appeler automatiquement la fonction chaque jour:

#### Via Supabase Dashboard:

1. Allez dans "Database" > "Extensions"
2. Activez l'extension `pg_cron` si ce n'est pas déjà fait
3. Allez dans "SQL Editor"
4. Exécutez ce SQL:

```sql
-- Créer la table scheduled_tasks si elle n'existe pas
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_name text UNIQUE NOT NULL,
  description text,
  schedule text NOT NULL, -- Cron expression
  is_active boolean DEFAULT true,
  last_run timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insérer les tâches planifiées
INSERT INTO scheduled_tasks (task_name, description, schedule)
VALUES
  ('fetch_exchange_rates', 'Fetch daily FX rates from ECB', '0 10 * * 1-5'),
  ('fetch_gold_prices', 'Fetch daily LBMA gold prices', '0 10 * * 1-5')
ON CONFLICT (task_name) DO NOTHING;

-- Créer un cron job pour exécuter fetch_exchange_rates tous les jours à 10h UTC (lundi-vendredi)
SELECT cron.schedule(
  'fetch_exchange_rates',
  '0 10 * * 1-5', -- Tous les jours ouvrables à 10h UTC
  $$
  SELECT
    net.http_post(
      url:='https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/scheduled-tasks',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"task_name": "fetch_exchange_rates"}'::jsonb
    ) as request_id;
  $$
);

-- Créer un cron job pour exécuter fetch_gold_prices
SELECT cron.schedule(
  'fetch_gold_prices',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
      url:='https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/scheduled-tasks',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
      body:='{"task_name": "fetch_gold_prices"}'::jsonb
    ) as request_id;
  $$
);
```

## TEST MANUEL IMMÉDIAT

Après déploiement, testez immédiatement en appelant la fonction manuellement:

### Via curl:

```bash
curl -X POST https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE"
```

### Réponse attendue:

```json
{
  "success": true,
  "message": "FX rates recorded successfully",
  "data": {
    "date": "2025-12-15",
    "rates": {
      "EUR/USD": 1.16340,
      "USD/XOF": 563.83,
      "USD/GNF": 8715.75,
      "XOF/GNF": 15.4581
    }
  }
}
```

OU si c'est le weekend:

```json
{
  "success": false,
  "message": "Weekend: 2025-12-15",
  "reason": "weekend"
}
```

## VÉRIFICATION POST-DÉPLOIEMENT

1. **Vérifier que la fonction est déployée:**
   - Allez dans Supabase Dashboard > Edge Functions
   - Vous devriez voir `fetch-daily-fx-rates` et `scheduled-tasks` listées

2. **Vérifier les données:**
   ```sql
   SELECT * FROM fx_rates_daily
   ORDER BY rate_date DESC
   LIMIT 10;
   ```

3. **Vérifier le cron job:**
   ```sql
   SELECT * FROM cron.job
   WHERE jobname IN ('fetch_exchange_rates', 'fetch_gold_prices');
   ```

## CALENDRIER D'EXÉCUTION

- **Jours ouvrables (Lundi-Vendredi):** 10h00 UTC
- **Weekends (Samedi-Dimanche):** Pas d'exécution (marchés fermés)
- **Jours fériés:** La fonction s'exécute mais peut retourner les données du dernier jour ouvrable

## IMPORTANT

⚠️ La fonction skip automatiquement les weekends. C'est normal que les taux ne soient pas mis à jour le samedi et dimanche car les marchés de change sont fermés.

⚠️ Après le premier déploiement, exécutez manuellement la fonction pour récupérer les taux manquants depuis le 11 décembre.

## TROUBLESHOOTING

Si après déploiement les taux ne se mettent toujours pas à jour:

1. Vérifier les logs de la fonction:
   ```bash
   supabase functions logs fetch-daily-fx-rates
   ```

2. Vérifier si `pg_cron` est activé:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

3. Vérifier si `pg_net` est activé (requis pour les appels HTTP):
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

## CONTACT

Si vous avez besoin d'aide pour le déploiement, contactez l'équipe technique avec ce document.
