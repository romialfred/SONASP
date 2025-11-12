/*
  # Ajout de la Licence d'Exportation aux Préparations d'Expédition

  ## Vue d'ensemble
  Cette migration ajoute le champ license_id à la table shipping_preparations
  pour lier chaque expédition à sa licence d'exportation et permettre la gestion des quotas.

  ## Modifications
  1. Ajout de la colonne license_id avec contrainte de clé étrangère
  2. Création d'un index pour améliorer les performances de filtrage
  3. Aucune donnée existante n'est affectée (colonne nullable)

  ## Sécurité
  - Pas de perte de données
  - Colonne nullable pour rétrocompatibilité
  - Contrainte ON DELETE SET NULL pour préserver les préparations
*/

-- =====================================================
-- 1. AJOUT DE LA COLONNE license_id
-- =====================================================

-- Vérifier si la colonne existe déjà avant de l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_preparations'
    AND column_name = 'license_id'
  ) THEN
    ALTER TABLE shipping_preparations
    ADD COLUMN license_id UUID REFERENCES export_licenses(id) ON DELETE SET NULL;

    RAISE NOTICE 'Colonne license_id ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne license_id existe déjà';
  END IF;
END $$;

-- =====================================================
-- 2. CRÉATION D'UN INDEX POUR LES PERFORMANCES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shipping_preparations_license
ON shipping_preparations(license_id);

-- =====================================================
-- 3. COMMENTAIRE POUR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN shipping_preparations.license_id IS
'Référence à la licence d''exportation utilisée pour cette expédition. Permet de gérer les quotas d''exportation.';

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
