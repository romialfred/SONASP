/*
  # Ajout des Colonnes Manquantes - Artisans Miniers

  ## Modifications

  1. Colonnes ajoutées:
    - `updated_by`: UUID de l'utilisateur qui a modifié (audit trail)
    - `telephone_secondaire`: Numéro de téléphone secondaire
    - `numero_registre_commerce`: Numéro registre pour personnes morales

  2. Améliorations:
    - Élargissement de la liste des pays supportés
    - Ajout de 'Autre' pour le sexe (inclusion)
    - Index sur le pays pour les filtres

  ## Sécurité
  - Les politiques RLS existantes restent inchangées
*/

-- ============================================================================
-- Ajouter les colonnes manquantes
-- ============================================================================

-- 1. Colonne updated_by pour l'audit trail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN updated_by uuid REFERENCES auth.users(id);
    
    COMMENT ON COLUMN public.snp_artisans_miniers.updated_by
    IS 'Utilisateur ayant effectué la dernière modification';
  END IF;
END $$;

-- 2. Colonne telephone_secondaire
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'telephone_secondaire'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN telephone_secondaire text;
    
    COMMENT ON COLUMN public.snp_artisans_miniers.telephone_secondaire
    IS 'Numéro de téléphone secondaire/alternatif';
  END IF;
END $$;

-- 3. Colonne numero_registre_commerce pour personnes morales
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'numero_registre_commerce'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN numero_registre_commerce text;
    
    COMMENT ON COLUMN public.snp_artisans_miniers.numero_registre_commerce
    IS 'Numéro d''immatriculation au registre du commerce (personnes morales)';
  END IF;
END $$;

-- ============================================================================
-- Mettre à jour les contraintes CHECK
-- ============================================================================

-- 1. Élargir la contrainte pays pour supporter tous les pays du Sahel
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'snp_artisans_miniers'
    AND constraint_name = 'snp_artisans_miniers_pays_check'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    DROP CONSTRAINT snp_artisans_miniers_pays_check;
  END IF;

  -- Ajouter la nouvelle contrainte avec plus de pays
  ALTER TABLE public.snp_artisans_miniers
  ADD CONSTRAINT snp_artisans_miniers_pays_check
  CHECK (pays = ANY (ARRAY[
    'Burkina Faso'::text,
    'Mali'::text,
    'Niger'::text,
    'Côte d''Ivoire'::text,
    'Guinée'::text,
    'Sénégal'::text,
    'Mauritanie'::text,
    'Bénin'::text,
    'Togo'::text
  ]));
END $$;

-- 2. Ajouter 'Autre' dans la contrainte sexe pour l'inclusion
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'snp_artisans_miniers'
    AND constraint_name = 'snp_artisans_miniers_sexe_check'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    DROP CONSTRAINT snp_artisans_miniers_sexe_check;
  END IF;

  -- Ajouter la nouvelle contrainte
  ALTER TABLE public.snp_artisans_miniers
  ADD CONSTRAINT snp_artisans_miniers_sexe_check
  CHECK (sexe = ANY (ARRAY['M'::text, 'F'::text, 'Autre'::text]));
END $$;

-- ============================================================================
-- Ajouter les index manquants
-- ============================================================================

-- Index sur le pays pour les filtres
CREATE INDEX IF NOT EXISTS idx_artisans_pays
ON public.snp_artisans_miniers USING btree (pays);

-- Index sur updated_by pour l'audit
CREATE INDEX IF NOT EXISTS idx_artisans_updated_by
ON public.snp_artisans_miniers USING btree (updated_by);

-- ============================================================================
-- Commentaires sur la table
-- ============================================================================

COMMENT ON TABLE public.snp_artisans_miniers IS
'Artisans miniers indépendants (exploitants, collecteurs, intermédiaires, fournisseurs) - Multi-pays Sahel';

COMMENT ON COLUMN public.snp_artisans_miniers.pays IS
'Pays d''origine de l''artisan (Burkina Faso, Mali, Niger, Côte d''Ivoire, Guinée, etc.)';

COMMENT ON COLUMN public.snp_artisans_miniers.numero_carte IS
'Numéro unique de la carte professionnelle (ex: SONASP/AM/2025/BF/0001)';

COMMENT ON COLUMN public.snp_artisans_miniers.type_artisan IS
'Type d''activité: exploitant, collecteur, intermediaire, fournisseur';

COMMENT ON COLUMN public.snp_artisans_miniers.collecteur_id IS
'Référence au collecteur associé (pour les exploitants vendant à un collecteur)';
