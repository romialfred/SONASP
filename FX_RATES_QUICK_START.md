# Démarrage Rapide - Mise à Jour Automatique FX Rates

## Étape 1: Importer les Données Historiques (2024-2025)

Exécutez ce script pour importer toutes les données historiques:

```bash
node scripts/fetch_historical_fx_rates.mjs
```

**Durée**: 20-30 minutes
**Résultat**: Toutes les données de 2024-01-01 à 2025-12-11 seront importées

## Étape 2: Vérifier les Données

```bash
node check_fx_structure.mjs
```

Vous devriez voir les dernières données jusqu'au 11 décembre 2025.

## Étape 3: Configuration du Scheduler Automatique

Le système est déjà configuré pour récupérer automatiquement les données quotidiennes.

### Test Manuel de la Fonction

Testez la fonction edge avec:

```bash
curl -X POST \
  'https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE'
```

### Activer le Scheduler dans Supabase

1. Allez dans **Supabase Dashboard** > **Database** > **Extensions**
2. Activez **pg_cron** si pas déjà fait
3. Exécutez cette requête SQL:

```sql
-- Récupération quotidienne des taux FX à 10:00 UTC (lundi-vendredi)
SELECT cron.schedule(
  'fetch-daily-fx-rates',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
        url:='https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/scheduled-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvb2xxYWd6ZHFiYWhxbnBhd3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzNDMwMTAsImV4cCI6MjA3NjkxOTAxMH0.Dpxbwxfovgs9mghh55eVNhS0NNuJ4GiAO857jVxnstE"}'::jsonb,
        body:='{"task_name": "fetch_exchange_rates"}'::jsonb
    ) as request_id;
  $$
);
```

4. Vérifiez que la tâche est créée:

```sql
SELECT * FROM cron.job WHERE jobname = 'fetch-daily-fx-rates';
```

## Étape 4: Vérification

### Vérifier les Dernières Données

```sql
SELECT
  rate_date,
  currency_pair,
  rate,
  fx_rate_sources.name as source
FROM fx_rates_daily
JOIN fx_rate_sources ON fx_rates_daily.source_id = fx_rate_sources.id
WHERE source_id = (SELECT id FROM fx_rate_sources WHERE code = 'ECB')
ORDER BY rate_date DESC
LIMIT 20;
```

### Vérifier les Agrégats Mensuels

```sql
SELECT
  year,
  month,
  currency_pair,
  ROUND(average_rate, 2) as avg_rate,
  ROUND(high_rate, 2) as high,
  ROUND(low_rate, 2) as low,
  total_days
FROM fx_rates_monthly_aggregated
WHERE year >= 2024
ORDER BY year DESC, month DESC, currency_pair;
```

## Paires de Devises Disponibles

- **EUR/USD**: Euro vers Dollar US
- **USD/XOF**: Dollar US vers Franc CFA (BCEAO)
- **USD/GNF**: Dollar US vers Franc Guinéen
- **XOF/GNF**: Franc CFA vers Franc Guinéen (calculé)

## Sources de Données

1. **Frankfurter.app**: EUR/USD (données ECB, gratuit)
2. **open.er-api.com**: USD/GNF (gratuit, 1500 req/mois)

## Fréquence de Mise à Jour

- **Quotidien**: Lundi-Vendredi à 10:00 UTC
- **Weekends**: Automatiquement skippés
- **Agrégats mensuels**: Calculés automatiquement à la fin de chaque mois

## Problèmes Courants

### Les données ne se mettent pas à jour

1. Vérifiez les logs de la fonction:
   - Supabase Dashboard > Functions > fetch-daily-fx-rates > Logs

2. Vérifiez que le cron job est actif:
```sql
SELECT * FROM cron.job WHERE jobname = 'fetch-daily-fx-rates';
```

3. Testez manuellement la fonction (voir Étape 3)

### Erreur "Already exists"

Normal! La fonction skip automatiquement si les données existent déjà pour la date.

### Erreur API

Les APIs gratuites peuvent avoir des limites. Si une source échoue, la fonction essaie automatiquement le fallback.

## Support

Pour plus de détails, consultez `FX_RATES_AUTO_UPDATE_GUIDE.md`
