-- ============================================================================
-- SCRIPT SQL: Ajout des Colonnes de Métriques Commerciales
-- Table: SNP_artisans_miniers
-- Date: 2025-01-27
-- ============================================================================
--
-- Ce script ajoute les colonnes nécessaires pour afficher les métriques
-- commerciales dans la liste des artisans miniers (quantité d'or vendu et CA)
--
-- IMPORTANT: Ce script doit être exécuté dans Supabase SQL Editor
--
-- ============================================================================

-- 1. Quantité d'or vendu (en grammes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'SNP_artisans_miniers'
    AND column_name = 'quantite_or_vendu_grammes'
  ) THEN
    ALTER TABLE public."SNP_artisans_miniers"
    ADD COLUMN quantite_or_vendu_grammes numeric(12, 3) DEFAULT 0 NOT NULL;

    COMMENT ON COLUMN public."SNP_artisans_miniers".quantite_or_vendu_grammes
    IS 'Quantité totale d''or vendu par l''artisan (en grammes)';
  END IF;
END $$;

-- 2. Chiffre d'affaires (en FCFA)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'SNP_artisans_miniers'
    AND column_name = 'chiffre_affaires_fcfa'
  ) THEN
    ALTER TABLE public."SNP_artisans_miniers"
    ADD COLUMN chiffre_affaires_fcfa numeric(15, 2) DEFAULT 0 NOT NULL;

    COMMENT ON COLUMN public."SNP_artisans_miniers".chiffre_affaires_fcfa
    IS 'Chiffre d''affaires total généré par l''artisan (en FCFA)';
  END IF;
END $$;

-- 3. Nombre de transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'SNP_artisans_miniers'
    AND column_name = 'nombre_transactions'
  ) THEN
    ALTER TABLE public."SNP_artisans_miniers"
    ADD COLUMN nombre_transactions integer DEFAULT 0 NOT NULL;

    COMMENT ON COLUMN public."SNP_artisans_miniers".nombre_transactions
    IS 'Nombre total de transactions effectuées par l''artisan';
  END IF;
END $$;

-- 4. Date de la dernière transaction
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'SNP_artisans_miniers'
    AND column_name = 'derniere_transaction_date'
  ) THEN
    ALTER TABLE public."SNP_artisans_miniers"
    ADD COLUMN derniere_transaction_date date;

    COMMENT ON COLUMN public."SNP_artisans_miniers".derniere_transaction_date
    IS 'Date de la dernière transaction effectuée par l''artisan';
  END IF;
END $$;

-- ============================================================================
-- Index pour optimiser les requêtes
-- ============================================================================

-- Index sur le chiffre d'affaires
CREATE INDEX IF NOT EXISTS idx_artisans_chiffre_affaires
ON public."SNP_artisans_miniers" USING btree (chiffre_affaires_fcfa DESC);

-- Index sur la date de dernière transaction
CREATE INDEX IF NOT EXISTS idx_artisans_derniere_transaction
ON public."SNP_artisans_miniers" USING btree (derniere_transaction_date DESC NULLS LAST);

-- Index composite pour les filtres combinés
CREATE INDEX IF NOT EXISTS idx_artisans_metrics_combined
ON public."SNP_artisans_miniers" USING btree (pays, region, type_artisan, chiffre_affaires_fcfa DESC);

-- ============================================================================
-- Fonction pour mettre à jour les métriques
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artisan_metrics(
  p_artisan_id uuid,
  p_quantite_grammes numeric,
  p_montant_fcfa numeric
)
RETURNS void AS $$
BEGIN
  UPDATE public."SNP_artisans_miniers"
  SET
    quantite_or_vendu_grammes = quantite_or_vendu_grammes + p_quantite_grammes,
    chiffre_affaires_fcfa = chiffre_affaires_fcfa + p_montant_fcfa,
    nombre_transactions = nombre_transactions + 1,
    derniere_transaction_date = CURRENT_DATE,
    updated_at = now()
  WHERE id = p_artisan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_artisan_metrics IS
'Met à jour les métriques commerciales d''un artisan après une transaction';

-- ============================================================================
-- Données de test (optionnel - à commenter si non souhaité)
-- ============================================================================

-- Mettre à jour quelques artisans avec des données fictives pour tester
UPDATE public."SNP_artisans_miniers"
SET
  quantite_or_vendu_grammes = (random() * 1000)::numeric(12,3),
  chiffre_affaires_fcfa = (random() * 50000000)::numeric(15,2),
  nombre_transactions = (random() * 50)::integer,
  derniere_transaction_date = CURRENT_DATE - (random() * 365)::integer
WHERE id IN (
  SELECT id FROM public."SNP_artisans_miniers" LIMIT 10
);
