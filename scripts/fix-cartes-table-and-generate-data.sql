/*
  # Correction Table Cartes Professionnelles + Génération Données

  ✅ Script vérifié selon SQL-QUALITY-CHECKLIST.md

  ## Structure de la table snp_cartes_professionnelles (vérifiée 27/12/2024)

  ### Colonnes EXISTANTES (ne pas recréer):
  - id: uuid (PK, DEFAULT gen_random_uuid())
  - artisan_id: uuid (NOT NULL, FK → snp_artisans_miniers)
  - numero_carte: text (NOT NULL, UNIQUE)
  - date_emission: date (NOT NULL, DEFAULT CURRENT_DATE)
  - date_expiration: date (NOT NULL, DEFAULT CURRENT_DATE + 2 years)
  - date_validation: date (nullable)
  - date_suspension: date (nullable)
  - statut: text (NOT NULL, DEFAULT 'en_cours')
  - qr_code_data: text (nullable) ← TYPE TEXT (pas JSONB!)
  - numero_securite: text (DEFAULT fonction)
  - validee_par: uuid (nullable, FK → auth.users)
  - motif_suspension: text (nullable)
  - observations: text (nullable)
  - created_at: timestamptz (DEFAULT now())
  - updated_at: timestamptz (DEFAULT now())

  ### Colonnes à AJOUTER:
  - suspendue_par: uuid (nullable, FK → auth.users)
  - qr_code_url: text (nullable)
  - carte_recto_url: text (nullable)
  - carte_verso_url: text (nullable)

  ### Contraintes:
  - CHECK: statut IN ('en_cours', 'validee', 'en_exploitation', 'expiree', 'suspendue', 'annulee')

  ## Modifications apportées:
  1. Ajout de 4 colonnes manquantes
  2. Vérification/correction de la contrainte statut
  3. Génération de 20 cartes de test avec distribution variée
  4. Création d'activités et statistiques pour cartes en exploitation
*/

-- ============================================================================
-- PARTIE 1: AJOUTER COLONNES MANQUANTES
-- ============================================================================

-- Ajouter colonne suspendue_par (pour tracer qui a suspendu la carte)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snp_cartes_professionnelles'
    AND column_name = 'suspendue_par'
  ) THEN
    ALTER TABLE snp_cartes_professionnelles
    ADD COLUMN suspendue_par uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Colonne suspendue_par ajoutée';
  ELSE
    RAISE NOTICE 'Colonne suspendue_par existe déjà';
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
    RAISE NOTICE 'Colonne qr_code_url ajoutée';
  ELSE
    RAISE NOTICE 'Colonne qr_code_url existe déjà';
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
    RAISE NOTICE 'Colonne carte_recto_url ajoutée';
  ELSE
    RAISE NOTICE 'Colonne carte_recto_url existe déjà';
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
    RAISE NOTICE 'Colonne carte_verso_url ajoutée';
  ELSE
    RAISE NOTICE 'Colonne carte_verso_url existe déjà';
  END IF;
END $$;

-- ============================================================================
-- PARTIE 2: VÉRIFIER/CORRIGER LES STATUTS
-- ============================================================================

-- S'assurer que la contrainte CHECK utilise les bons statuts
DO $$
BEGIN
  -- Supprimer les anciennes contraintes
  ALTER TABLE snp_cartes_professionnelles
  DROP CONSTRAINT IF EXISTS "SNP_cartes_professionnelles_statut_check";

  ALTER TABLE snp_cartes_professionnelles
  DROP CONSTRAINT IF EXISTS snp_cartes_professionnelles_statut_check;

  -- Ajouter la bonne contrainte
  ALTER TABLE snp_cartes_professionnelles
  ADD CONSTRAINT snp_cartes_professionnelles_statut_check
  CHECK (statut IN ('en_cours', 'validee', 'en_exploitation', 'expiree', 'suspendue', 'annulee'));

  RAISE NOTICE 'Contrainte statut mise à jour';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Contrainte statut existe déjà';
END $$;

-- Mettre à jour les anciennes valeurs vers les nouvelles
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

-- Supprimer les données existantes pour repartir à zéro
DELETE FROM snp_artisan_activities;
DELETE FROM snp_carte_statistics;
DELETE FROM snp_cartes_professionnelles;

DO $$
BEGIN
  RAISE NOTICE 'Données existantes supprimées';
END $$;

-- Créer les cartes professionnelles avec des statuts diversifiés
DO $$
DECLARE
  v_artisan RECORD;
  v_count INTEGER := 0;
  v_statut TEXT;
  v_date_emission DATE;
  v_date_expiration DATE;
  v_date_validation DATE;
  v_date_suspension DATE;
  v_numero_securite TEXT;
  v_user_id uuid;
  v_qr_code TEXT;
BEGIN
  -- Récupérer un utilisateur pour les champs validee_par et suspendue_par
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Aucun utilisateur trouvé, les champs validee_par/suspendue_par seront NULL';
  END IF;

  -- Parcourir tous les artisans
  FOR v_artisan IN
    SELECT id, numero_carte FROM snp_artisans_miniers ORDER BY created_at LIMIT 20
  LOOP
    v_count := v_count + 1;

    -- Générer numéro de sécurité
    v_numero_securite := LPAD(FLOOR(RANDOM() * 9999999999)::TEXT, 10, '0');

    -- Générer QR code data (format texte simple)
    v_qr_code := 'CARTE:' || v_artisan.numero_carte || '|ARTISAN:' || v_artisan.id || '|SEC:' || v_numero_securite;

    -- Réinitialiser les dates
    v_date_validation := NULL;
    v_date_suspension := NULL;

    -- Définir le statut selon la distribution souhaitée
    IF v_count <= 3 THEN
      -- 3 premières: en_cours (en attente de validation)
      v_statut := 'en_cours';
      v_date_emission := CURRENT_DATE - INTERVAL '5 days';
      v_date_expiration := CURRENT_DATE + INTERVAL '2 years';

    ELSIF v_count <= 8 THEN
      -- 5 suivantes: validee (validées mais pas encore en exploitation)
      v_statut := 'validee';
      v_date_emission := CURRENT_DATE - INTERVAL '30 days';
      v_date_expiration := CURRENT_DATE + INTERVAL '23 months';
      v_date_validation := CURRENT_DATE - INTERVAL '29 days';

    ELSIF v_count <= 16 THEN
      -- 8 suivantes: en_exploitation (cartes actives)
      v_statut := 'en_exploitation';
      v_date_emission := CURRENT_DATE - INTERVAL '6 months';
      v_date_validation := CURRENT_DATE - INTERVAL '5 months' - INTERVAL '25 days';

      -- Distribuer les dates d'expiration pour créer des alertes
      CASE
        WHEN v_count = 9 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '5 days';  -- Expire dans 5 jours
        WHEN v_count = 10 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '15 days'; -- Expire dans 15 jours
        WHEN v_count = 11 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '25 days'; -- Expire dans 25 jours
        WHEN v_count = 12 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '45 days'; -- Expire dans 45 jours
        WHEN v_count = 13 THEN
          v_date_expiration := CURRENT_DATE + INTERVAL '55 days'; -- Expire dans 55 jours
        ELSE
          v_date_expiration := CURRENT_DATE + INTERVAL '18 months'; -- Encore loin
      END CASE;

    ELSIF v_count <= 18 THEN
      -- 2 suivantes: expiree
      v_statut := 'expiree';
      v_date_emission := CURRENT_DATE - INTERVAL '2 years' - INTERVAL '60 days';
      v_date_expiration := CURRENT_DATE - INTERVAL '30 days';
      v_date_validation := CURRENT_DATE - INTERVAL '2 years' - INTERVAL '55 days';

    ELSE
      -- 2 dernières: suspendue
      v_statut := 'suspendue';
      v_date_emission := CURRENT_DATE - INTERVAL '3 months';
      v_date_expiration := CURRENT_DATE + INTERVAL '21 months';
      v_date_validation := CURRENT_DATE - INTERVAL '2 months' - INTERVAL '25 days';
      v_date_suspension := CURRENT_DATE - INTERVAL '10 days';
    END IF;

    -- Insérer la carte avec les VRAIS noms de colonnes
    INSERT INTO snp_cartes_professionnelles (
      artisan_id,
      numero_carte,
      statut,
      date_emission,         -- Utilise date_emission (pas date_delivrance)
      date_expiration,
      date_validation,       -- Utilise date_validation (pas validee_le)
      date_suspension,       -- Utilise date_suspension (pas suspendue_le)
      numero_securite,
      qr_code_data,         -- Utilise TEXT (pas JSONB)
      validee_par,
      suspendue_par,
      motif_suspension,
      observations
    ) VALUES (
      v_artisan.id,
      v_artisan.numero_carte,
      v_statut,
      v_date_emission,
      v_date_expiration,
      v_date_validation,
      v_date_suspension,
      v_numero_securite,
      v_qr_code,           -- Texte simple pour QR code
      CASE
        WHEN v_statut IN ('validee', 'en_exploitation') THEN v_user_id
        ELSE NULL
      END,
      CASE
        WHEN v_statut = 'suspendue' THEN v_user_id
        ELSE NULL
      END,
      CASE
        WHEN v_statut = 'suspendue' THEN 'Non-conformité administrative - Vérification en cours'
        ELSE NULL
      END,
      CASE
        WHEN v_statut = 'en_cours' THEN 'En attente de validation par le service compétent'
        WHEN v_statut = 'suspendue' THEN 'Carte suspendue temporairement pour vérification'
        ELSE NULL
      END
    );

  END LOOP;

  RAISE NOTICE 'Création de % cartes professionnelles avec statuts diversifiés', v_count;
END $$;

-- Créer quelques activités pour les artisans en exploitation
-- ✅ Colonnes vérifiées dans le DDL de snp_artisan_activities
INSERT INTO snp_artisan_activities (
  artisan_id,
  carte_id,
  type_activite,
  description,
  montant,
  quantite_grammes,
  created_at
)
SELECT
  c.artisan_id,
  c.id,
  CASE
    WHEN random() < 0.4 THEN 'vente'
    WHEN random() < 0.7 THEN 'production'
    ELSE 'achat'
  END,
  CASE
    WHEN random() < 0.4 THEN 'Vente d''or aurifère au comptoir SONASP'
    WHEN random() < 0.7 THEN 'Production mensuelle d''or'
    ELSE 'Achat d''or auprès des orpailleurs'
  END,
  (500000 + random() * 5000000)::NUMERIC(15,2),
  (50 + random() * 500)::NUMERIC(10,3),
  CURRENT_DATE - (random() * 90)::INTEGER * INTERVAL '1 day'
FROM snp_cartes_professionnelles c
WHERE c.statut = 'en_exploitation'
  AND random() < 0.6
LIMIT 30;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM snp_artisan_activities;
  RAISE NOTICE '% activités créées', v_count;
END $$;

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

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM snp_carte_statistics;
  RAISE NOTICE '% statistiques créées', v_count;
END $$;

-- Afficher le résumé final
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

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '=== RÉSUMÉ DES CARTES CRÉÉES ===';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total cartes: %', v_stats.total;
  RAISE NOTICE '';
  RAISE NOTICE '--- Par Statut ---';
  RAISE NOTICE 'En cours (attente validation): %', v_stats.en_cours;
  RAISE NOTICE 'Validées: %', v_stats.validee;
  RAISE NOTICE 'En exploitation: %', v_stats.en_exploitation;
  RAISE NOTICE 'Expirées: %', v_stats.expiree;
  RAISE NOTICE 'Suspendues: %', v_stats.suspendue;
  RAISE NOTICE '';
  RAISE NOTICE '--- Alertes Expiration ---';
  RAISE NOTICE 'Déjà expirées: %', v_stats.deja_expirees;
  RAISE NOTICE 'Expirant dans 7 jours: %', v_stats.expire_7j;
  RAISE NOTICE 'Expirant dans 30 jours: %', v_stats.expire_30j;
  RAISE NOTICE 'Expirant dans 60 jours: %', v_stats.expire_60j;
  RAISE NOTICE '========================================';
END $$;
