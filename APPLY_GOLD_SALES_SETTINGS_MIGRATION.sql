/*
  # Amélioration de la table gold_sales_settings

  1. Nouvelles Colonnes
    - `effective_date` (date) - Date de début d'application du paramétrage

  2. Modifications
    - Ajout de commentaires sur les colonnes pour documentation
    - Index pour optimiser les requêtes

  3. Security
    - Maintien des RLS policies existantes
*/

-- Ajouter la colonne effective_date si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gold_sales_settings'
    AND column_name = 'effective_date'
  ) THEN
    ALTER TABLE gold_sales_settings
    ADD COLUMN effective_date date NOT NULL DEFAULT CURRENT_DATE;

    RAISE NOTICE 'Colonne effective_date ajoutée';
  ELSE
    RAISE NOTICE 'Colonne effective_date existe déjà';
  END IF;
END $$;

-- Ajouter des commentaires sur les colonnes pour documentation
COMMENT ON COLUMN gold_sales_settings.mining_company_id IS 'Mine (Vendeur)';
COMMENT ON COLUMN gold_sales_settings.customer_id IS 'Client (Acheteur)';
COMMENT ON COLUMN gold_sales_settings.max_stock_percentage IS 'Pourcentage maximum du stock vendable à ce client';
COMMENT ON COLUMN gold_sales_settings.sale_method IS 'Méthode de vente';
COMMENT ON COLUMN gold_sales_settings.refining_fees_paid_by_customer IS 'Frais de raffinage payés par le client';
COMMENT ON COLUMN gold_sales_settings.transport_fees_paid_by_customer IS 'Frais de transport payés par le client';
COMMENT ON COLUMN gold_sales_settings.is_active IS 'Paramétrage actif ou désactivé';
COMMENT ON COLUMN gold_sales_settings.effective_date IS 'Date de début d''application';

-- Ajouter un index composite pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_mine_customer
ON gold_sales_settings(mining_company_id, customer_id);

-- Ajouter un index pour les paramètres actifs
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_active
ON gold_sales_settings(is_active) WHERE is_active = true;

-- Ajouter un index pour la date d'effet
CREATE INDEX IF NOT EXISTS idx_gold_sales_settings_effective_date
ON gold_sales_settings(effective_date DESC);
