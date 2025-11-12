/*
  # Ajout de la Compagnie Minière aux Préparations d'Expédition

  ## Vue d'ensemble
  Cette migration ajoute le champ mining_company_id à la table shipping_preparations
  pour permettre le filtrage des productions par compagnie minière.

  ## Modifications
  1. Ajout de la colonne mining_company_id avec contrainte de clé étrangère
  2. Création d'un index pour améliorer les performances de filtrage
  3. Aucune donnée existante n'est affectée (colonne nullable)

  ## Sécurité
  - Pas de perte de données
  - Colonne nullable pour rétrocompatibilité
  - Contrainte ON DELETE SET NULL pour préserver les préparations
*/

-- =====================================================
-- 1. AJOUT DE LA COLONNE mining_company_id
-- =====================================================

-- Vérifier si la colonne existe déjà avant de l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'mining_company_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN mining_company_id UUID REFERENCES mining_companies(id) ON DELETE SET NULL;

    RAISE NOTICE 'Colonne mining_company_id ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne mining_company_id existe déjà';
  END IF;
END $$;

-- =====================================================
-- 2. CRÉATION D'UN INDEX POUR LES PERFORMANCES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_mining_company
ON shipping_preparations(mining_company_id);

-- =====================================================
-- 3. COMMENTAIRE POUR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN shipping_preparations.mining_company_id IS
'Référence à la compagnie minière dont proviennent les productions de cette expédition. Permet de filtrer les productions par compagnie.';

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
