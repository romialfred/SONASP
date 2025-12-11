# Fix Rapide: Intégration Données LBMA

## Problème Identifié

La table `gold_prices_daily` existe mais sa structure ne correspond pas exactement aux colonnes utilisées dans le script d'import.

L'erreur: `Could not find the 'closing_price' column`

## Solution en 2 Étapes

### Étape 1: Vérifier la Structure de Votre Table

Exécutez dans Supabase SQL Editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'gold_prices_daily'
ORDER BY ordinal_position;
```

**Copiez le résultat ici pour que je puisse adapter le script.**

### Étape 2: Solutions Possibles

#### Option A: La table a une structure différente

Si votre table utilise des noms de colonnes différents (ex: `close` au lieu de `closing_price`), je dois adapter le script.

**Colonnes probables dans votre table:**
- `price_date`
- `london_am_rate` OU `am_price`
- `london_pm_rate` OU `pm_price`
- `opening_price` OU `open` OU `opening`
- `closing_price` OU `close` OU `closing`
- `high_price` OU `high`
- `low_price` OU `low`
- `spot_price` OU `spot`
- `average_price` OU `avg` OU `average`

#### Option B: Recréer la table avec la bonne structure

Si vous voulez utiliser le script tel quel, exécutez cette migration:

```sql
-- Drop existing table (ATTENTION: supprime les données!)
DROP TABLE IF EXISTS gold_prices_daily CASCADE;
DROP TABLE IF EXISTS gold_prices_monthly CASCADE;

-- Recréer avec la bonne structure
-- Copier le contenu de CREATE_GOLD_PRICES_TABLES.sql
```

Puis relancez:
```bash
node scripts/fetch_lbma_historical_data.mjs
```

---

## Alternative: Import Manuel Rapide

Si vous voulez juste tester rapidement avec des données, voici un script SQL simple:

```sql
-- Générer 20 jours de données de test pour décembre 2025
INSERT INTO gold_prices_daily (
  price_date,
  london_am_rate,
  london_pm_rate,
  opening_price,
  closing_price,
  high_price,
  low_price,
  spot_price,
  average_price,
  source,
  currency
)
SELECT
  date_series.date as price_date,
  4200 + (random() * 100) as london_am_rate,
  4200 + (random() * 100) + 10 as london_pm_rate,
  4200 + (random() * 100) - 5 as opening_price,
  4200 + (random() * 100) + 5 as closing_price,
  4200 + (random() * 100) + 20 as high_price,
  4200 + (random() * 100) - 20 as low_price,
  4200 + (random() * 100) as spot_price,
  4200 + (random() * 100) as average_price,
  'Test Data' as source,
  'USD' as currency
FROM generate_series(
  '2025-12-01'::date,
  '2025-12-20'::date,
  '1 day'::interval
) AS date_series(date)
WHERE EXTRACT(DOW FROM date_series.date) NOT IN (0, 6); -- Exclure weekends
```

Puis vérifiez dans votre interface Gold Prices!

---

## Quelle Approche Préférez-vous?

1. **Me donner la structure de votre table** → Je vais adapter le script
2. **Recréer la table** → Utiliser CREATE_GOLD_PRICES_TABLES.sql
3. **Import manuel rapide** → Utiliser le SQL ci-dessus pour tester

Dites-moi quelle option vous convient le mieux!
