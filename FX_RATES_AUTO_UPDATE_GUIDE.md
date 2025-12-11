# Guide de Mise à Jour Automatique des Taux de Change (FX Rates)

## Vue d'ensemble

Ce système met automatiquement à jour les taux de change quotidiens pour les paires de devises utilisées dans les opérations en Afrique de l'Ouest:
- **EUR/USD**: Euro vers Dollar US
- **USD/XOF**: Dollar US vers Franc CFA BCEAO
- **USD/GNF**: Dollar US vers Franc Guinéen
- **XOF/GNF**: Franc CFA vers Franc Guinéen (taux croisé)

## Sources de Données

### Sources Actives

1. **Banque Centrale Européenne (ECB)**
   - API: `https://api.exchangerate.host`
   - Fournit: EUR/USD et données de base
   - Gratuit, fiable, données quotidiennes

2. **ExchangeRate-API**
   - API: `https://open.er-api.com/v6/latest/USD`
   - Fournit: USD/GNF et autres devises
   - Gratuit (1500 requêtes/mois)

### Calculs Automatiques

- **USD/XOF**: Calculé depuis EUR/USD en utilisant le taux fixe: 1 EUR = 655.957 XOF
- **XOF/GNF**: Taux croisé calculé depuis USD/XOF et USD/GNF

## Architecture du Système

```
┌─────────────────────────┐
│   Supabase Scheduler    │
│   (Cron: Daily 10:00)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  scheduled-tasks        │
│  Edge Function          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ fetch-daily-fx-rates    │
│ Edge Function           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  fx_rates_daily         │
│  (Données quotidiennes) │
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ fx_rates_monthly_agg    │
│ (Agrégats mensuels)     │
└─────────────────────────┘
```

## Tables de la Base de Données

### fx_rate_sources
Stocke les informations sur les sources de taux:
- `id`: UUID
- `code`: Code unique (ex: 'ECB', 'REVOLUT')
- `name`: Nom complet
- `api_url`: URL de l'API (si disponible)
- `is_active`: Booléen pour activer/désactiver

### fx_rates_daily
Stocke les taux quotidiens:
- `id`: UUID
- `rate_date`: Date du taux
- `source_id`: Référence à fx_rate_sources
- `currency_pair`: Paire de devises (ex: 'USD/GNF')
- `rate`: Taux de change
- `bid_rate`: Taux d'achat (optionnel)
- `ask_rate`: Taux de vente (optionnel)
- `spread`: Écart achat/vente (optionnel)
- `notes`: Notes

### fx_rates_monthly_aggregated
Agrégats mensuels calculés automatiquement:
- `year`, `month`: Période
- `source_id`: Source
- `currency_pair`: Paire
- `average_rate`: Taux moyen
- `high_rate`: Taux maximum
- `low_rate`: Taux minimum
- `opening_rate`: Taux d'ouverture
- `closing_rate`: Taux de clôture
- `volatility`: Volatilité calculée

## Déploiement

### 1. Récupération des Données Historiques

Exécutez ce script pour importer les données de 2024 et 2025:

```bash
node scripts/fetch_historical_fx_rates.mjs
```

Ce script:
- Récupère les données du 1er janvier 2024 au 11 décembre 2025
- Exclut automatiquement les weekends
- Calcule les agrégats mensuels
- Évite les doublons

**Durée estimée**: 20-30 minutes (avec délais pour éviter les limitations de l'API)

### 2. Déploiement de l'Edge Function

Déployez la nouvelle fonction:

```bash
# Via MCP Server (recommandé)
mcp__supabase__deploy_edge_function

# Ou via CLI Supabase (si disponible)
supabase functions deploy fetch-daily-fx-rates
```

### 3. Configuration du Scheduler

La fonction `scheduled-tasks` a été mise à jour pour appeler automatiquement `fetch-daily-fx-rates`.

Pour activer le scheduler dans Supabase:

1. Allez dans **Database** > **Extensions**
2. Activez l'extension **pg_cron** si pas déjà fait
3. Créez une tâche cron:

```sql
-- Récupération quotidienne des taux FX à 10:00 UTC (lundi-vendredi)
SELECT cron.schedule(
  'fetch-daily-fx-rates',
  '0 10 * * 1-5',
  $$
  SELECT
    net.http_post(
        url:='https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/scheduled-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.anon_key') || '"}'::jsonb,
        body:='{"task_name": "fetch_exchange_rates"}'::jsonb
    ) as request_id;
  $$
);
```

### 4. Test Manuel

Pour tester manuellement la fonction:

```bash
# Via curl
curl -X POST \
  'https://boolqagzdqbahqnpawpb.supabase.co/functions/v1/fetch-daily-fx-rates' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'
```

Ou via l'interface utilisateur: Appelez la fonction depuis Supabase Dashboard.

## Vérification

### Vérifier les données dans la base

```sql
-- Derniers taux enregistrés
SELECT
  rate_date,
  currency_pair,
  rate,
  fx_rate_sources.name as source_name
FROM fx_rates_daily
JOIN fx_rate_sources ON fx_rates_daily.source_id = fx_rate_sources.id
ORDER BY rate_date DESC
LIMIT 20;

-- Agrégats mensuels
SELECT
  year,
  month,
  currency_pair,
  average_rate,
  high_rate,
  low_rate
FROM fx_rates_monthly_aggregated
WHERE year = 2025
ORDER BY year DESC, month DESC, currency_pair;
```

## Maintenance

### Ajout d'une Nouvelle Source

1. Ajoutez la source dans `fx_rate_sources`:
```sql
INSERT INTO fx_rate_sources (code, name, api_url, is_active)
VALUES ('BCEAO', 'Banque Centrale des États de l''Afrique de l''Ouest', 'https://api.bceao.int/...', true);
```

2. Modifiez `fetch-daily-fx-rates/index.ts` pour inclure la nouvelle API

3. Redéployez la fonction

### Surveillance

Vérifiez les logs de la fonction dans Supabase Dashboard:
- **Functions** > **fetch-daily-fx-rates** > **Logs**

Les erreurs communes:
- **Rate limiting**: Trop de requêtes à l'API (solution: attendre ou changer de source)
- **Weekend**: La fonction skip automatiquement les weekends
- **Données existantes**: La fonction skip si les données existent déjà

### Recalcul des Agrégats Mensuels

Si vous devez recalculer les agrégats:

```sql
-- Supprimer les agrégats existants
DELETE FROM fx_rates_monthly_aggregated
WHERE year = 2025 AND month = 12;

-- Réexécutez le script d'import historique
-- ou appelez manuellement la fonction à la fin du mois
```

## Limites et Considérations

1. **Limites d'API**:
   - ExchangeRate-API: 1500 requêtes/mois (gratuit)
   - Exchangerate.host: Pas de limite stricte sur le tier gratuit

2. **Weekends**: Les taux ne sont pas mis à jour les samedis et dimanches

3. **Délais**: Les données peuvent avoir un délai de quelques heures selon la source

4. **XOF/EUR Peg**: Le taux fixe 655.957 est maintenu par la BCEAO. En cas de modification, mettre à jour la constante `XOF_TO_EUR_PEG` dans le code.

## Support

Pour les problèmes:
1. Vérifier les logs dans Supabase Dashboard
2. Tester manuellement l'API externe
3. Vérifier que les sources sont actives dans `fx_rate_sources`
4. Consulter la documentation des APIs externes

## APIs Alternatives (Si Besoin)

Si les sources actuelles échouent, alternatives:

- **ExchangeRatesAPI.io**: Gratuit jusqu'à 250 requêtes/mois
- **CurrencyAPI.com**: 300 requêtes/mois gratuit
- **Fixer.io**: 100 requêtes/mois gratuit
- **OpenExchangeRates**: 1000 requêtes/mois gratuit

## Changelog

- **2025-12-11**: Création initiale du système
  - Import historique 2024-2025
  - Configuration du scheduler quotidien
  - Intégration ECB et ExchangeRate-API
