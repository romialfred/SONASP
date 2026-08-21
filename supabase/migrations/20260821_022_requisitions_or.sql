-- ---------------------------------------------------------------------------
-- Réquisitions de production d'or
--
-- ══ PRUDENCE JURIDIQUE ══
--
-- Le régime d'une réquisition n'est pas supposé : il est déclaré sur la pièce
-- elle-même, dans `regime_juridique`. Trois valeurs, qui ne se confondent pas :
--
--   executoire_sans_accord  l'acte habilitant rend la réquisition exécutoire ;
--                           la mine en accuse réception, elle ne l'approuve pas ;
--   accord_requis           le cadre applicable exige l'accord de la mine ;
--   a_qualifier             le régime n'est pas établi : la pièce ne peut pas
--                           devenir exécutoire tant qu'il ne l'est pas.
--
-- L'accusé de réception, les observations, la contestation et l'accord sont
-- quatre champs distincts. Confondre l'un avec l'autre ferait dire au système
-- soit qu'une mine a consenti quand elle n'a fait qu'accuser réception, soit
-- qu'une décision d'autorité était facultative.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS snp_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  objet text NOT NULL,
  partenaire_type text NOT NULL DEFAULT 'mine_industrielle',
  mining_company_id uuid REFERENCES mining_companies(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  contrat_id uuid REFERENCES snp_contrats(id) ON DELETE SET NULL,
  type_requisition text NOT NULL DEFAULT 'partielle',

  /* ------------------------------------------------- Fondement juridique */
  regime_juridique text NOT NULL DEFAULT 'a_qualifier',
  autorite_origine text,
  nature_acte text,
  reference_acte text,
  date_signature_acte date,
  date_effet date,
  periode_debut date,
  periode_fin date,

  /* ------------------------------------------------------ Objet matériel */
  quantite_oz numeric(18, 4),
  unite text NOT NULL DEFAULT 'oz',
  pourcentage_production numeric(6, 3),
  produits_concernes text,
  teneur_estimee_pct numeric(6, 3),

  /* ----------------------------------------------------------- Logistique */
  lieu_stockage text,
  lieu_enlevement text,
  delai_mise_a_disposition_jours integer,
  modalites_enlevement text,
  conditions_transport text,
  conditions_analyse text,

  /* --------------------------------------------------------- Valorisation */
  methode_prix text NOT NULL DEFAULT 'cours_marche',
  prix_once_fcfa numeric(18, 2),
  modalites_paiement text NOT NULL DEFAULT 'differe_30j',

  responsable_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  equipe text,
  confidentialite text NOT NULL DEFAULT 'interne',
  observations text,

  -- Réponse de la mine : quatre faits distincts, jamais confondus.
  accuse_reception_le timestamptz,
  accuse_reception_par text,
  observations_mine text,
  observations_recues_le timestamptz,
  contestation_motif text,
  contestation_recue_le timestamptz,
  accord_mine boolean,
  accord_recu_le timestamptz,

  -- Imputation contractuelle : la règle est portée par la pièce, jamais implicite.
  imputation_contractuelle text,
  imputation_motif text,
  imputation_decidee_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  imputation_decidee_le timestamptz,

  statut text NOT NULL DEFAULT 'brouillon',
  motif_statut text,
  date_autorisation timestamptz,
  autorisee_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  date_notification timestamptz,
  date_executoire timestamptz,
  date_cloture timestamptz,

  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_requisition_partenaire_type CHECK (partenaire_type IN
    ('mine_industrielle', 'mine_semi_mecanisee', 'site_artisanal')),
  CONSTRAINT snp_requisition_mine CHECK (mining_company_id IS NOT NULL OR site_id IS NOT NULL),
  CONSTRAINT snp_requisition_type CHECK (type_requisition IN ('totale', 'partielle', 'pourcentage')),
  CONSTRAINT snp_requisition_regime CHECK (regime_juridique IN
    ('executoire_sans_accord', 'accord_requis', 'a_qualifier')),
  CONSTRAINT snp_requisition_unite CHECK (unite IN ('oz', 'g', 'kg')),
  CONSTRAINT snp_requisition_quantite CHECK (
    (type_requisition = 'pourcentage' AND pourcentage_production IS NOT NULL
      AND pourcentage_production > 0 AND pourcentage_production <= 100)
    OR (type_requisition <> 'pourcentage' AND quantite_oz IS NOT NULL AND quantite_oz > 0)
  ),
  CONSTRAINT snp_requisition_periode CHECK (periode_fin IS NULL OR periode_debut IS NULL
    OR periode_fin >= periode_debut),
  CONSTRAINT snp_requisition_methode_prix CHECK (methode_prix IN
    ('cours_marche', 'cours_date_reference', 'moyenne_periode', 'negocie', 'fixe', 'contrat')),
  CONSTRAINT snp_requisition_confidentialite CHECK (confidentialite IN
    ('public', 'interne', 'restreint', 'confidentiel')),
  CONSTRAINT snp_requisition_imputation CHECK (imputation_contractuelle IS NULL
    OR imputation_contractuelle IN
      ('totale', 'partielle', 'hors_contrat', 'periode_future', 'avenant', 'exclue')),
  CONSTRAINT snp_requisition_imputation_motivee CHECK (
    imputation_contractuelle IS NULL
    OR imputation_contractuelle IN ('totale', 'hors_contrat')
    OR (imputation_motif IS NOT NULL AND length(trim(imputation_motif)) >= 5)
  ),
  CONSTRAINT snp_requisition_imputation_contrat CHECK (
    imputation_contractuelle IS NULL
    OR imputation_contractuelle = 'hors_contrat'
    OR contrat_id IS NOT NULL
  ),
  CONSTRAINT snp_requisition_statut CHECK (statut IN
    ('brouillon', 'verification_juridique', 'validation_metier', 'validation_direction',
     'autorisee', 'notifiee', 'accusee', 'contestee', 'executoire',
     'enlevement_planifie', 'en_cours_enlevement', 'collectee', 'en_analyse',
     'acceptee', 'facturee', 'payee', 'cloturee', 'suspendue', 'annulee')),
  CONSTRAINT snp_requisition_motif_exige CHECK (
    statut NOT IN ('suspendue', 'annulee', 'contestee')
    OR (motif_statut IS NOT NULL AND length(trim(motif_statut)) >= 5)
  ),
  -- Une réquisition n'avance pas sans que son fondement soit établi.
  CONSTRAINT snp_requisition_fondement CHECK (
    statut IN ('brouillon', 'verification_juridique', 'annulee')
    OR (reference_acte IS NOT NULL AND nature_acte IS NOT NULL
        AND autorite_origine IS NOT NULL AND regime_juridique <> 'a_qualifier')
  ),
  -- L'accord de la mine ne se renseigne que sous un régime qui l'exige.
  CONSTRAINT snp_requisition_accord_pertinent CHECK (
    accord_mine IS NULL OR regime_juridique = 'accord_requis'
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_requisitions_mine ON snp_requisitions (mining_company_id, statut);
CREATE INDEX IF NOT EXISTS idx_snp_requisitions_contrat ON snp_requisitions (contrat_id);
CREATE INDEX IF NOT EXISTS idx_snp_requisitions_periode ON snp_requisitions (periode_debut, periode_fin);

COMMENT ON TABLE snp_requisitions IS
  'Réquisition de tout ou partie de la production d''une mine, fondée sur un acte juridique habilitant.';


CREATE TABLE IF NOT EXISTS snp_requisitions_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES snp_requisitions(id) ON DELETE CASCADE,
  categorie text NOT NULL,
  intitule text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  chemin text NOT NULL,
  type_mime text,
  taille_octets bigint,
  date_document date,
  statut text NOT NULL DEFAULT 'actif',
  observations text,
  supprime_le timestamptz,
  supprime_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  motif_suppression text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_requisition_doc_categorie CHECK (categorie IN
    ('acte_juridique', 'notification', 'accuse_reception', 'reponse_mine', 'contestation',
     'proces_verbal', 'pesee', 'analyse', 'transport', 'photo', 'facture', 'paiement', 'autre')),
  CONSTRAINT snp_requisition_doc_statut CHECK (statut IN ('actif', 'remplace', 'supprime')),
  CONSTRAINT snp_requisition_doc_version UNIQUE (requisition_id, categorie, intitule, version)
);

CREATE INDEX IF NOT EXISTS idx_snp_requisitions_docs ON snp_requisitions_documents (requisition_id);


-- Le contenu envoyé est conservé tel quel : une notification dont on ne peut
-- plus produire le texte ne prouve rien.
CREATE TABLE IF NOT EXISTS snp_requisitions_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES snp_requisitions(id) ON DELETE CASCADE,
  canal text NOT NULL,
  destinataires text NOT NULL,
  objet text NOT NULL,
  contenu text NOT NULL,
  envoye_le timestamptz NOT NULL DEFAULT now(),
  envoye_par uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  preuve_envoi text,
  accuse_le timestamptz,
  accuse_par text,
  preuve_reception text,
  relance_de uuid REFERENCES snp_requisitions_notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_requisition_notif_canal CHECK (canal IN
    ('plateforme', 'courriel', 'sms', 'courrier_officiel', 'remise_en_main_propre'))
);

CREATE INDEX IF NOT EXISTS idx_snp_requisitions_notifs
  ON snp_requisitions_notifications (requisition_id, envoye_le DESC);


CREATE TABLE IF NOT EXISTS snp_requisitions_enlevements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  requisition_id uuid NOT NULL REFERENCES snp_requisitions(id) ON DELETE CASCADE,
  quantite_prevue_oz numeric(18, 4),
  date_prevue timestamptz,
  date_reelle timestamptz,
  lieu text,
  equipe_sonasp text,
  representants_mine text,
  moyens_transport text,
  dispositifs_securite text,
  nombre_colis integer,
  numeros_scelles text,
  poids_declare_g numeric(18, 3),
  poids_brut_g numeric(18, 3),
  tare_g numeric(18, 3),
  poids_net_g numeric(18, 3),
  quantite_constatee_oz numeric(18, 4),
  teneur_constatee_pct numeric(6, 3),
  constat_contradictoire boolean NOT NULL DEFAULT false,
  reserves text,
  incidents text,
  arrivee_destination timestamptz,
  statut text NOT NULL DEFAULT 'planifie',
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_enlevement_statut CHECK (statut IN
    ('planifie', 'en_cours', 'realise', 'partiel', 'annule')),
  -- Le net déclaré doit correspondre au brut moins la tare, au milligramme près.
  CONSTRAINT snp_enlevement_poids CHECK (
    poids_net_g IS NULL OR poids_brut_g IS NULL OR tare_g IS NULL
    OR abs(poids_net_g - (poids_brut_g - tare_g)) < 0.001
  ),
  CONSTRAINT snp_enlevement_positif CHECK (
    (poids_brut_g IS NULL OR poids_brut_g >= 0)
    AND (tare_g IS NULL OR tare_g >= 0)
    AND (quantite_constatee_oz IS NULL OR quantite_constatee_oz >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_snp_enlevements_requisition
  ON snp_requisitions_enlevements (requisition_id);


CREATE TABLE IF NOT EXISTS snp_requisitions_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES snp_requisitions(id) ON DELETE CASCADE,
  statut_avant text,
  statut_apres text NOT NULL,
  motif text,
  commentaire text,
  acteur_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  survenu_le timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_requisitions_hist
  ON snp_requisitions_historique (requisition_id, survenu_le DESC);


-- L'achat porte le lien vers la réquisition : il reste la seule source
-- physique d'or acheté, et donc le seul endroit où la quantité se compte.
ALTER TABLE snp_achats_mines
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES snp_requisitions(id) ON DELETE SET NULL;

ALTER TABLE snp_demandes_achat
  ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES snp_requisitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_snp_achats_requisition ON snp_achats_mines (requisition_id);


/* ═══════════════════════════════════════════════════════ Déclencheurs ══ */

DROP TRIGGER IF EXISTS trg_snp_requisitions_touch ON snp_requisitions;
CREATE TRIGGER trg_snp_requisitions_touch BEFORE UPDATE ON snp_requisitions
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_requisitions_audit ON snp_requisitions;
CREATE TRIGGER trg_snp_requisitions_audit AFTER INSERT OR UPDATE OR DELETE ON snp_requisitions
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_req_docs_audit ON snp_requisitions_documents;
CREATE TRIGGER trg_snp_req_docs_audit AFTER INSERT OR UPDATE OR DELETE ON snp_requisitions_documents
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_req_notifs_audit ON snp_requisitions_notifications;
CREATE TRIGGER trg_snp_req_notifs_audit AFTER INSERT OR UPDATE OR DELETE ON snp_requisitions_notifications
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();

DROP TRIGGER IF EXISTS trg_snp_enlevements_touch ON snp_requisitions_enlevements;
CREATE TRIGGER trg_snp_enlevements_touch BEFORE UPDATE ON snp_requisitions_enlevements
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

DROP TRIGGER IF EXISTS trg_snp_enlevements_audit ON snp_requisitions_enlevements;
CREATE TRIGGER trg_snp_enlevements_audit AFTER INSERT OR UPDATE OR DELETE ON snp_requisitions_enlevements
  FOR EACH ROW EXECUTE FUNCTION snp_auditer();


/* ═══════════════════════════════════════════════════════════════ RLS ══ */

ALTER TABLE snp_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_requisitions_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_requisitions_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_requisitions_enlevements ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_requisitions_historique ENABLE ROW LEVEL SECURITY;

-- La mine voit sa réquisition à partir du moment où elle lui est notifiée, et
-- pas avant : la préparation d'une mesure d'autorité ne se divulgue pas.
DROP POLICY IF EXISTS "Requisitions lisibles par la SONASP ou la mine notifiee" ON snp_requisitions;
CREATE POLICY "Requisitions lisibles par la SONASP ou la mine notifiee" ON snp_requisitions
  FOR SELECT USING (
    snp_est_agent_sonasp()
    OR (mining_company_id = snp_societe_utilisateur()
        AND statut NOT IN ('brouillon', 'verification_juridique', 'validation_metier',
                           'validation_direction', 'autorisee', 'annulee'))
  );

DROP POLICY IF EXISTS "Requisitions modifiables par la SONASP" ON snp_requisitions;
CREATE POLICY "Requisitions modifiables par la SONASP" ON snp_requisitions
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Documents de requisition lisibles avec leur piece" ON snp_requisitions_documents;
CREATE POLICY "Documents de requisition lisibles avec leur piece" ON snp_requisitions_documents
  FOR SELECT USING (
    statut <> 'supprime'
    AND EXISTS (SELECT 1 FROM snp_requisitions r WHERE r.id = snp_requisitions_documents.requisition_id)
  );

DROP POLICY IF EXISTS "Documents de requisition ecrits par la SONASP" ON snp_requisitions_documents;
CREATE POLICY "Documents de requisition ecrits par la SONASP" ON snp_requisitions_documents
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Notifications lisibles avec leur requisition" ON snp_requisitions_notifications;
CREATE POLICY "Notifications lisibles avec leur requisition" ON snp_requisitions_notifications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_requisitions r WHERE r.id = snp_requisitions_notifications.requisition_id
  ));

DROP POLICY IF EXISTS "Notifications ecrites par la SONASP" ON snp_requisitions_notifications;
CREATE POLICY "Notifications ecrites par la SONASP" ON snp_requisitions_notifications
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Enlevements lisibles avec leur requisition" ON snp_requisitions_enlevements;
CREATE POLICY "Enlevements lisibles avec leur requisition" ON snp_requisitions_enlevements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_requisitions r WHERE r.id = snp_requisitions_enlevements.requisition_id
  ));

DROP POLICY IF EXISTS "Enlevements ecrits par la SONASP" ON snp_requisitions_enlevements;
CREATE POLICY "Enlevements ecrits par la SONASP" ON snp_requisitions_enlevements
  FOR ALL USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Historique de requisition lisible" ON snp_requisitions_historique;
CREATE POLICY "Historique de requisition lisible" ON snp_requisitions_historique
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM snp_requisitions r WHERE r.id = snp_requisitions_historique.requisition_id
  ));

DROP POLICY IF EXISTS "Historique de requisition ecrit par la SONASP" ON snp_requisitions_historique;
CREATE POLICY "Historique de requisition ecrit par la SONASP" ON snp_requisitions_historique
  FOR INSERT WITH CHECK (snp_est_agent_sonasp());
