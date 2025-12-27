/*
  # Correction Table Cartes Professionnelles + Génération Données

  ## Partie 1: Ajouter colonnes manquantes à snp_cartes_professionnelles
  ## Partie 2: Corriger les statuts
  ## Partie 3: Générer les cartes avec données de test
*/

-- ============================================================================
-- PARTIE 1: AJOUTER COLONNES MANQUANTES
-- ============================================================================

-- Ajouter colonne validee_par
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'validee_par'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN validee_par uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Ajouter colonne validee_le
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'validee_le'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN validee_le timestamptz;
  END IF;
END $$;

-- Ajouter colonne suspendue_par
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'suspendue_par'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN suspendue_par uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Ajouter colonne suspendue_le
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'suspendue_le'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN suspendue_le timestamptz;
  END IF;
END $$;

-- Ajouter colonne motif_suspension
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'motif_suspension'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN motif_suspension text;
  END IF;
END $$;

-- Ajouter colonne numero_securite
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'numero_securite'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN numero_securite text;
  END IF;
END $$;

-- Ajouter colonne qr_code_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'qr_code_data'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN qr_code_data jsonb;
  END IF;
END $$;

-- Ajouter colonne qr_code_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'qr_code_url'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN qr_code_url text;
  END IF;
END $$;

-- Ajouter colonne carte_recto_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'carte_recto_url'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN carte_recto_url text;
  END IF;
END $$;

-- Ajouter colonne carte_verso_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'carte_verso_url'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN carte_verso_url text;
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2: CORRIGER LES STATUTS
-- ============================================================================

-- Modifier la contrainte CHECK pour les nouveaux statuts
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte
  ALTER TABLE snp_cartes_professionnelles
  DROP CONSTRAINT IF EXISTS "SNP_cartes_professionnelles_statut_check";

  ALTER TABLE snp_cartes_professionnelles
  DROP CONSTRAINT IF EXISTS snp_cartes_professionnelles_statut_check;

  -- Ajouter la nouvelle contrainte avec les bons statuts
  ALTER TABLE snp_cartes_professionnelles
  ADD CONSTRAINT snp_cartes_professionnelles_statut_check
  CHECK (statut IN ('en_cours', 'validee', 'en_exploitation', 'expiree', 'suspendue', 'annulee'));
END $$;

-- Mettre à jour les valeurs existantes vers les nouveaux statuts
UPDATE snp_cartes_professionnelles
SET statut = CASE
  WHEN statut = 'actif' THEN 'en_exploitation'
  WHEN statut = 'expiré' THEN 'expiree'
  WHEN statut = 'suspendu' THEN 'suspendue'
  WHEN statut = 'révoqué' THEN 'annulee'
  ELSE statut
END
WHERE statut IN ('actif', 'expiré', 'suspendu', 'révoqué');

-- ============================================================================
-- PARTIE 3: GÉNÉRER LES DONNÉES DE TEST
-- ============================================================================

-- D'abord, supprimer toutes les cartes existantes pour repartir à zéro
DELETE FROM snp_cartes_professionnelles;
DELETE FROM snp_artisan_activities;
DELETE FROM snp_carte_statistics;

-- Créer les cartes professionnelles avec des statuts diversifiés
DO $$
DECLARE
  v_artisan RECORD;
  v_count INTEGER := 0;
  v_statut TEXT;
  v_date_delivrance DATE;
  v_date_expiration DATE;
  v_numero_securite TEXT;
  v_user_id uuid;
BEGIN
  -- Récupérer un utilisateur pour les champs validee_par et suspendue_par
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Parcourir tous les artisans
  FOR v_artisan IN
    SELECT id, numero_carte FROM snp_artisans_miniers ORDER BY created_at
  LOOP
    v_count := v_count + 1;

    -- Générer numéro de sécurité
    v_numero_securite := LPAD(FLOOR(RANDOM() * 9999999999)::TEXT, 10, '0');

    -- Définir le statut selon la distribution souhaitée
    IF v_count <= 3 THEN
      -- 3 premières: en_cours (en attente de validation)
      v_statut := 'en_cours';
      v_date_delivrance := CURRENT_DATE - INTERVAL '5 days';
      v_date_expiration := CURRENT_DATE + INTERVAL '1 year';

    ELSIF v_count <= 8 THEN
      -- 5 suivantes: validee
      v_statut := 'validee';
      v_date_delivrance := CURRENT_DATE - INTERVAL '30 days';
      v_date_expiration := CURRENT_DATE + INTERVAL '11 months';

    ELSIF v_count <= 16 THEN
      -- 8 suivantes: en_exploitation (cartes actives)
      v_statut := 'en_exploitation';
      v_date_delivrance := CURRENT_DATE - INTERVAL '6 months';

      -- Distribuer les dates d'expiration
      CASE
        WHEN v_count = 9 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '5 days';
        WHEN v_count = 10 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '15 days';
        WHEN v_count = 11 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '25 days';
        WHEN v_count = 12 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '45 days';
        WHEN v_count = 13 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '55 days';
        ELSE
          v_date_expiration := CURRENT_DATE + INTERVAL '6 months';
      END CASE;

    ELSIF v_count <= 18 THEN
      -- 2 suivantes: expiree
      v_statut := 'expiree';
      v_date_delivrance := CURRENT_DATE - INTERVAL '2 years';
      v_date_expiration := CURRENT_DATE - INTERVAL '30 days';

    ELSE
      -- 2 dernières: suspendue
      v_statut := 'suspendue';
      v_date_delivrance := CURRENT_DATE - INTERVAL '3 months';
      v_date_expiration := CURRENT_DATE + INTERVAL '9 months';
    END IF;

    -- Insérer la carte
    INSERT INTO snp_cartes_professionnelles (
      artisan_id,
      numero_carte,
      statut,
      date_delivrance,
      date_expiration,
      numero_securite,
      qr_code_data,
      validee_par,
      validee_le,
      suspendue_par,
      suspendue_le,
      motif_suspension
    ) VALUES (
      v_artisan.id,
      v_artisan.numero_carte,
      v_statut,
      v_date_delivrance,
      v_date_expiration,
      v_numero_securite,
      jsonb_build_object(
        'numero_carte', v_artisan.numero_carte,
        'artisan_id', v_artisan.id,
        'numero_securite', v_numero_securite
      ),
      CASE
        WHEN v_statut IN ('validee', 'en_exploitation') THEN v_user_id
        ELSE NULL
      END,
      CASE
        WHEN v_statut IN ('validee', 'en_exploitation') THEN v_date_delivrance + INTERVAL '1 day'
        ELSE NULL
      END,
      CASE
        WHEN v_statut = 'suspendue' THEN v_user_id
        ELSE NULL
      END,
      CASE
        WHEN v_statut = 'suspendue' THEN CURRENT_DATE - INTERVAL '10 days'
        ELSE NULL
      END,
      CASE
        WHEN v_statut = 'suspendue' THEN 'Non-conformité administrative - Vérification en cours'
        ELSE NULL
      END
    );

  END LOOP;

  RAISE NOTICE 'Création de % cartes professionnelles avec statuts diversifiés', v_count;
END $$;

-- Créer quelques activités pour les artisans en exploitation
INSERT INTO snp_artisan_activities (
  artisan_id,
  carte_id,
  type_activite,
  description,
  montant,
  quantite_grammes,
  quantite_onces,
  site,
  created_at
)
SELECT
  c.artisan_id,
  c.id,
  CASE
    WHEN random() < 0.4 THEN 'vente'
    WHEN random() < 0.7 THEN 'collecte'
    ELSE 'depot'
  END,
  CASE
    WHEN random() < 0.4 THEN 'Vente d''or aurifère au comptoir SONASP'
    WHEN random() < 0.7 THEN 'Collecte auprès des orpailleurs'
    ELSE 'Dépôt de production mensuelle'
  END,
  (500000 + random() * 5000000)::NUMERIC(15,2),
  (50 + random() * 500)::NUMERIC(10,3),
  ((50 + random() * 500) * 0.03215)::NUMERIC(10,4),
  'Ouagadougou',
  CURRENT_DATE - (random() * 90)::INTEGER * INTERVAL '1 day'
FROM snp_cartes_professionnelles c
WHERE c.statut = 'en_exploitation'
  AND random() < 0.6
LIMIT 30;

-- Créer des statistiques mensuelles pour les cartes en exploitation
INSERT INTO snp_carte_statistics (
  carte_id,
  artisan_id,
  annee,
  mois,
  nombre_ventes,
  montant_total_ventes,
  quantite_totale_grammes,
  quantite_totale_onces,
  nombre_collectes,
  nombre_depots,
  nombre_transactions,
  jours_actifs,
  derniere_activite
)
SELECT
  c.id,
  c.artisan_id,
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  m.mois,
  (1 + random() * 5)::INTEGER,
  ((200000 + random() * 3000000))::NUMERIC(15,2),
  ((100 + random() * 800))::NUMERIC(10,3),
  ((100 + random() * 800) * 0.03215)::NUMERIC(10,4),
  (0 + random() * 3)::INTEGER,
  (0 + random() * 2)::INTEGER,
  (2 + random() * 10)::INTEGER,
  (5 + random() * 20)::INTEGER,
  CURRENT_DATE - (random() * 30)::INTEGER * INTERVAL '1 day'
FROM snp_cartes_professionnelles c
CROSS JOIN (
  SELECT generate_series(1, EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER) AS mois
) m
WHERE c.statut = 'en_exploitation'
  AND random() < 0.7;

-- Afficher le résumé
DO $$
DECLARE
  v_stats RECORD;
BEGIN
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE statut = 'en_cours') as en_cours,
    COUNT(*) FILTER (WHERE statut = 'validee') as validee,
    COUNT(*) FILTER (WHERE statut = 'en_exploitation') as en_exploitation,
    COUNT(*) FILTER (WHERE statut = 'expiree') as expiree,
    COUNT(*) FILTER (WHERE statut = 'suspendue') as suspendue,
    COUNT(*) FILTER (WHERE date_expiration < CURRENT_DATE) as deja_expirees,
    COUNT(*) FILTER (WHERE date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as expire_7j,
    COUNT(*) FILTER (WHERE date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as expire_30j,
    COUNT(*) FILTER (WHERE date_expiration BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days') as expire_60j
  INTO v_stats
  FROM snp_cartes_professionnelles;

  RAISE NOTICE '=== RÉSUMÉ DES CARTES CRÉÉES ===';
  RAISE NOTICE 'Total: %', v_stats.total;
  RAISE NOTICE 'En cours: %', v_stats.en_cours;
  RAISE NOTICE 'Validées: %', v_stats.validee;
  RAISE NOTICE 'En exploitation: %', v_stats.en_exploitation;
  RAISE NOTICE 'Expirées: %', v_stats.expiree;
  RAISE NOTICE 'Suspendues: %', v_stats.suspendue;
  RAISE NOTICE '---';
  RAISE NOTICE 'Déjà expirées: %', v_stats.deja_expirees;
  RAISE NOTICE 'Expirant dans 7 jours: %', v_stats.expire_7j;
  RAISE NOTICE 'Expirant dans 30 jours: %', v_stats.expire_30j;
  RAISE NOTICE 'Expirant dans 60 jours: %', v_stats.expire_60j;
END $$;
