/*
  # Ajout de la colonne total_weight_oz à shipping_preparations

  ## Changements
  1. Ajoute la colonne `total_weight_oz` à la table `shipping_preparations`
     - Type: DECIMAL(12, 4) pour précision
     - Default: 0
     - Stocke le poids total en onces troy

  ## Sécurité
  - Pas de changement aux politiques RLS existantes
  - La colonne est accessible avec les mêmes permissions que la table

  ## Notes
  - 1 once troy = 31.1035 grammes
  - Cette colonne est calculée à partir de total_net_weight_grams
*/

-- Ajouter la colonne total_weight_oz si elle n'existe pas
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
    SET total_weight_oz = total_net_weight_grams / 31.1035 
    WHERE total_net_weight_grams > 0;
  END IF;
END $$;

-- Créer un index pour améliorer les performances des recherches par poids
CREATE INDEX IF NOT EXISTS idx_shipping_preparations_weight_oz 
ON shipping_preparations(total_weight_oz);

-- Commentaire pour documentation
COMMENT ON COLUMN shipping_preparations.total_weight_oz IS 
'Poids total net en onces troy (1 oz = 31.1035g), calculé à partir de total_net_weight_grams';
