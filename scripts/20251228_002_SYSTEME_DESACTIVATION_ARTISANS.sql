/*
  # Système de Désactivation des Artisans Miniers

  ## Vue d'ensemble
  Cette migration ajoute un système complet de désactivation des artisans
  avec désactivation automatique à l'expiration de leur carte.

  ## Modifications
  1. Colonnes de désactivation ajoutées à snp_artisans_miniers
  2. Trigger automatique de désactivation à l'expiration
  3. Protection contre suppression si carte existe
  4. Validation pour bloquer ventes/paiements si désactivé
*/

-- ============================================================================
-- ETAPE 1: Ajouter colonnes de désactivation
-- ============================================================================

-- Colonne actif (actif par défaut)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'actif'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN actif boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Colonne desactive_le
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'desactive_le'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN desactive_le timestamptz;
  END IF;
END $$;

-- Colonne desactive_par
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'desactive_par'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN desactive_par uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Colonne motif_desactivation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'snp_artisans_miniers'
    AND column_name = 'motif_desactivation'
  ) THEN
    ALTER TABLE public.snp_artisans_miniers
    ADD COLUMN motif_desactivation text;
  END IF;
END $$;

-- ============================================================================
-- ETAPE 2: Fonction de désactivation automatique à l'expiration
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_desactiver_artisan_carte_expiree()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Désactiver les artisans dont la carte active a expiré
  UPDATE public.snp_artisans_miniers a
  SET
    actif = false,
    desactive_le = NOW(),
    motif_desactivation = 'Carte professionnelle expirée'
  FROM public.snp_cartes_professionnelles c
  WHERE a.id = c.artisan_id
    AND a.actif = true
    AND c.statut IN ('validee', 'en_exploitation')
    AND c.date_expiration < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1
      FROM public.snp_cartes_professionnelles c2
      WHERE c2.artisan_id = a.id
        AND c2.statut IN ('validee', 'en_exploitation')
        AND c2.date_expiration >= CURRENT_DATE
    );
END;
$$;

COMMENT ON FUNCTION auto_desactiver_artisan_carte_expiree() IS
'Désactive automatiquement les artisans dont la carte professionnelle a expiré';

-- ============================================================================
-- ETAPE 3: Trigger sur mise à jour de carte pour désactivation auto
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_check_carte_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si la carte passe au statut expiré ou si sa date d'expiration est dépassée
  IF (NEW.statut = 'expiree' OR NEW.date_expiration < CURRENT_DATE)
     AND (OLD.statut IS NULL OR OLD.statut != 'expiree') THEN

    -- Vérifier si l'artisan a d'autres cartes valides
    IF NOT EXISTS (
      SELECT 1
      FROM public.snp_cartes_professionnelles
      WHERE artisan_id = NEW.artisan_id
        AND id != NEW.id
        AND statut IN ('validee', 'en_exploitation')
        AND date_expiration >= CURRENT_DATE
    ) THEN
      -- Désactiver l'artisan
      UPDATE public.snp_artisans_miniers
      SET
        actif = false,
        desactive_le = NOW(),
        motif_desactivation = 'Carte professionnelle expirée'
      WHERE id = NEW.artisan_id
        AND actif = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_carte_expiration_desactivation ON public.snp_cartes_professionnelles;
CREATE TRIGGER trigger_carte_expiration_desactivation
  AFTER INSERT OR UPDATE ON public.snp_cartes_professionnelles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_carte_expiration();

-- ============================================================================
-- ETAPE 4: Protection contre suppression si carte existe
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_delete_artisan_with_carte()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier si l'artisan a au moins une carte
  IF EXISTS (
    SELECT 1
    FROM public.snp_cartes_professionnelles
    WHERE artisan_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Impossible de supprimer un artisan ayant une carte professionnelle. Veuillez le désactiver à la place.'
      USING HINT = 'Utilisez la fonction de désactivation avec motif',
            ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_artisan_delete ON public.snp_artisans_miniers;
CREATE TRIGGER trigger_prevent_artisan_delete
  BEFORE DELETE ON public.snp_artisans_miniers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_artisan_with_carte();

-- ============================================================================
-- ETAPE 5: Fonction de validation pour ventes
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_artisan_actif_pour_vente(p_artisan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actif boolean;
  v_carte_valide boolean;
BEGIN
  -- Vérifier si l'artisan est actif
  SELECT actif INTO v_actif
  FROM public.snp_artisans_miniers
  WHERE id = p_artisan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artisan non trouvé' USING ERRCODE = '23503';
  END IF;

  IF NOT v_actif THEN
    RAISE EXCEPTION 'Artisan désactivé - Ventes et paiements bloqués' USING ERRCODE = '23503';
  END IF;

  -- Vérifier si l'artisan a une carte valide
  SELECT EXISTS (
    SELECT 1
    FROM public.snp_cartes_professionnelles
    WHERE artisan_id = p_artisan_id
      AND statut IN ('validee', 'en_exploitation')
      AND date_expiration >= CURRENT_DATE
  ) INTO v_carte_valide;

  IF NOT v_carte_valide THEN
    RAISE EXCEPTION 'Aucune carte professionnelle valide - Ventes bloquées' USING ERRCODE = '23503';
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION validate_artisan_actif_pour_vente(uuid) IS
'Valide qu''un artisan est actif et possède une carte valide avant une vente';

-- ============================================================================
-- ETAPE 6: Index pour performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_artisans_actif
ON public.snp_artisans_miniers USING btree (actif);

CREATE INDEX IF NOT EXISTS idx_artisans_desactive_par
ON public.snp_artisans_miniers USING btree (desactive_par);

CREATE INDEX IF NOT EXISTS idx_cartes_expiration_active
ON public.snp_cartes_professionnelles USING btree (date_expiration, statut)
WHERE statut IN ('validee', 'en_exploitation');

-- ============================================================================
-- ETAPE 7: Commentaires
-- ============================================================================

COMMENT ON COLUMN public.snp_artisans_miniers.actif IS
'Indique si l''artisan est actif (peut vendre et être payé)';

COMMENT ON COLUMN public.snp_artisans_miniers.desactive_le IS
'Date et heure de désactivation';

COMMENT ON COLUMN public.snp_artisans_miniers.desactive_par IS
'Utilisateur ayant désactivé l''artisan';

COMMENT ON COLUMN public.snp_artisans_miniers.motif_desactivation IS
'Raison de la désactivation (ex: Carte expirée, Fraude détectée, etc.)';

-- ============================================================================
-- ETAPE 8: Données initiales - Activer tous les artisans existants
-- ============================================================================

UPDATE public.snp_artisans_miniers
SET actif = true
WHERE actif IS NULL;

-- ============================================================================
-- Message final
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration système de désactivation terminée!';
  RAISE NOTICE '- Colonnes ajoutées: actif, desactive_le, desactive_par, motif_desactivation';
  RAISE NOTICE '- Trigger de désactivation automatique créé';
  RAISE NOTICE '- Protection contre suppression activée';
  RAISE NOTICE '- Fonction de validation pour ventes créée';
END $$;
