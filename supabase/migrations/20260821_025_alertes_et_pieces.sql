-- ---------------------------------------------------------------------------
-- Alertes contractuelles et versement des pièces
--
-- Les seuils sont stockés et administrables ; les alertes, elles, se calculent
-- à la lecture. Une table d'alertes matérialisées exigerait un balayage
-- périodique et finirait par montrer une alerte levée depuis une heure, ou par
-- taire une alerte apparue depuis. Ce qui se déduit ne se stocke pas.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS snp_alertes_parametres (
  cle text PRIMARY KEY,
  libelle text NOT NULL,
  domaine text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  seuil_jours integer,
  seuil_pourcentage numeric(6, 3),
  gravite text NOT NULL DEFAULT 'moyenne',
  destinataires_roles text[] NOT NULL DEFAULT ARRAY['owner', 'admin', 'management'],
  updated_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_alerte_domaine CHECK (domaine IN ('contrat', 'requisition', 'analyse')),
  CONSTRAINT snp_alerte_gravite CHECK (gravite IN ('basse', 'moyenne', 'haute', 'critique'))
);

DROP TRIGGER IF EXISTS trg_snp_alertes_touch ON snp_alertes_parametres;
CREATE TRIGGER trg_snp_alertes_touch BEFORE UPDATE ON snp_alertes_parametres
  FOR EACH ROW EXECUTE FUNCTION snp_touch_updated_at();

ALTER TABLE snp_alertes_parametres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parametres d alerte lisibles par la SONASP" ON snp_alertes_parametres;
CREATE POLICY "Parametres d alerte lisibles par la SONASP" ON snp_alertes_parametres
  FOR SELECT USING (snp_est_agent_sonasp());

-- La direction décide de ce qui l'alerte, et à partir de quand.
DROP POLICY IF EXISTS "Parametres d alerte regles par la direction" ON snp_alertes_parametres;
CREATE POLICY "Parametres d alerte regles par la direction" ON snp_alertes_parametres
  FOR ALL USING (snp_peut_valider()) WITH CHECK (snp_peut_valider());

INSERT INTO snp_alertes_parametres (cle, libelle, domaine, seuil_jours, seuil_pourcentage, gravite)
VALUES
  ('contrat_echeance', 'Contrat arrivant a echeance', 'contrat', 60, NULL, 'moyenne'),
  ('contrat_renouvellement', 'Renouvellement a preparer', 'contrat', 90, NULL, 'moyenne'),
  ('engagement_non_respecte', 'Engagement d une periode close non tenu', 'contrat', 0, NULL, 'haute'),
  ('quantite_presque_atteinte', 'Quantite contractuelle presque atteinte', 'contrat', NULL, 90, 'basse'),
  ('contrat_execute', 'Contrat entierement execute', 'contrat', NULL, 100, 'basse'),
  ('defaut_non_resolu', 'Manquement ouvert depuis trop longtemps', 'contrat', 30, NULL, 'haute'),
  ('document_expirant', 'Document contractuel arrivant a expiration', 'contrat', 45, NULL, 'moyenne'),
  ('validation_en_retard', 'Contrat en validation depuis trop longtemps', 'contrat', 15, NULL, 'moyenne'),
  ('requisition_regime_a_qualifier', 'Regime juridique non qualifie', 'requisition', 0, NULL, 'critique'),
  ('requisition_accuse_attendu', 'Accuse de reception attendu', 'requisition', 7, NULL, 'moyenne'),
  ('requisition_enlevement_a_programmer', 'Enlevement a programmer', 'requisition', 5, NULL, 'haute'),
  ('analyse_arbitrage_attendu', 'Teneur a trancher', 'analyse', 5, NULL, 'haute')
ON CONFLICT (cle) DO NOTHING;


CREATE OR REPLACE FUNCTION snp_alertes_contractuelles()
RETURNS TABLE (
  cle text, libelle text, domaine text, gravite text,
  objet_id uuid, reference text, partenaire text, detail text,
  echeance date, jours integer
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
  WITH p AS (SELECT * FROM snp_alertes_parametres WHERE actif)

  SELECT p.cle, p.libelle, p.domaine, p.gravite, c.id, c.numero_contrat,
         COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
         format('Le contrat prend fin le %s.', to_char(c.date_fin, 'DD/MM/YYYY')),
         c.date_fin, (c.date_fin - CURRENT_DATE)::int
  FROM snp_contrats c
  JOIN p ON p.cle = 'contrat_echeance'
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  WHERE c.statut IN ('actif', 'suspendu') AND c.date_fin >= CURRENT_DATE
    AND c.date_fin <= CURRENT_DATE + COALESCE(p.seuil_jours, 60)

  UNION ALL

  -- Le préavis du contrat prime sur le seuil général.
  SELECT p.cle, p.libelle, p.domaine, p.gravite, c.id, c.numero_contrat,
         COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
         format('Reconduction %s : le preavis court jusqu''au %s.', c.reconduction,
                to_char(c.date_fin - COALESCE(c.preavis_reconduction_jours, 0), 'DD/MM/YYYY')),
         (c.date_fin - COALESCE(c.preavis_reconduction_jours, 0))::date,
         (c.date_fin - COALESCE(c.preavis_reconduction_jours, 0) - CURRENT_DATE)::int
  FROM snp_contrats c
  JOIN p ON p.cle = 'contrat_renouvellement'
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  WHERE c.statut = 'actif' AND c.reconduction <> 'aucune'
    AND c.date_fin - COALESCE(c.preavis_reconduction_jours, 0) >= CURRENT_DATE
    AND c.date_fin - COALESCE(c.preavis_reconduction_jours, 0)
        <= CURRENT_DATE + COALESCE(p.seuil_jours, 90)

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine, p.gravite, c.id, c.numero_contrat,
         COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
         format('%s manquent sur les periodes closes.',
                trim(to_char(e.quantite_en_retard, 'FM999999990.9999'))),
         NULL::date, NULL::int
  FROM snp_contrats c
  JOIN p ON p.cle = 'engagement_non_respecte'
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  CROSS JOIN LATERAL snp_contrat_execution(c.id) e
  WHERE c.statut = 'actif' AND e.quantite_en_retard > 0

  UNION ALL

  SELECT
    CASE WHEN e.taux_execution >= 100 THEN 'contrat_execute' ELSE 'quantite_presque_atteinte' END,
    CASE WHEN e.taux_execution >= 100 THEN 'Contrat entierement execute'
         ELSE 'Quantite contractuelle presque atteinte' END,
    'contrat', 'basse', c.id, c.numero_contrat,
    COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
    format('Taux d''execution de %s %%.', trim(to_char(e.taux_execution, 'FM9990.99'))),
    NULL::date, NULL::int
  FROM snp_contrats c
  JOIN p ON p.cle = 'quantite_presque_atteinte'
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  CROSS JOIN LATERAL snp_contrat_execution(c.id) e
  WHERE c.statut = 'actif' AND e.taux_execution >= COALESCE(p.seuil_pourcentage, 90)

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine,
         CASE d.gravite WHEN 'critique' THEN 'critique' WHEN 'majeure' THEN 'haute' ELSE p.gravite END,
         d.contrat_id, d.reference,
         COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
         format('Ouvert le %s, toujours %s.', to_char(d.date_detection, 'DD/MM/YYYY'), d.statut),
         d.echeance_correction, (CURRENT_DATE - d.date_detection)::int
  FROM snp_contrats_defauts d
  JOIN p ON p.cle = 'defaut_non_resolu'
  JOIN snp_contrats c ON c.id = d.contrat_id
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  WHERE d.statut NOT IN ('regularise', 'clos', 'annule')
    AND d.date_detection <= CURRENT_DATE - COALESCE(p.seuil_jours, 30)

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine, p.gravite, doc.contrat_id, doc.intitule,
         COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
         format('Expire le %s.', to_char(doc.date_expiration, 'DD/MM/YYYY')),
         doc.date_expiration, (doc.date_expiration - CURRENT_DATE)::int
  FROM snp_contrats_documents doc
  JOIN p ON p.cle = 'document_expirant'
  JOIN snp_contrats c ON c.id = doc.contrat_id
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  WHERE doc.statut = 'actif' AND doc.date_expiration IS NOT NULL
    AND doc.date_expiration >= CURRENT_DATE
    AND doc.date_expiration <= CURRENT_DATE + COALESCE(p.seuil_jours, 45)

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine, p.gravite, c.id, c.numero_contrat,
         COALESCE(mc.name, c.partenaire_libelle, 'Partenaire non nomme'),
         format('A l''etat « %s » depuis le %s.', c.statut,
                to_char(COALESCE(c.date_soumission, c.created_at), 'DD/MM/YYYY')),
         NULL::date, (CURRENT_DATE - COALESCE(c.date_soumission, c.created_at)::date)::int
  FROM snp_contrats c
  JOIN p ON p.cle = 'validation_en_retard'
  LEFT JOIN mining_companies mc ON mc.id = c.mining_company_id
  WHERE c.statut IN ('soumis', 'revue_juridique', 'validation_metier', 'validation_financiere', 'approuve')
    AND COALESCE(c.date_soumission, c.created_at)
        <= now() - (COALESCE(p.seuil_jours, 15) || ' days')::interval

  UNION ALL

  -- Bloquant par nature : sans régime qualifié, la pièce ne peut pas avancer.
  SELECT p.cle, p.libelle, p.domaine, p.gravite, r.id, r.reference,
         COALESCE(mc.name, 'Mine non nommee'),
         'La requisition ne peut etre ni autorisee ni rendue executoire.',
         NULL::date, NULL::int
  FROM snp_requisitions r
  JOIN p ON p.cle = 'requisition_regime_a_qualifier'
  LEFT JOIN mining_companies mc ON mc.id = r.mining_company_id
  WHERE r.regime_juridique = 'a_qualifier' AND r.statut NOT IN ('annulee', 'cloturee')

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine, p.gravite, r.id, r.reference,
         COALESCE(mc.name, 'Mine non nommee'),
         format('Notifiee le %s, sans accuse a ce jour.', to_char(r.date_notification, 'DD/MM/YYYY')),
         NULL::date, (CURRENT_DATE - r.date_notification::date)::int
  FROM snp_requisitions r
  JOIN p ON p.cle = 'requisition_accuse_attendu'
  LEFT JOIN mining_companies mc ON mc.id = r.mining_company_id
  WHERE r.statut = 'notifiee' AND r.accuse_reception_le IS NULL
    AND r.date_notification <= now() - (COALESCE(p.seuil_jours, 7) || ' days')::interval

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine, p.gravite, r.id, r.reference,
         COALESCE(mc.name, 'Mine non nommee'),
         format('Executoire depuis le %s, aucun enlevement programme.',
                to_char(r.date_executoire, 'DD/MM/YYYY')),
         NULL::date, (CURRENT_DATE - r.date_executoire::date)::int
  FROM snp_requisitions r
  JOIN p ON p.cle = 'requisition_enlevement_a_programmer'
  LEFT JOIN mining_companies mc ON mc.id = r.mining_company_id
  WHERE r.statut = 'executoire' AND r.date_executoire IS NOT NULL
    AND r.date_executoire <= now() - (COALESCE(p.seuil_jours, 5) || ' days')::interval
    AND NOT EXISTS (SELECT 1 FROM snp_requisitions_enlevements e WHERE e.requisition_id = r.id)

  UNION ALL

  SELECT p.cle, p.libelle, p.domaine, p.gravite, a.id, a.reference,
         COALESCE(mc.name, 'Mine non nommee'),
         format('Analyse a l''etat « %s » depuis le %s.', a.statut,
                to_char(a.updated_at, 'DD/MM/YYYY')),
         NULL::date, (CURRENT_DATE - a.updated_at::date)::int
  FROM snp_analyses_teneur a
  JOIN p ON p.cle = 'analyse_arbitrage_attendu'
  LEFT JOIN mining_companies mc ON mc.id = a.mining_company_id
  WHERE a.statut IN ('analysee', 'contre_analyse_requise', 'laboratoire_independant_requis', 'non_conforme')
    AND a.updated_at <= now() - (COALESCE(p.seuil_jours, 5) || ' days')::interval

  ORDER BY 4 DESC, 10 DESC NULLS LAST;
$fn$;

REVOKE ALL ON FUNCTION snp_alertes_contractuelles() FROM public;
GRANT EXECUTE ON FUNCTION snp_alertes_contractuelles() TO authenticated;

COMMENT ON FUNCTION snp_alertes_contractuelles() IS
  'Alertes du moment sur les contrats, les requisitions et les analyses, selon les seuils administrables.';


-- ---------------------------------------------------------------------------
-- Dépôt des pièces contractuelles
--
-- Un seul dépôt privé pour les contrats et les réquisitions. Rien n'y est
-- lisible sans une URL signée, produite à la demande et valable une heure. Les
-- formats sont bornés au dépôt, non à l'écran : un contrôle côté navigateur se
-- contourne.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contrats-documents', 'contrats-documents', false, 26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Pieces contractuelles lisibles par la SONASP" ON storage.objects;
CREATE POLICY "Pieces contractuelles lisibles par la SONASP" ON storage.objects
  FOR SELECT USING (bucket_id = 'contrats-documents' AND snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Pieces contractuelles versees par la SONASP" ON storage.objects;
CREATE POLICY "Pieces contractuelles versees par la SONASP" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'contrats-documents' AND snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Pieces contractuelles retirees par la direction" ON storage.objects;
CREATE POLICY "Pieces contractuelles retirees par la direction" ON storage.objects
  FOR DELETE USING (bucket_id = 'contrats-documents' AND snp_peut_valider());


-- Traçage des consultations. Une lecture ne se journalise pas par déclencheur :
-- c'est l'ouverture d'une URL signée qui constitue l'accès.
CREATE TABLE IF NOT EXISTS snp_documents_acces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domaine text NOT NULL,
  document_id uuid,
  objet_id uuid,
  chemin text NOT NULL,
  action text NOT NULL DEFAULT 'consultation',
  acteur_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  survenu_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT snp_acces_domaine CHECK (domaine IN ('contrat', 'requisition', 'analyse')),
  CONSTRAINT snp_acces_action CHECK (action IN ('consultation', 'telechargement', 'impression'))
);

CREATE INDEX IF NOT EXISTS idx_snp_documents_acces_objet
  ON snp_documents_acces (objet_id, survenu_le DESC);
CREATE INDEX IF NOT EXISTS idx_snp_documents_acces_acteur
  ON snp_documents_acces (acteur_id, survenu_le DESC);

ALTER TABLE snp_documents_acces ENABLE ROW LEVEL SECURITY;

-- Un journal d'accès ne se lit que par ceux qui contrôlent, et ne se modifie
-- par personne : ni UPDATE ni DELETE ne sont accordés.
DROP POLICY IF EXISTS "Journal d acces lisible par la direction" ON snp_documents_acces;
CREATE POLICY "Journal d acces lisible par la direction" ON snp_documents_acces
  FOR SELECT USING (snp_peut_valider());

DROP POLICY IF EXISTS "Journal d acces alimente par la SONASP" ON snp_documents_acces;
CREATE POLICY "Journal d acces alimente par la SONASP" ON snp_documents_acces
  FOR INSERT WITH CHECK (snp_est_agent_sonasp());

COMMENT ON TABLE snp_documents_acces IS
  'Journal des consultations et telechargements de pieces contractuelles. En ecriture seule.';


CREATE OR REPLACE FUNCTION snp_tracer_acces_document(
  p_domaine text, p_chemin text, p_document_id uuid DEFAULT NULL,
  p_objet_id uuid DEFAULT NULL, p_action text DEFAULT 'consultation')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NOT snp_est_agent_sonasp() THEN
    RAISE EXCEPTION 'Seul un agent de la SONASP consulte une piece contractuelle.';
  END IF;

  INSERT INTO snp_documents_acces (domaine, document_id, objet_id, chemin, action, acteur_id)
  VALUES (p_domaine, p_document_id, p_objet_id, p_chemin, p_action, auth.uid());
END $fn$;

REVOKE ALL ON FUNCTION snp_tracer_acces_document(text, text, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION snp_tracer_acces_document(text, text, uuid, uuid, text) TO authenticated;
