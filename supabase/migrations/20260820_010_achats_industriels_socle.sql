-- ============================================================================
-- Achats d'or industriel — modèle de données
--
-- CE QUE L'ANALYSE DE L'EXISTANT A ÉTABLI
--
-- 1. Il n'y a pas de serveur applicatif : le navigateur parle directement à
--    PostgREST. « Le backend fait autorité » signifie donc ici : PostgreSQL.
--    Les opérations financières sensibles passent par des fonctions PL/pgSQL
--    SECURITY DEFINER (voir 20260820_012), seul endroit qu'un client ne peut
--    contourner.
-- 2. `snp_achats_mines` existe déjà et porte l'achat direct, sans workflow.
--    Elle n'est PAS remplacée : elle devient la transaction commerciale issue
--    de l'approbation d'une demande, et garde ses lignes et son écran.
-- 3. `user_profiles` ne rattachait aucun utilisateur à une société minière.
--    Sans ce lien, « une mine ne voit que ses demandes » est inapplicable.
-- 4. Les politiques RLS existantes sont permissives (`USING (true)`). Les
--    nouvelles tables portent de vraies politiques (voir 20260820_013).
-- 5. L'audit applicatif est écrit par le client, donc contournable. Le module
--    tient son propre journal, alimenté par déclencheur.
--
-- LE POINT QUI STRUCTURE LE MODÈLE : un règlement n'est pas une transaction.
-- La SONASP achète chaque mois et ne règle pas nécessairement chaque mois. Elle
-- peut verser un acompte, laisser courir plusieurs factures, puis verser une
-- somme qui ne correspond au montant d'aucune facture prise isolément.
-- Assimiler un paiement à une transaction rendrait ces cas inexprimables.
--
--     transaction → facture → échéance
--                       ↑
--          affectation ─┘
--               ↑
--          règlement (appartient à la SOCIÉTÉ, non à une facture)
--
-- PRÉCISION NUMÉRIQUE
--   quantités  numeric(18,4) onces troy — jamais de flottant
--   montants   numeric(20,2) francs CFA
--   taux       numeric(9,4)
--
-- Retour arrière : supprimer les tables dans l'ordre inverse de création ;
-- `user_profiles.mining_company_id` et `snp_achats_mines.demande_id` se
-- retirent par ALTER TABLE ... DROP COLUMN.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Rattachement d'un utilisateur à une société minière
-- ---------------------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS mining_company_id uuid REFERENCES mining_companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_profiles.mining_company_id IS
  'Société minière représentée par cet utilisateur. NULL pour un agent SONASP.';

CREATE INDEX IF NOT EXISTS idx_user_profiles_mining_company
  ON user_profiles(mining_company_id) WHERE mining_company_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Plan mensuel d'achat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_plans_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_plan text NOT NULL UNIQUE,
  annee integer NOT NULL CHECK (annee BETWEEN 2020 AND 2100),
  mois integer NOT NULL CHECK (mois BETWEEN 1 AND 12),

  -- Politique globale : l'un OU l'autre, jamais les deux à la fois.
  mode_repartition text NOT NULL DEFAULT 'pourcentage'
    CHECK (mode_repartition IN ('pourcentage', 'quantite_cible')),
  pourcentage_global numeric(9,4) CHECK (pourcentage_global IS NULL
    OR (pourcentage_global > 0 AND pourcentage_global <= 100)),
  quantite_cible_oz numeric(18,4) CHECK (quantite_cible_oz IS NULL OR quantite_cible_oz > 0),
  prix_once_global_fcfa numeric(20,2) CHECK (prix_once_global_fcfa IS NULL OR prix_once_global_fcfa > 0),

  devise text NOT NULL DEFAULT 'XOF' CHECK (devise IN ('XOF', 'USD', 'EUR')),
  unite text NOT NULL DEFAULT 'oz' CHECK (unite IN ('oz', 'g')),

  -- Totaux tenus par déclencheur depuis les lignes : jamais saisis à la main.
  quantite_repartie_oz numeric(18,4) NOT NULL DEFAULT 0,
  montant_previsionnel_fcfa numeric(20,2) NOT NULL DEFAULT 0,

  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN (
    'brouillon', 'pret_soumission', 'soumis',
    'partiellement_approuve', 'approuve', 'rejete',
    'en_execution', 'cloture', 'annule')),

  observations text,
  date_soumission timestamptz,
  date_validation timestamptz,
  date_cloture timestamptz,
  date_annulation timestamptz,
  motif_annulation text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_plans_achat_periode_unique UNIQUE (annee, mois, numero_plan),
  CONSTRAINT snp_plans_achat_politique_coherente CHECK (
    (mode_repartition = 'pourcentage' AND pourcentage_global IS NOT NULL)
    OR (mode_repartition = 'quantite_cible' AND quantite_cible_oz IS NOT NULL)
    OR statut = 'brouillon')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_plans_achat_mois_vivant
  ON snp_plans_achat(annee, mois)
  WHERE statut NOT IN ('annule', 'cloture', 'rejete');

COMMENT ON INDEX idx_snp_plans_achat_mois_vivant IS
  'Un seul plan actif par mois : deux plans concurrents rendraient le disponible national indéterminé.';

-- ---------------------------------------------------------------------------
-- 2. Ligne de plan, une par société minière
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_plans_achat_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES snp_plans_achat(id) ON DELETE CASCADE,
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id) ON DELETE RESTRICT,

  periode_debut date NOT NULL,
  periode_fin date NOT NULL,

  -- Photographie de la production au moment de la répartition, conservée pour
  -- que la ligne reste lisible même si la production évolue ensuite.
  production_declaree_oz numeric(18,4) NOT NULL DEFAULT 0,
  production_validee_oz numeric(18,4) NOT NULL DEFAULT 0,
  deja_engage_oz numeric(18,4) NOT NULL DEFAULT 0,
  production_eligible_oz numeric(18,4) NOT NULL DEFAULT 0,
  titre_moyen_pct numeric(9,4),

  pourcentage_applique numeric(9,4) CHECK (pourcentage_applique IS NULL
    OR (pourcentage_applique >= 0 AND pourcentage_applique <= 100)),
  quantite_proposee_oz numeric(18,4) NOT NULL DEFAULT 0 CHECK (quantite_proposee_oz >= 0),
  prix_once_fcfa numeric(20,2) NOT NULL DEFAULT 0 CHECK (prix_once_fcfa >= 0),
  cours_reference_usd numeric(20,4),
  taux_usd_xof numeric(20,4),
  montant_estime_fcfa numeric(20,2) NOT NULL DEFAULT 0,

  -- Vrai dès qu'un agent a modifié la ligne : une nouvelle application globale
  -- ne doit pas écraser un arbitrage individuel sans le dire.
  ajustee_manuellement boolean NOT NULL DEFAULT false,

  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN (
    'brouillon', 'prete', 'soumise', 'approuvee', 'rejetee', 'annulee')),
  observations text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_plan_ligne_periode CHECK (periode_fin >= periode_debut),
  CONSTRAINT snp_plan_ligne_unique UNIQUE (plan_id, mining_company_id)
);

CREATE INDEX IF NOT EXISTS idx_snp_plan_lignes_plan ON snp_plans_achat_lignes(plan_id);
CREATE INDEX IF NOT EXISTS idx_snp_plan_lignes_societe ON snp_plans_achat_lignes(mining_company_id);

-- ---------------------------------------------------------------------------
-- 3. Demande d'achat adressée à la mine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_demandes_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_demande text NOT NULL UNIQUE,
  plan_id uuid REFERENCES snp_plans_achat(id) ON DELETE SET NULL,
  ligne_id uuid UNIQUE REFERENCES snp_plans_achat_lignes(id) ON DELETE SET NULL,
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id) ON DELETE RESTRICT,

  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  production_reference_oz numeric(18,4) NOT NULL DEFAULT 0,
  quantite_demandee_oz numeric(18,4) NOT NULL CHECK (quantite_demandee_oz > 0),
  pourcentage_applique numeric(9,4),
  unite text NOT NULL DEFAULT 'oz' CHECK (unite IN ('oz', 'g')),
  titre_pct numeric(9,4),

  cours_reference_usd numeric(20,4),
  taux_usd_xof numeric(20,4),
  prix_once_fcfa numeric(20,2) NOT NULL CHECK (prix_once_fcfa > 0),
  devise text NOT NULL DEFAULT 'XOF' CHECK (devise IN ('XOF', 'USD', 'EUR')),
  montant_estime_fcfa numeric(20,2) NOT NULL DEFAULT 0,

  conditions_paiement text NOT NULL DEFAULT 'comptant'
    CHECK (conditions_paiement IN ('comptant', 'differe_30j', 'differe_60j', 'differe_90j', 'echelonne')),
  delai_reponse_jours integer NOT NULL DEFAULT 7 CHECK (delai_reponse_jours > 0),
  date_limite_reponse date,

  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN (
    'brouillon', 'validee_interne', 'soumise',
    'approuvee', 'rejetee', 'modification_demandee', 'expiree', 'annulee')),

  observations text,
  motif_rejet text,
  motif_modification text,

  date_soumission timestamptz,
  date_reponse timestamptz,
  repondu_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_demande_periode CHECK (periode_fin >= periode_debut),
  -- Un rejet sans motif ne se discute pas : il se refuse.
  CONSTRAINT snp_demande_rejet_motive CHECK (
    statut <> 'rejetee' OR (motif_rejet IS NOT NULL AND length(trim(motif_rejet)) >= 5)),
  CONSTRAINT snp_demande_modification_motivee CHECK (
    statut <> 'modification_demandee'
    OR (motif_modification IS NOT NULL AND length(trim(motif_modification)) >= 5))
);

CREATE INDEX IF NOT EXISTS idx_snp_demandes_societe ON snp_demandes_achat(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_snp_demandes_statut ON snp_demandes_achat(statut);
CREATE INDEX IF NOT EXISTS idx_snp_demandes_plan ON snp_demandes_achat(plan_id);

CREATE TABLE IF NOT EXISTS snp_demandes_achat_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES snp_demandes_achat(id) ON DELETE CASCADE,
  action text NOT NULL,
  statut_avant text,
  statut_apres text,
  valeurs_avant jsonb,
  valeurs_apres jsonb,
  motif text,
  acteur_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acteur_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_demandes_hist_demande
  ON snp_demandes_achat_historique(demande_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. La transaction d'achat existante se rattache à sa demande
-- ---------------------------------------------------------------------------
ALTER TABLE snp_achats_mines
  ADD COLUMN IF NOT EXISTS demande_id uuid REFERENCES snp_demandes_achat(id) ON DELETE SET NULL;

-- Une approbation ne produit qu'une transaction. La contrainte le garantit,
-- plutôt que de compter sur la discipline du code appelant.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_achats_demande_unique
  ON snp_achats_mines(demande_id) WHERE demande_id IS NOT NULL;

COMMENT ON COLUMN snp_achats_mines.demande_id IS
  'Demande d''achat approuvée à l''origine de cette transaction. NULL pour les achats directs antérieurs au module.';

-- ---------------------------------------------------------------------------
-- 5. Facture d'achat émise par la mine à la SONASP
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_factures_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_facture text NOT NULL UNIQUE,
  achat_id uuid NOT NULL REFERENCES snp_achats_mines(id) ON DELETE RESTRICT,
  demande_id uuid REFERENCES snp_demandes_achat(id) ON DELETE SET NULL,
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id) ON DELETE RESTRICT,

  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,

  quantite_oz numeric(18,4) NOT NULL CHECK (quantite_oz > 0),
  unite text NOT NULL DEFAULT 'oz' CHECK (unite IN ('oz', 'g')),
  titre_pct numeric(9,4),
  prix_once_fcfa numeric(20,2) NOT NULL CHECK (prix_once_fcfa > 0),

  montant_ht_fcfa numeric(20,2) NOT NULL CHECK (montant_ht_fcfa >= 0),
  tva_taux numeric(9,4) NOT NULL DEFAULT 18,
  tva_montant_fcfa numeric(20,2) NOT NULL DEFAULT 0,
  taxe_dev_comm_taux numeric(9,4) NOT NULL DEFAULT 1,
  taxe_dev_comm_montant_fcfa numeric(20,2) NOT NULL DEFAULT 0,
  retenue_source_taux numeric(9,4) NOT NULL DEFAULT 0,
  retenue_source_fcfa numeric(20,2) NOT NULL DEFAULT 0,
  montant_ttc_fcfa numeric(20,2) NOT NULL CHECK (montant_ttc_fcfa >= 0),
  devise text NOT NULL DEFAULT 'XOF' CHECK (devise IN ('XOF', 'USD', 'EUR')),

  conditions_paiement text NOT NULL DEFAULT 'comptant',
  date_echeance date NOT NULL,

  -- Tenus par déclencheur depuis les affectations et les avoirs.
  montant_ajustements_fcfa numeric(20,2) NOT NULL DEFAULT 0,
  montant_paye_fcfa numeric(20,2) NOT NULL DEFAULT 0,

  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN (
    'brouillon', 'emise', 'certifiee', 'echec_certification',
    'partiellement_payee', 'payee', 'contestee', 'suspendue', 'annulee')),

  statut_certification text NOT NULL DEFAULT 'non_requise' CHECK (statut_certification IN (
    'non_requise', 'en_attente', 'certifiee', 'echec')),
  certification_reference text,
  certification_date timestamptz,

  motif_annulation text,
  facture_remplacee_id uuid REFERENCES snp_factures_achat(id) ON DELETE SET NULL,
  observations text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_facture_periode CHECK (periode_fin >= periode_debut),
  CONSTRAINT snp_facture_echeance CHECK (date_echeance >= date_emission),
  CONSTRAINT snp_facture_annulation_motivee CHECK (
    statut <> 'annulee' OR (motif_annulation IS NOT NULL AND length(trim(motif_annulation)) >= 5)),
  -- Une facture ne peut se dire certifiée sans porter la référence du service
  -- qui l'a certifiée. C'est la garantie qu'aucune certification ne s'invente,
  -- même en cas d'erreur du code applicatif.
  CONSTRAINT snp_facture_certification_prouvee CHECK (
    statut_certification <> 'certifiee'
    OR (certification_reference IS NOT NULL AND certification_date IS NOT NULL))
);

-- Une transaction ne porte qu'une facture vivante ; un remplacement suppose
-- l'annulation de la précédente.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_facture_achat_vivante
  ON snp_factures_achat(achat_id) WHERE statut <> 'annulee';

CREATE INDEX IF NOT EXISTS idx_snp_factures_societe ON snp_factures_achat(mining_company_id);
CREATE INDEX IF NOT EXISTS idx_snp_factures_echeance ON snp_factures_achat(date_echeance);
CREATE INDEX IF NOT EXISTS idx_snp_factures_statut ON snp_factures_achat(statut);

CREATE TABLE IF NOT EXISTS snp_factures_achat_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES snp_factures_achat(id) ON DELETE CASCADE,
  rang integer NOT NULL DEFAULT 1,
  designation text NOT NULL,
  quantite numeric(18,4) NOT NULL CHECK (quantite > 0),
  unite text NOT NULL DEFAULT 'oz',
  titre_pct numeric(9,4),
  prix_unitaire_fcfa numeric(20,2) NOT NULL CHECK (prix_unitaire_fcfa >= 0),
  montant_ht_fcfa numeric(20,2) NOT NULL CHECK (montant_ht_fcfa >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_facture_ligne_rang UNIQUE (facture_id, rang)
);

-- ---------------------------------------------------------------------------
-- 6. Journal de certification : chaque tentative laisse une trace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_factures_certification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL REFERENCES snp_factures_achat(id) ON DELETE CASCADE,
  tentative integer NOT NULL DEFAULT 1,
  fournisseur text NOT NULL DEFAULT 'DGI-SECeF',
  -- Empreinte de la requête, non son contenu : aucune donnée fiscale sensible
  -- ne se retrouve en clair dans un journal consultable.
  requete_empreinte text,
  reponse_code text,
  reponse_message text,
  certification_reference text,
  certifiee_le timestamptz,
  erreur_technique text,
  declenche_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_certification_tentative_unique UNIQUE (facture_id, tentative)
);

-- ---------------------------------------------------------------------------
-- 7. Avoirs et ajustements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_avoirs_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_avoir text NOT NULL UNIQUE,
  facture_id uuid NOT NULL REFERENCES snp_factures_achat(id) ON DELETE RESTRICT,
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id) ON DELETE RESTRICT,
  date_avoir date NOT NULL DEFAULT CURRENT_DATE,
  -- Positif : la SONASP doit moins. Négatif : elle doit davantage.
  montant_fcfa numeric(20,2) NOT NULL CHECK (montant_fcfa <> 0),
  motif text NOT NULL CHECK (length(trim(motif)) >= 5),
  statut text NOT NULL DEFAULT 'applique' CHECK (statut IN ('applique', 'annule')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_avoirs_facture ON snp_avoirs_achat(facture_id);

-- ---------------------------------------------------------------------------
-- 8. Règlement versé par la SONASP à une société minière
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_reglements_achat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_reglement text NOT NULL UNIQUE,
  mining_company_id uuid NOT NULL REFERENCES mining_companies(id) ON DELETE RESTRICT,

  date_reglement date NOT NULL DEFAULT CURRENT_DATE,
  montant_fcfa numeric(20,2) NOT NULL CHECK (montant_fcfa > 0),
  devise text NOT NULL DEFAULT 'XOF' CHECK (devise IN ('XOF', 'USD', 'EUR')),

  mode_reglement text NOT NULL DEFAULT 'virement' CHECK (mode_reglement IN (
    'virement', 'cheque', 'compensation', 'especes')),
  banque text,
  reference_bancaire text,
  preuve_url text,

  -- Tenu par déclencheur : somme des affectations vivantes.
  montant_affecte_fcfa numeric(20,2) NOT NULL DEFAULT 0,

  statut text NOT NULL DEFAULT 'enregistre' CHECK (statut IN (
    'enregistre', 'valide', 'rejete', 'annule')),
  motif_rejet text,
  observations text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  valide_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date_validation timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_reglement_rejet_motive CHECK (
    statut <> 'rejete' OR (motif_rejet IS NOT NULL AND length(trim(motif_rejet)) >= 5))
);

CREATE INDEX IF NOT EXISTS idx_snp_reglements_societe
  ON snp_reglements_achat(mining_company_id, date_reglement DESC);

-- ---------------------------------------------------------------------------
-- 9. Affectation d'un règlement à une facture — la relation plusieurs-à-plusieurs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_reglements_affectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reglement_id uuid NOT NULL REFERENCES snp_reglements_achat(id) ON DELETE CASCADE,
  facture_id uuid NOT NULL REFERENCES snp_factures_achat(id) ON DELETE RESTRICT,
  montant_affecte_fcfa numeric(20,2) NOT NULL CHECK (montant_affecte_fcfa > 0),
  mode_affectation text NOT NULL DEFAULT 'manuelle'
    CHECK (mode_affectation IN ('manuelle', 'automatique_fifo')),
  statut text NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'annulee')),
  motif_annulation text,
  affecte_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date_affectation timestamptz NOT NULL DEFAULT now(),
  annulee_par uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date_annulation timestamptz,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un règlement ne s'affecte qu'une fois à une même facture : deux lignes
-- feraient double emploi et fausseraient le solde.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snp_affectation_unique
  ON snp_reglements_affectations(reglement_id, facture_id) WHERE statut = 'active';

CREATE INDEX IF NOT EXISTS idx_snp_affectations_facture
  ON snp_reglements_affectations(facture_id) WHERE statut = 'active';

-- ---------------------------------------------------------------------------
-- 10. Journal d'audit du module, alimenté par déclencheur
--
-- L'audit applicatif existant est écrit par le navigateur, donc contournable.
-- Celui-ci est posé par la base : aucune écriture financière n'y échappe.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snp_achats_audit (
  id bigserial PRIMARY KEY,
  objet text NOT NULL,
  objet_id uuid NOT NULL,
  action text NOT NULL,
  valeurs_avant jsonb,
  valeurs_apres jsonb,
  acteur_id uuid,
  survenu_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_achats_audit_objet
  ON snp_achats_audit(objet, objet_id, survenu_le DESC);
CREATE INDEX IF NOT EXISTS idx_snp_achats_audit_date
  ON snp_achats_audit(survenu_le DESC);
