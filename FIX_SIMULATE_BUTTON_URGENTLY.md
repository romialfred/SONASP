# FIX URGENT: Bouton Simulate Ne Fonctionne Pas

## Diagnostic

Le bouton "Simulate" sur la page Gold Trade Space ne fonctionne pas à cause des erreurs 400 (Bad Request) dans la console. Le problème vient du fait que la table `gold_prices_daily` n'existe pas dans la base de données.

### Erreurs Observées

```
GET https://...supabase.co/rest/v1/gold_prices_daily?... 400 (Bad Request)
POST https://...supabase.co/rest/v1/gold_prices_daily 400 (Bad Request)
```

### Cause Racine

1. Le code essaie d'interroger la table `gold_prices_daily` via `goldPriceService.ts`
2. La table n'existe pas car la migration SQL n'a pas été appliquée
3. Les requêtes échouent avec 400 Bad Request
4. Le bouton Simulate échoue silencieusement

## Solution en 3 Étapes

### Étape 1: Appliquer la Migration

**Option A: Via Supabase Dashboard (Recommandé)**

1. Ouvrir le Supabase Dashboard: https://supabase.com/dashboard/project/[PROJECT_ID]/sql/new
2. Copier TOUT le contenu du fichier `CREATE_GOLD_PRICES_TABLES.sql`
3. Coller dans l'éditeur SQL de Supabase
4. Cliquer sur "Run" pour exécuter
5. Vérifier que le message de succès apparaît

**Option B: Via Script**

```bash
node scripts/apply-gold-prices-migration.js
```

### Étape 2: Ajouter des Données Initiales

Après avoir créé la table, exécuter:

```bash
node scripts/seed_lbma_gold_prices.mjs
```

OU utiliser le script de test pour ajouter une donnée minimale:

```bash
node scripts/test_one_date.mjs
```

### Étape 3: Vérifier

1. Actualiser la page Gold Trade Space
2. Cliquer sur un mine avec du stock disponible
3. Cliquer sur le bouton "Simulate"
4. Le bouton devrait maintenant fonctionner et afficher les mécanismes de pricing

## Alternative Rapide: Insertion Manuelle

Si vous ne pouvez pas exécuter les scripts, voici une requête SQL minimale pour faire fonctionner le système immédiatement:

```sql
-- Créer la table
CREATE TABLE IF NOT EXISTS gold_prices_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_date DATE NOT NULL UNIQUE,
  opening_price DECIMAL(10, 2) NOT NULL,
  closing_price DECIMAL(10, 2) NOT NULL,
  high_price DECIMAL(10, 2) NOT NULL,
  low_price DECIMAL(10, 2) NOT NULL,
  london_am_rate DECIMAL(10, 2) NOT NULL,
  london_pm_rate DECIMAL(10, 2),
  spot_price DECIMAL(10, 2),
  average_price DECIMAL(10, 2) NOT NULL,
  source VARCHAR(100) DEFAULT 'LBMA',
  currency VARCHAR(3) DEFAULT 'USD',
  data_points INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activer RLS
ALTER TABLE gold_prices_daily ENABLE ROW LEVEL SECURITY;

-- Policy de lecture publique
CREATE POLICY "Anyone can view daily gold prices"
  ON gold_prices_daily FOR SELECT TO public USING (true);

-- Policy d'insertion pour authenticated
CREATE POLICY "Only authenticated users can insert daily prices"
  ON gold_prices_daily FOR INSERT TO authenticated WITH CHECK (true);

-- Policy de mise à jour pour authenticated
CREATE POLICY "Only authenticated users can update daily prices"
  ON gold_prices_daily FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Insérer un prix initial pour aujourd'hui
INSERT INTO gold_prices_daily (
  price_date,
  opening_price,
  closing_price,
  high_price,
  low_price,
  london_am_rate,
  london_pm_rate,
  average_price,
  source,
  currency
) VALUES (
  CURRENT_DATE,
  4335.10,
  4335.10,
  4369.78,
  4300.42,
  4335.10,  -- Prix AM (utilisé pour les calculs)
  4350.20,  -- Prix PM
  4340.15,
  'Manual Entry',
  'USD'
) ON CONFLICT (price_date) DO UPDATE SET
  london_am_rate = EXCLUDED.london_am_rate,
  updated_at = now();
```

## Vérification du Fix

Après avoir appliqué la solution:

1. Ouvrir la console du navigateur (F12)
2. Actualiser la page Gold Trade Space
3. Les erreurs 400 devraient disparaître
4. Le bouton "Simulate" devrait fonctionner

## Prévention Future

Pour éviter ce genre de régression:

1. **Toujours vérifier les dépendances de table** avant d'utiliser un service
2. **Ajouter un gestionnaire d'erreur gracieux** dans `PricingCalculator.tsx`:

```typescript
const handleCalculate = async () => {
  const qtyInOz = getQuantityInOz();
  if (isNaN(qtyInOz) || qtyInOz <= 0 || qtyInOz > availableStockOz) {
    return;
  }

  setLoading(true);
  try {
    const result = await calculatePricingComparison(qtyInOz);
    if (result.success && result.data) {
      // ... code existant
    } else {
      // Afficher l'erreur à l'utilisateur
      console.error('Pricing calculation failed:', result.error);
      alert(`Unable to calculate pricing: ${result.error}\n\nPlease ensure gold prices data is available.`);
    }
  } catch (error) {
    console.error('Error calculating pricing:', error);
    alert('An error occurred while calculating pricing. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

3. **Maintenir une checklist de dépendances** pour tous les modules critiques
4. **Tester les fonctionnalités** après chaque modification de base de données

## Contact

Si le problème persiste après avoir appliqué ces solutions, vérifiez:
- Les permissions Supabase
- Les RLS policies
- Les logs Supabase pour plus de détails sur l'erreur 400
