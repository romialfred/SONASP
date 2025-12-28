/*
  # Ajout des URLs RECTO/VERSO pour Cartes Professionnelles

  ## Vue d'ensemble
  Cette migration ajoute les colonnes nécessaires pour stocker les URLs des images
  RECTO et VERSO des cartes professionnelles, permettant un aperçu complet.

  ## Modifications

  1. Colonnes ajoutées à `snp_cartes_professionnelles`:
    - `carte_recto_url`: URL de l'image du recto de la carte
    - `carte_verso_url`: URL de l'image du verso de la carte
    - `qr_code_data`: Données du QR code (JSON)
    - `qr_code_url`: URL de l'image du QR code
    - `numero_securite`: Numéro de sécurité unique
    - `validee_par`: Utilisateur validateur
    - `validee_le`: Date de validation
    - `suspendue_le`: Date de suspension
    - `suspendue_par`: Utilisateur suspenseur
    - `motif_suspension`: Raison de la suspension

  2. Contrainte de statut mise à jour:
    - en_cours, validee, en_exploitation, expiree, suspendue, annulee

  3. Index ajoutés pour performance:
    - idx_cartes_numero_securite
    - idx_cartes_validee_par

  ## Sécurité
  - Toutes les colonnes sont optionnelles (nullable)
  - Contraintes FK sur auth.users pour audit
  - Index pour recherche rapide

  ## Comment Appliquer

  ### Via Supabase Dashboard
  1. Se connecter à Supabase Dashboard
  2. Aller dans SQL Editor
  3. Copier-coller ce script complet
  4. Exécuter

  ### Via CLI (si disponible)
  ```bash
  supabase db execute -f scripts/20251228_001_ADD_CARTE_RECTO_VERSO_URLS.sql
  ```
*/

-- ============================================================================
-- ETAPE 1: Ajouter les colonnes pour URLs RECTO/VERSO
-- ============================================================================

-- 1. Colonne carte_recto_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'carte_recto_url'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN carte_recto_url text;

    RAISE NOTICE 'Colonne carte_recto_url ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne carte_recto_url existe déjà';
  END IF;
END $$;

-- 2. Colonne carte_verso_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'carte_verso_url'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN carte_verso_url text;

    RAISE NOTICE 'Colonne carte_verso_url ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne carte_verso_url existe déjà';
  END IF;
END $$;

-- 3. Colonne qr_code_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'qr_code_data'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN qr_code_data text;

    RAISE NOTICE 'Colonne qr_code_data ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne qr_code_data existe déjà';
  END IF;
END $$;

-- 4. Colonne qr_code_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'qr_code_url'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN qr_code_url text;

    RAISE NOTICE 'Colonne qr_code_url ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne qr_code_url existe déjà';
  END IF;
END $$;

-- 5. Colonne numero_securite
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'numero_securite'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN numero_securite text;

    RAISE NOTICE 'Colonne numero_securite ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne numero_securite existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ETAPE 2: Ajouter les colonnes d'audit et de validation
-- ============================================================================

-- 6. Colonne validee_par
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'validee_par'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN validee_par uuid REFERENCES auth.users(id);

    RAISE NOTICE 'Colonne validee_par ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne validee_par existe déjà';
  END IF;
END $$;

-- 7. Colonne validee_le
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'validee_le'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN validee_le timestamptz;

    RAISE NOTICE 'Colonne validee_le ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne validee_le existe déjà';
  END IF;
END $$;

-- 8. Colonne suspendue_le
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'suspendue_le'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN suspendue_le timestamptz;

    RAISE NOTICE 'Colonne suspendue_le ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne suspendue_le existe déjà';
  END IF;
END $$;

-- 9. Colonne suspendue_par
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'suspendue_par'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN suspendue_par uuid REFERENCES auth.users(id);

    RAISE NOTICE 'Colonne suspendue_par ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne suspendue_par existe déjà';
  END IF;
END $$;

-- 10. Colonne motif_suspension
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_cartes_professionnelles'
    AND column_name = 'motif_suspension'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    ADD COLUMN motif_suspension text;

    RAISE NOTICE 'Colonne motif_suspension ajoutée avec succès';
  ELSE
    RAISE NOTICE 'Colonne motif_suspension existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ETAPE 3: Mettre à jour la contrainte de statut
-- ============================================================================

DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'snp_cartes_professionnelles'
    AND constraint_name = 'snp_cartes_professionnelles_statut_check'
  ) THEN
    ALTER TABLE public.snp_cartes_professionnelles
    DROP CONSTRAINT snp_cartes_professionnelles_statut_check;

    RAISE NOTICE 'Ancienne contrainte statut supprimée';
  END IF;

  -- Ajouter la nouvelle contrainte avec tous les statuts
  ALTER TABLE public.snp_cartes_professionnelles
  ADD CONSTRAINT snp_cartes_professionnelles_statut_check
  CHECK (statut = ANY (ARRAY[
    'en_cours'::text,
    'validee'::text,
    'en_exploitation'::text,
    'expiree'::text,
    'suspendue'::text,
    'annulee'::text
  ]));

  RAISE NOTICE 'Nouvelle contrainte statut ajoutée avec succès';
END $$;

-- ============================================================================
-- ETAPE 4: Créer les index pour performance
-- ============================================================================

-- Index sur numero_securite pour validation rapide
CREATE INDEX IF NOT EXISTS idx_cartes_numero_securite
ON public.snp_cartes_professionnelles USING btree (numero_securite);

-- Index sur validee_par pour l'audit
CREATE INDEX IF NOT EXISTS idx_cartes_validee_par
ON public.snp_cartes_professionnelles USING btree (validee_par);

-- ============================================================================
-- ETAPE 5: Ajouter les commentaires
-- ============================================================================

COMMENT ON COLUMN public.snp_cartes_professionnelles.carte_recto_url IS
'URL de l''image du recto de la carte professionnelle générée';

COMMENT ON COLUMN public.snp_cartes_professionnelles.carte_verso_url IS
'URL de l''image du verso de la carte professionnelle générée';

COMMENT ON COLUMN public.snp_cartes_professionnelles.qr_code_data IS
'Données JSON encodées dans le QR code pour vérification';

COMMENT ON COLUMN public.snp_cartes_professionnelles.qr_code_url IS
'URL de l''image du QR code généré';

COMMENT ON COLUMN public.snp_cartes_professionnelles.numero_securite IS
'Numéro de sécurité unique à 10 chiffres pour validation';

COMMENT ON COLUMN public.snp_cartes_professionnelles.validee_par IS
'Utilisateur ayant validé la carte professionnelle';

COMMENT ON COLUMN public.snp_cartes_professionnelles.validee_le IS
'Date et heure de validation de la carte';

COMMENT ON COLUMN public.snp_cartes_professionnelles.suspendue_le IS
'Date et heure de suspension de la carte';

COMMENT ON COLUMN public.snp_cartes_professionnelles.suspendue_par IS
'Utilisateur ayant suspendu la carte';

COMMENT ON COLUMN public.snp_cartes_professionnelles.motif_suspension IS
'Raison de la suspension de la carte professionnelle';

-- Message final
DO $$
BEGIN
  RAISE NOTICE '✅ Migration terminée avec succès!';
  RAISE NOTICE 'Colonnes ajoutées: carte_recto_url, carte_verso_url, qr_code_data, qr_code_url, numero_securite';
  RAISE NOTICE 'Colonnes audit: validee_par, validee_le, suspendue_le, suspendue_par, motif_suspension';
  RAISE NOTICE 'Index créés: idx_cartes_numero_securite, idx_cartes_validee_par';
END $$;
