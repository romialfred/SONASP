-- ---------------------------------------------------------------------------
-- Contrats de fourniture d'or : fondations
--
-- ══ CE QUE L'AUDIT A ÉTABLI ══
--
-- `customer_contracts` existe déjà, mais côté vente : elle lie la SONASP à ses
-- clients acheteurs. Rien ne couvre l'amont, c'est-à-dire l'engagement d'un
-- fournisseur à livrer de l'or. Ce module le crée.
--
-- ══ DÉCISIONS D'ARCHITECTURE ══
--
-- D1. Partenaire typé, non dupliqué. Trois référentiels de fournisseurs
--     coexistent — `mining_companies`, `snp_artisans_miniers`, `sites` — et
--     aucun ne les réunit. Créer une table de partenaires les dupliquerait et
--     les ferait diverger. Le contrat porte donc un type et exactement une clé
--     étrangère, contrainte par `snp_contrat_partenaire_unique`.
--
-- D2. Aucun total d'exécution stocké. Quantités livrées, facturées, payées et
--     réquisitionnées se calculent depuis leurs tables d'origine par
--     `snp_contrat_execution()`. Un total stocké diverge le jour où une écriture
--     passe à côté du déclencheur ; un total calculé ne le peut pas.
--
-- D3. Quatorze statuts, non dix-sept. « En préparation » ne se distingue pas de
--     « Brouillon », « En attente de signature » est exactement « Approuvé »
--     avant signature, et « Renouvelé » est un lien (`contrat_precedent_id`)
--     porté par un contrat clôturé, non un état.
--
-- D4. Les règles de teneur et de prix vivent sur le contrat, pas dans un moteur
--     de règles séparé : juridiquement, c'est le contrat qui les porte, et deux
--     contrats du même mois peuvent poser des tolérances différentes.
--
-- D5. Un avenant est un contrat rattaché à son parent, non une table à part. Il
--     hérite du partenaire et ne modifie que ce qu'il déclare.
-- ---------------------------------------------------------------------------

/* ═══════════════════════════════════════════════════════════ Référentiels ══ */

CREATE TABLE IF NOT EXISTS snp_contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrat text NOT NULL UNIQUE,
  intitule text NOT NULL,

  -- D1 : le partenaire est typé, et une seule clé le désigne.
  partenaire_type text NOT NULL,
  mining_company_id uuid REFERENCES mining_companies(id) ON DELETE RESTRICT,
  artisan_id uuid REFERENCES snp_artisans_miniers(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES sites(id) ON DELETE RESTRICT,
  partenaire_libelle text,
  representant_partenaire text,
  representant_contact text,

  -- D5 : avenant et renouvellement sont des liens, non des états.
  type_contrat text NOT NULL DEFAULT 'quantite_periodique',
  contrat_parent_id uuid REFERENCES snp_contrats(id) ON DELETE RESTRICT,
  contrat_precedent_id uuid REFERENCES snp_contrats(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1,

  direction_responsable text,
  gestionnaire_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,

  date_signature date,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  reconduction text NOT NULL DEFAULT 'aucune',
  preavis_reconduction_jours integer,

  /* ---------------------------------------------- Engagements quantitatifs */
  unite text NOT NULL DEFAULT 'oz',
  quantite_totale numeric(18, 4),
  quantite_minimale numeric(18, 4),
  quantite_maximale numeric(18, 4),
  periodicite text NOT NULL DEFAULT 'mensuelle',
  tolerance_quantite_pct numeric(6, 3) NOT NULL DEFAULT 0,
  report_reliquat text NOT NULL DEFAULT 'autorise',
  plafond_depassement_pct numeric(6, 3) NOT NULL DEFAULT 0,
  livraison_anticipee_autorisee boolean NOT NULL DEFAULT true,

  /* --------------------------------------------------- Qualité et teneur -- */
  teneur_reference_pct numeric(6, 3),
  teneur_minimale_pct numeric(6, 3),
  teneur_tolerance_pct numeric(6, 3) NOT NULL DEFAULT 0.5,
  methode_echantillonnage text,
  methode_analyse text,
  laboratoire_initial text,
  laboratoire_independant text,
  delai_contestation_jours integer NOT NULL DEFAULT 5,
  frais_contre_expertise text NOT NULL DEFAULT 'partie_perdante',
  teneur_faisant_foi text NOT NULL DEFAULT 'analyse_sonasp',

  /* --------------------------------------------------------------- Prix -- */
  methode_prix text NOT NULL DEFAULT 'cours_marche',
  source_cours text,
  devise_cours text NOT NULL DEFAULT 'USD',
  devise_reglement text NOT NULL DEFAULT 'XOF',
  prix_fixe_fcfa numeric(18, 2),
  prime_pct numeric(8, 4) NOT NULL DEFAULT 0,
  decote_pct numeric(8, 4) NOT NULL DEFAULT 0,
  formule_prix text,
  prix_ajuste_sur_teneur boolean NOT NULL DEFAULT true,

  /* ------------------------------------------------ Conditions et clauses */
  conditions_livraison text,
  conditions_enlevement text,
  modalites_pesee text,
  transfert_propriete text,
  conditions_paiement text NOT NULL DEFAULT 'differe_30j',
  delai_paiement_jours integer NOT NULL DEFAULT 30,
  penalites text,
  force_majeure text,
  reglement_differends text,
  confidentialite text,
  obligations_fournisseur text,
  obligations_sonasp text,

  statut text NOT NULL DEFAULT 'brouillon',
  motif_statut text,
  observations text,

  date_soumission timestamptz,
  date_approbation timestamptz,
  approuve_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  date_activation timestamptz,
  date_cloture timestamptz,

  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_contrat_partenaire_type CHECK (partenaire_type IN
    ('mine_industrielle', 'mine_semi_mecanisee', 'site_artisanal', 'artisan')),

  -- D1 : exactement une clé de partenaire, cohérente avec le type déclaré.
  CONSTRAINT snp_contrat_partenaire_unique CHECK (
    (CASE WHEN mining_company_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN artisan_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN site_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  CONSTRAINT snp_contrat_partenaire_coherent CHECK (
    (partenaire_type IN ('mine_industrielle', 'mine_semi_mecanisee') AND mining_company_id IS NOT NULL)
    OR (partenaire_type = 'artisan' AND artisan_id IS NOT NULL)
    OR (partenaire_type = 'site_artisanal' AND site_id IS NOT NULL)
  ),

  CONSTRAINT snp_contrat_type CHECK (type_contrat IN
    ('cadre', 'quantite_fixe', 'quantite_periodique', 'execution_progressive', 'avenant')),
  CONSTRAINT snp_contrat_avenant_rattache CHECK (
    type_contrat <> 'avenant' OR contrat_parent_id IS NOT NULL
  ),
  CONSTRAINT snp_contrat_periode CHECK (date_fin >= date_debut),
  CONSTRAINT snp_contrat_unite CHECK (unite IN ('oz', 'g', 'kg')),
  CONSTRAINT snp_contrat_periodicite CHECK (periodicite IN
    ('unique', 'hebdomadaire', 'mensuelle', 'trimestrielle', 'personnalisee')),
  CONSTRAINT snp_contrat_reconduction CHECK (reconduction IN
    ('aucune', 'tacite', 'expresse')),
  CONSTRAINT snp_contrat_report CHECK (report_reliquat IN ('autorise', 'interdit', 'sur_accord')),
  CONSTRAINT snp_contrat_frais CHECK (frais_contre_expertise IN
    ('sonasp', 'fournisseur', 'partage', 'partie_perdante')),
  CONSTRAINT snp_contrat_foi CHECK (teneur_faisant_foi IN
    ('analyse_sonasp', 'analyse_fournisseur', 'laboratoire_independant', 'moyenne')),
  CONSTRAINT snp_contrat_methode_prix CHECK (methode_prix IN
    ('cours_marche', 'cours_date_reference', 'moyenne_periode', 'negocie', 'fixe',
     'indexe', 'formule')),
  CONSTRAINT snp_contrat_prix_fixe_renseigne CHECK (
    methode_prix <> 'fixe' OR prix_fixe_fcfa IS NOT NULL
  ),
  CONSTRAINT snp_contrat_formule_renseignee CHECK (
    methode_prix <> 'formule' OR formule_prix IS NOT NULL
  ),
  CONSTRAINT snp_contrat_conditions_paiement CHECK (conditions_paiement IN
    ('comptant', 'differe_30j', 'differe_60j', 'differe_90j', 'echelonne')),
  CONSTRAINT snp_contrat_quantites CHECK (
    (quantite_totale IS NULL OR quantite_totale > 0)
    AND (quantite_minimale IS NULL OR quantite_minimale >= 0)
    AND (quantite_maximale IS NULL OR quantite_totale IS NULL OR quantite_maximale >= quantite_totale)
  ),
  CONSTRAINT snp_contrat_teneurs CHECK (
    (teneur_reference_pct IS NULL OR (teneur_reference_pct > 0 AND teneur_reference_pct <= 100))
    AND (teneur_minimale_pct IS NULL OR (teneur_minimale_pct > 0 AND teneur_minimale_pct <= 100))
    AND teneur_tolerance_pct >= 0
  ),
  -- D3 : quatorze états, et un motif exigé pour tous ceux qui ferment une porte.
  CONSTRAINT snp_contrat_statut CHECK (statut IN
    ('brouillon', 'soumis', 'revue_juridique', 'validation_metier', 'validation_financiere',
     'approuve', 'signe', 'actif', 'suspendu', 'echu', 'resilie', 'cloture',
     'rejete', 'annule')),
  CONSTRAINT snp_contrat_motif_exige CHECK (
    statut NOT IN ('rejete', 'suspendu', 'resilie', 'annule')
    OR (motif_statut IS NOT NULL AND length(trim(motif_statut)) >= 5)
  ),
  -- Un contrat n'est actif que signé : on n'exécute pas un engagement non signé.
  CONSTRAINT snp_contrat_actif_signe CHECK (
    statut NOT IN ('actif', 'suspendu', 'echu', 'cloture') OR date_signature IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_contrats_partenaire
  ON snp_contrats (partenaire_type, mining_company_id, artisan_id, site_id);
CREATE INDEX IF NOT EXISTS idx_snp_contrats_statut ON snp_contrats (statut);
CREATE INDEX IF NOT EXISTS idx_snp_contrats_periode ON snp_contrats (date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_snp_contrats_parent ON snp_contrats (contrat_parent_id);

COMMENT ON TABLE snp_contrats IS
  'Contrat de fourniture d''or entre la SONASP et un fournisseur (mine industrielle, mine semi-mécanisée, site artisanal ou artisan).';


/* ═══════════════════════════════════════════════════════════ Échéancier ══ */

CREATE TABLE IF NOT EXISTS snp_contrats_echeancier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES snp_contrats(id) ON DELETE CASCADE,
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  annee integer NOT NULL,
  mois integer,
  rang integer NOT NULL,
  quantite_prevue numeric(18, 4) NOT NULL DEFAULT 0,
  quantite_minimale numeric(18, 4),
  nature text NOT NULL DEFAULT 'ferme',
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_echeance_periode CHECK (periode_fin >= periode_debut),
  CONSTRAINT snp_echeance_quantite CHECK (quantite_prevue >= 0),
  CONSTRAINT snp_echeance_mois CHECK (mois IS NULL OR (mois BETWEEN 1 AND 12)),
  -- Une prévision n'engage pas comme un ferme : la distinction sert au plan.
  CONSTRAINT snp_echeance_nature CHECK (nature IN ('ferme', 'prevision', 'option')),
  CONSTRAINT snp_echeance_rang_unique UNIQUE (contrat_id, rang)
);

CREATE INDEX IF NOT EXISTS idx_snp_echeancier_contrat ON snp_contrats_echeancier (contrat_id);
CREATE INDEX IF NOT EXISTS idx_snp_echeancier_periode ON snp_contrats_echeancier (periode_debut, periode_fin);

COMMENT ON TABLE snp_contrats_echeancier IS
  'Ventilation période par période des quantités engagées par un contrat.';


/* ═════════════════════════════════════════════════════════════ Documents ══ */

CREATE TABLE IF NOT EXISTS snp_contrats_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES snp_contrats(id) ON DELETE CASCADE,
  categorie text NOT NULL,
  intitule text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  chemin text NOT NULL,
  type_mime text,
  taille_octets bigint,
  date_document date,
  date_expiration date,
  statut text NOT NULL DEFAULT 'actif',
  observations text,
  -- Suppression logique : une pièce contractuelle ne s'efface pas.
  supprime_le timestamptz,
  supprime_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  motif_suppression text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_contrat_doc_categorie CHECK (categorie IN
    ('contrat_signe', 'projet', 'avenant', 'annexe', 'echeancier', 'document_legal',
     'autorisation', 'coordonnees_bancaires', 'attestation', 'laboratoire',
     'proces_verbal', 'correspondance', 'decision', 'autre')),
  CONSTRAINT snp_contrat_doc_statut CHECK (statut IN ('actif', 'remplace', 'supprime')),
  CONSTRAINT snp_contrat_doc_suppression CHECK (
    statut <> 'supprime'
    OR (supprime_le IS NOT NULL AND motif_suppression IS NOT NULL
        AND length(trim(motif_suppression)) >= 5)
  ),
  CONSTRAINT snp_contrat_doc_version UNIQUE (contrat_id, categorie, intitule, version)
);

CREATE INDEX IF NOT EXISTS idx_snp_contrats_docs_contrat ON snp_contrats_documents (contrat_id);


/* ═══════════════════════════════════════════════════ Défauts contractuels ══ */

CREATE TABLE IF NOT EXISTS snp_contrats_defauts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  contrat_id uuid NOT NULL REFERENCES snp_contrats(id) ON DELETE CASCADE,
  echeance_id uuid REFERENCES snp_contrats_echeancier(id) ON DELETE SET NULL,
  periode_debut date,
  periode_fin date,
  nature text NOT NULL,
  obligation text,
  partie_responsable text NOT NULL DEFAULT 'fournisseur',
  gravite text NOT NULL DEFAULT 'mineure',
  date_detection date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  quantite_concernee numeric(18, 4),
  montant_concerne_fcfa numeric(18, 2),
  responsable_traitement uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  actions_correctives text,
  echeance_correction date,
  statut text NOT NULL DEFAULT 'detecte',
  decision_finale text,
  motif text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_defaut_nature CHECK (nature IN
    ('absence_livraison', 'livraison_tardive', 'quantite_insuffisante', 'depassement',
     'teneur_inferieure', 'divergence_analyse', 'document_manquant', 'obligation_non_respectee',
     'mise_a_disposition_refusee', 'retard_enlevement_sonasp', 'retard_paiement_sonasp',
     'incident_logistique', 'autre')),
  CONSTRAINT snp_defaut_partie CHECK (partie_responsable IN ('fournisseur', 'sonasp', 'tiers', 'indeterminee')),
  CONSTRAINT snp_defaut_gravite CHECK (gravite IN ('mineure', 'majeure', 'critique')),
  CONSTRAINT snp_defaut_statut CHECK (statut IN
    ('detecte', 'a_qualifier', 'confirme', 'conteste', 'en_traitement',
     'action_corrective', 'regularise', 'non_regularise', 'clos', 'annule')),
  CONSTRAINT snp_defaut_description CHECK (length(trim(description)) >= 10),
  CONSTRAINT snp_defaut_motif_exige CHECK (
    statut NOT IN ('conteste', 'non_regularise', 'annule')
    OR (motif IS NOT NULL AND length(trim(motif)) >= 5)
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_defauts_contrat ON snp_contrats_defauts (contrat_id, statut);


/* ══════════════════════════════════════════════════ Historique des états ══ */

CREATE TABLE IF NOT EXISTS snp_contrats_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id uuid NOT NULL REFERENCES snp_contrats(id) ON DELETE CASCADE,
  statut_avant text,
  statut_apres text NOT NULL,
  motif text,
  commentaire text,
  acteur_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  survenu_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_contrats_hist ON snp_contrats_historique (contrat_id, survenu_le DESC);


/* ═══════════════════════════════════════════════════════ Déclencheurs ══ */

DROP TRIGGER IF EXISTS trg_snp_contrats_touch ON snp_contrats;
CREATE TRIGGER trg_snp_contrats_touch BEFORE UPDATE ON snp_contrats
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_contrats_audit ON snp_contrats;
CREATE TRIGGER trg_snp_contrats_audit AFTER INSERT OR UPDATE OR DELETE ON snp_contrats
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_echeancier_touch ON snp_contrats_echeancier;
CREATE TRIGGER trg_snp_echeancier_touch BEFORE UPDATE ON snp_contrats_echeancier
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_echeancier_audit ON snp_contrats_echeancier;
CREATE TRIGGER trg_snp_echeancier_audit AFTER INSERT OR UPDATE OR DELETE ON snp_contrats_echeancier
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_contrats_docs_touch ON snp_contrats_documents;
CREATE TRIGGER trg_snp_contrats_docs_touch BEFORE UPDATE ON snp_contrats_documents
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_contrats_docs_audit ON snp_contrats_documents;
CREATE TRIGGER trg_snp_contrats_docs_audit AFTER INSERT OR UPDATE OR DELETE ON snp_contrats_documents
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_defauts_touch ON snp_contrats_defauts;
CREATE TRIGGER trg_snp_defauts_touch BEFORE UPDATE ON snp_contrats_defauts
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_defauts_audit ON snp_contrats_defauts;
CREATE TRIGGER trg_snp_defauts_audit AFTER INSERT OR UPDATE OR DELETE ON snp_contrats_defauts
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();


/* ═══════════════════════════════════════════════════════════════ RLS ══ */

ALTER TABLE snp_contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_contrats_echeancier ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_contrats_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_contrats_defauts ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_contrats_historique ENABLE ROW LEVEL SECURITY;

-- Un fournisseur voit son contrat dès qu'il est signé, jamais avant : les états
-- de négociation interne ne le regardent pas.
DROP POLICY IF EXISTS "Contrats lisibles par la SONASP ou le partenaire" ON snp_contrats;
CREATE POLICY "Contrats lisibles par la SONASP ou le partenaire" ON snp_contrats
  FOR SELECT USING (
    snp_est_agent_sonasp()
    OR (mining_company_id = snp_societe_utilisateur()
        AND statut IN ('signe', 'actif', 'suspendu', 'echu', 'resilie', 'cloture'))
  );

DROP POLICY IF EXISTS "Contrats modifiables par la SONASP" ON snp_contrats;
CREATE POLICY "Contrats modifiables par la SONASP" ON snp_contrats
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Echeancier lisible avec son contrat" ON snp_contrats_echeancier;
CREATE POLICY "Echeancier lisible avec son contrat" ON snp_contrats_echeancier
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_contrats c WHERE c.id = snp_contrats_echeancier.contrat_id
  ));

DROP POLICY IF EXISTS "Echeancier modifiable par la SONASP" ON snp_contrats_echeancier;
CREATE POLICY "Echeancier modifiable par la SONASP" ON snp_contrats_echeancier
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Documents lisibles avec leur contrat" ON snp_contrats_documents;
CREATE POLICY "Documents lisibles avec leur contrat" ON snp_contrats_documents
  FOR SELECT USING (
    statut <> 'supprime'
    AND EXISTS (SELECT 1 FROM snp_contrats c WHERE c.id = snp_contrats_documents.contrat_id)
  );

DROP POLICY IF EXISTS "Documents ecrits par la SONASP" ON snp_contrats_documents;
CREATE POLICY "Documents ecrits par la SONASP" ON snp_contrats_documents
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

-- Un défaut ne se lit que par la SONASP : la qualification d'un manquement
-- précède la notification au partenaire.
DROP POLICY IF EXISTS "Defauts reserves a la SONASP" ON snp_contrats_defauts;
CREATE POLICY "Defauts reserves a la SONASP" ON snp_contrats_defauts
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Historique lisible avec son contrat" ON snp_contrats_historique;
CREATE POLICY "Historique lisible avec son contrat" ON snp_contrats_historique
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_contrats c WHERE c.id = snp_contrats_historique.contrat_id
  ));

-- L'historique s'écrit par la fonction de transition, jamais à la main.
DROP POLICY IF EXISTS "Historique ecrit par la SONASP" ON snp_contrats_historique;
CREATE POLICY "Historique ecrit par la SONASP" ON snp_contrats_historique
  FOR INSERT WITH CHECK (snp_est_agent_sonasp());
