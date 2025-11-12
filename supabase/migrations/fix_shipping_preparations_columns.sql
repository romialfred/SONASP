/*
  # Correction de la structure de shipping_preparations

  ## Changements
  1. Ajoute les colonnes manquantes:
     - `mining_company_id` : Référence à la compagnie minière
     - `license_id` : Référence à la licence d'exportation
     - `total_weight_oz` : Poids total en onces troy

  ## Sécurité
  - Pas de changement aux politiques RLS existantes
  - Les colonnes sont accessibles avec les mêmes permissions que la table

  ## Notes
  - Utilise IF NOT EXISTS pour éviter les erreurs si les colonnes existent déjà
  - Conserve la compatibilité avec les données existantes
*/

-- 1. Ajouter mining_company_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN mining_company_id UUID REFERENCES mining_companies(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_mining_company 
    ON shipping_preparations(mining_company_id);
  END IF;
END $$;

-- 2. Ajouter license_id si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN license_id UUID REFERENCES export_licenses(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license 
    ON shipping_preparations(license_id);
  END IF;
END $$;

-- 3. Ajouter total_weight_oz si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipping_preparations' 
    AND column_name = 'total_weight_oz'
  ) THEN
    ALTER TABLE shipping_preparations 
    ADD COLUMN total_weight_oz DECIMAL(12, 4) DEFAULT 0;
    
    -- Mettre à jour les valeurs existantes basées sur total_net_weight_grams
    UPDATE shipping_preparations 
    SET total_weight_oz = ROUND((total_net_weight_grams / 31.1035)::numeric, 4)
    WHERE total_net_weight_grams > 0;
    
    CREATE INDEX IF NOT EXISTS idx_shipping_preparations_weight_oz 
    ON shipping_preparations(total_weight_oz);
  END IF;
END $$;

-- Commentaires pour documentation
COMMENT ON COLUMN shipping_preparations.mining_company_id IS 
'Référence à la compagnie minière d''origine de la production';

COMMENT ON COLUMN shipping_preparations.license_id IS 
'Référence à la licence d''exportation utilisée pour cette expédition';

COMMENT ON COLUMN shipping_preparations.total_weight_oz IS 
'Poids total net en onces troy (1 oz = 31.1035g), calculé à partir de total_net_weight_grams';
