# 🚨 FIX RAPIDE - Erreur Expédition

## Problème
❌ **"Could not find the 'total_weight_oz' column"**

## Solution en 3 Étapes

### 1️⃣ Ouvrir Supabase SQL Editor
- Aller sur : https://supabase.com/dashboard
- Sélectionner votre projet
- Cliquer sur **SQL Editor** (menu gauche)

### 2️⃣ Copier/Coller ce SQL
```sql
-- Ajouter mining_company_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN mining_company_id UUID REFERENCES mining_companies(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_mining_company ON shipping_preparations(mining_company_id);
  END IF;
END $$;

-- Ajouter license_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN license_id UUID REFERENCES export_licenses(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license ON shipping_preparations(license_id);
  END IF;
END $$;

-- Ajouter total_weight_oz
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' AND column_name = 'total_weight_oz'
  ) THEN
    ALTER TABLE shipping_preparations ADD COLUMN total_weight_oz DECIMAL(12, 4) DEFAULT 0;
    UPDATE shipping_preparations SET total_weight_oz = ROUND((total_net_weight_grams / 31.1035)::numeric, 4) WHERE total_net_weight_grams > 0;
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_weight_oz ON shipping_preparations(total_weight_oz);
  END IF;
END $$;
```

### 3️⃣ Exécuter
- Cliquer **RUN** (ou Ctrl+Enter)
- Attendre "Success"
- Rafraîchir l'app (F5)

## ✅ C'est réglé !

**Fichier migration complet** : `supabase/migrations/fix_shipping_preparations_columns.sql`
**Documentation détaillée** : `MIGRATION_SHIPPING_FIX_REQUIRED.md`
