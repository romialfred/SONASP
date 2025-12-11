# Correction des Colonnes fx_rates_monthly_aggregated

## Problème Identifié

Le script `fetch_historical_fx_rates_improved.mjs` utilisait des noms de colonnes incorrects pour la table `fx_rates_monthly_aggregated`.

### Colonnes Incorrectes (dans le script)

- `average_rate` ❌
- `high_rate` ❌
- `low_rate` ❌
- `total_days` ❌
- `volatility` ❌

### Colonnes Correctes (dans la base de données)

- `avg_rate` ✅
- `max_rate` ✅
- `min_rate` ✅
- `data_points` ✅
- `total_volume` ✅

## Erreur Rencontrée

```
❌ Could not find the 'average_rate' column of 'fx_rates_monthly_aggregated' in the schema cache
```

Cette erreur se produisait lors du calcul des agrégats mensuels après l'import des données quotidiennes.

## Structure Complète de la Table

```typescript
interface FxRatesMonthlyAggregated {
  id: string;
  year: number;
  month: number;
  currency_pair: string;
  source_id: string;
  avg_rate: number;        // Taux moyen du mois
  min_rate: number;        // Taux minimum
  max_rate: number;        // Taux maximum
  opening_rate: number;    // Taux d'ouverture (1er jour)
  closing_rate: number;    // Taux de clôture (dernier jour)
  total_volume: number;    // Volume total (somme des taux)
  data_points: number;     // Nombre de jours avec données
  created_at: timestamp;
  updated_at: timestamp;
}
```

## Corrections Appliquées

### 1. Script `fetch_historical_fx_rates_improved.mjs`

Fonction `calculateMonthlyAggregates()` corrigée:

```javascript
// AVANT (incorrect)
{
  average_rate: parseFloat(avgRate.toFixed(6)),
  high_rate: Math.max(...rates),
  low_rate: Math.min(...rates),
  total_days: monthlyData.length,
  volatility: parseFloat(volatility.toFixed(6)),
}

// APRÈS (correct)
{
  avg_rate: parseFloat(avgRate.toFixed(6)),
  max_rate: Math.max(...rates),
  min_rate: Math.min(...rates),
  data_points: monthlyData.length,
  total_volume: parseFloat((rates.reduce((sum, r) => sum + r, 0)).toFixed(2)),
}
```

### 2. Guide `FX_RATES_QUICK_START.md`

Requête SQL corrigée pour vérifier les agrégats:

```sql
-- AVANT (incorrect)
SELECT
  year,
  month,
  currency_pair,
  ROUND(average_rate, 2) as avg_rate,
  ROUND(high_rate, 2) as high,
  ROUND(low_rate, 2) as low,
  total_days
FROM fx_rates_monthly_aggregated

-- APRÈS (correct)
SELECT
  year,
  month,
  currency_pair,
  ROUND(avg_rate, 2) as avg_rate,
  ROUND(max_rate, 2) as max,
  ROUND(min_rate, 2) as min,
  data_points
FROM fx_rates_monthly_aggregated
```

## Scripts de Test Créés

### 1. `scripts/check_table_columns.mjs`

Script de diagnostic pour identifier les colonnes disponibles dans la table.

**Usage:**
```bash
node scripts/check_table_columns.mjs
```

### 2. `scripts/test_monthly_aggregate.mjs`

Script de test pour vérifier l'insertion d'un agrégat mensuel.

**Usage:**
```bash
node scripts/test_monthly_aggregate.mjs
```

## Vérification

Pour vérifier que tout fonctionne correctement:

```bash
# 1. Tester l'import d'une date
node scripts/test_one_date.mjs

# 2. Tester la création d'agrégat
node scripts/test_monthly_aggregate.mjs

# 3. Vérifier dans Supabase
# SELECT * FROM fx_rates_monthly_aggregated ORDER BY year DESC, month DESC LIMIT 10;
```

## Résultat Attendu

Après correction, l'import complet devrait fonctionner:

```bash
node scripts/fetch_historical_fx_rates_improved.mjs
```

Résultat attendu:
```
=== Calcul des Agrégats Mensuels ===
✅ 2024-01 EUR/USD
✅ 2024-01 USD/XOF
✅ 2024-01 USD/GNF
✅ 2024-01 XOF/GNF
...
✅ 96 agrégats mensuels calculés
```

## Autres Fichiers Vérifiés

Les fichiers suivants ont été vérifiés et utilisent déjà les bons noms:

- `src/services/fxRateAggregationService.ts` - Interfaces correctes ✅
- `src/pages/prices/FxRatesPage.tsx` - SELECT * (fonctionne) ✅

## Notes

- Les colonnes pour `gold_prices_monthly_aggregated` sont différentes et n'ont PAS été modifiées
- Les interfaces TypeScript dans le code utilisent les bons noms
- Seul le script d'import avait les mauvais noms

## Prochaines Étapes

1. Exécuter le script complet d'import historique
2. Vérifier les agrégats mensuels créés
3. Tester l'affichage dans l'application

## Date de Correction

2025-12-11
