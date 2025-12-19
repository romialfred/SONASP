# FIX RAPIDE: Bouton Simulate

## Problème Identifié

Le bouton "Simulate" ne fonctionne pas car la table `gold_prices_daily` n'existe pas dans votre base de données Supabase.

## Solution en 2 Minutes

### Option 1: Via Supabase Dashboard (RECOMMANDÉ)

**Étape 1: Ouvrir l'éditeur SQL**
1. Allez sur votre Supabase Dashboard
2. Cliquez sur "SQL Editor" dans le menu latéral
3. Cliquez sur "New Query"

**Étape 2: Créer la table et ajouter des données**
Copiez-collez ce SQL complet:

```sql
-- Créer la table gold_prices_daily
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
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_prices CHECK (
    opening_price > 0 AND
    closing_price > 0 AND
    high_price > 0 AND
    low_price > 0 AND
    london_am_rate > 0 AND
    average_price > 0
  ),

  CONSTRAINT logical_high_low CHECK (high_price >= low_price)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_gold_prices_daily_date
  ON gold_prices_daily(price_date DESC);

-- Activer RLS
ALTER TABLE gold_prices_daily ENABLE ROW LEVEL SECURITY;

-- Policies (lecture publique, écriture authentifiée)
DROP POLICY IF EXISTS "Anyone can view daily gold prices" ON gold_prices_daily;
CREATE POLICY "Anyone can view daily gold prices"
  ON gold_prices_daily FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Only authenticated users can insert daily prices" ON gold_prices_daily;
CREATE POLICY "Only authenticated users can insert daily prices"
  ON gold_prices_daily FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Only authenticated users can update daily prices" ON gold_prices_daily;
CREATE POLICY "Only authenticated users can update daily prices"
  ON gold_prices_daily FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Créer la table gold_prices_monthly
CREATE TABLE IF NOT EXISTS gold_prices_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  average_price DECIMAL(10, 2) NOT NULL,
  high_price DECIMAL(10, 2) NOT NULL,
  low_price DECIMAL(10, 2) NOT NULL,
  opening_price DECIMAL(10, 2) NOT NULL,
  closing_price DECIMAL(10, 2) NOT NULL,
  total_days INTEGER NOT NULL CHECK (total_days >= 0 AND total_days <= 31),
  volatility DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_year_month UNIQUE (year, month),

  CONSTRAINT valid_monthly_prices CHECK (
    average_price > 0 AND
    high_price > 0 AND
    low_price > 0 AND
    opening_price > 0 AND
    closing_price > 0
  ),

  CONSTRAINT logical_monthly_high_low CHECK (high_price >= low_price)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_gold_prices_monthly_year_month
  ON gold_prices_monthly(year DESC, month DESC);

-- Activer RLS
ALTER TABLE gold_prices_monthly ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can view monthly gold prices" ON gold_prices_monthly;
CREATE POLICY "Anyone can view monthly gold prices"
  ON gold_prices_monthly FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Only authenticated users can insert monthly aggregates" ON gold_prices_monthly;
CREATE POLICY "Only authenticated users can insert monthly aggregates"
  ON gold_prices_monthly FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Only authenticated users can update monthly aggregates" ON gold_prices_monthly;
CREATE POLICY "Only authenticated users can update monthly aggregates"
  ON gold_prices_monthly FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Insérer le prix d'or actuel (approximatif)
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
  currency,
  data_points
) VALUES (
  CURRENT_DATE,
  4330.00,
  4335.10,
  4369.78,
  4300.42,
  4335.10,
  4350.20,
  4340.15,
  'Initial Setup',
  'USD',
  1
) ON CONFLICT (price_date) DO UPDATE SET
  london_am_rate = EXCLUDED.london_am_rate,
  closing_price = EXCLUDED.closing_price,
  updated_at = now();

-- Vérification
SELECT
  'Tables créées avec succès!' as message,
  (SELECT COUNT(*) FROM gold_prices_daily) as daily_prices_count,
  (SELECT COUNT(*) FROM gold_prices_monthly) as monthly_prices_count;
```

**Étape 3: Exécuter**
- Cliquez sur "Run" (ou Ctrl+Enter)
- Vous devriez voir un message de succès

### Option 2: Via Script (Si Option 1 échoue)

```bash
node scripts/apply-gold-prices-migration.mjs
```

## Vérification

1. Actualisez votre page Gold Trade Space (F5)
2. Sélectionnez une mine avec du stock disponible (exemple: Kourousa)
3. Cliquez sur le bouton "Simulate"
4. Les mécanismes de pricing devraient maintenant s'afficher

## Si le Problème Persiste

### Vérifier les Erreurs dans la Console

1. Ouvrez la console du navigateur (F12)
2. Actualisez la page
3. Cherchez les erreurs 400 ou autres messages d'erreur
4. Prenez une capture d'écran et partagez-la

### Vérifier que la Table Existe

Dans Supabase Dashboard > Table Editor:
- Vous devriez voir la table `gold_prices_daily`
- Elle devrait contenir au moins 1 ligne de données

### Gestion d'Erreur Améliorée

Le bouton Simulate affichera maintenant un message d'erreur clair si:
- Les données de prix d'or ne sont pas disponibles
- La table n'est pas configurée
- Une autre erreur survient

## Prévention Future

Pour éviter ce genre de problème:

1. **Toujours tester après modification de base de données**
2. **Vérifier les dépendances de table** avant d'utiliser un service
3. **Maintenir une checklist de migrations** appliquées

## Support

Si vous avez besoin d'aide:
1. Vérifiez le fichier `FIX_SIMULATE_BUTTON_URGENTLY.md` pour plus de détails
2. Consultez les logs Supabase pour les erreurs RLS
3. Assurez-vous que les policies sont correctement configurées
