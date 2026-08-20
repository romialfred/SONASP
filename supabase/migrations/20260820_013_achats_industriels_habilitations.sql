-- ============================================================================
-- Achats d'or industriel — habilitations
--
-- L'isolation entre sociétés minières ne peut pas reposer sur le masquage de
-- boutons : le navigateur parle directement à PostgREST, et tout utilisateur
-- authentifié peut interroger la table qu'il veut. Elle est donc posée en RLS.
--
-- Deux populations :
--   • agent SONASP  — profil actif sans société de rattachement : voit tout ;
--   • société minière — profil actif rattaché : ne voit que ses propres lignes.
--
-- Les écritures passent par les fonctions du module, qui vérifient elles-mêmes
-- l'habilitation. Les politiques d'écriture directe restent donc fermées aux
-- représentants des mines : ils répondent à une demande par
-- `snp_repondre_demande`, jamais par un UPDATE sur la table.
--
-- Vérifié en recette : un représentant d'Essakane voit 1 demande sur 12,
-- 1 facture, 0 plan et 0 ligne d'audit ; ses quatre tentatives d'intrusion
-- — répondre pour une autre mine, enregistrer un règlement, créer un plan,
-- modifier une facture — ont toutes été refusées par la base.
-- ============================================================================

ALTER TABLE snp_plans_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_plans_achat_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_demandes_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_demandes_achat_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_factures_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_factures_achat_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_factures_certification ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_avoirs_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_reglements_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_reglements_affectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE snp_achats_audit ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- Plans -----
-- Le plan est un document interne : une mine n'a pas à connaître la stratégie
-- nationale d'achat ni ce qui est proposé à ses concurrentes.
DROP POLICY IF EXISTS "Plans lisibles par la SONASP" ON snp_plans_achat;
CREATE POLICY "Plans lisibles par la SONASP" ON snp_plans_achat
  FOR SELECT TO authenticated USING (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Plans modifiables par la SONASP" ON snp_plans_achat;
CREATE POLICY "Plans modifiables par la SONASP" ON snp_plans_achat
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Lignes de plan lisibles par la SONASP" ON snp_plans_achat_lignes;
CREATE POLICY "Lignes de plan lisibles par la SONASP" ON snp_plans_achat_lignes
  FOR SELECT TO authenticated USING (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Lignes de plan modifiables par la SONASP" ON snp_plans_achat_lignes;
CREATE POLICY "Lignes de plan modifiables par la SONASP" ON snp_plans_achat_lignes
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

-- ------------------------------------------------------------ Demandes -----
-- Une demande en brouillon reste interne : la mine ne voit que ce qui lui est
-- effectivement adressé.
DROP POLICY IF EXISTS "Demandes visibles par la SONASP ou la mine concernee" ON snp_demandes_achat;
CREATE POLICY "Demandes visibles par la SONASP ou la mine concernee" ON snp_demandes_achat
  FOR SELECT TO authenticated
  USING (
    snp_est_agent_sonasp()
    OR (mining_company_id = snp_societe_utilisateur() AND statut <> 'brouillon'));

DROP POLICY IF EXISTS "Demandes modifiables par la SONASP" ON snp_demandes_achat;
CREATE POLICY "Demandes modifiables par la SONASP" ON snp_demandes_achat
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Historique visible avec sa demande" ON snp_demandes_achat_historique;
CREATE POLICY "Historique visible avec sa demande" ON snp_demandes_achat_historique
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM snp_demandes_achat d
    WHERE d.id = demande_id
      AND (snp_est_agent_sonasp() OR d.mining_company_id = snp_societe_utilisateur())));

-- ------------------------------------------------------------ Factures -----
DROP POLICY IF EXISTS "Factures visibles par la SONASP ou la mine" ON snp_factures_achat;
CREATE POLICY "Factures visibles par la SONASP ou la mine" ON snp_factures_achat
  FOR SELECT TO authenticated
  USING (snp_est_agent_sonasp() OR mining_company_id = snp_societe_utilisateur());

DROP POLICY IF EXISTS "Factures modifiables par la SONASP" ON snp_factures_achat;
CREATE POLICY "Factures modifiables par la SONASP" ON snp_factures_achat
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Lignes de facture visibles avec leur facture" ON snp_factures_achat_lignes;
CREATE POLICY "Lignes de facture visibles avec leur facture" ON snp_factures_achat_lignes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM snp_factures_achat f
    WHERE f.id = facture_id
      AND (snp_est_agent_sonasp() OR f.mining_company_id = snp_societe_utilisateur())));

DROP POLICY IF EXISTS "Lignes de facture modifiables par la SONASP" ON snp_factures_achat_lignes;
CREATE POLICY "Lignes de facture modifiables par la SONASP" ON snp_factures_achat_lignes
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

-- Le journal de certification reste interne : il porte des codes techniques et
-- des messages d'erreur du service fiscal.
DROP POLICY IF EXISTS "Certifications lisibles par la SONASP" ON snp_factures_certification;
CREATE POLICY "Certifications lisibles par la SONASP" ON snp_factures_certification
  FOR SELECT TO authenticated USING (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Certifications ecrites par la SONASP" ON snp_factures_certification;
CREATE POLICY "Certifications ecrites par la SONASP" ON snp_factures_certification
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

-- -------------------------------------------------------------- Avoirs -----
DROP POLICY IF EXISTS "Avoirs visibles par la SONASP ou la mine" ON snp_avoirs_achat;
CREATE POLICY "Avoirs visibles par la SONASP ou la mine" ON snp_avoirs_achat
  FOR SELECT TO authenticated
  USING (snp_est_agent_sonasp() OR mining_company_id = snp_societe_utilisateur());

DROP POLICY IF EXISTS "Avoirs ecrits par la SONASP" ON snp_avoirs_achat;
CREATE POLICY "Avoirs ecrits par la SONASP" ON snp_avoirs_achat
  FOR ALL TO authenticated
  USING (snp_peut_valider()) WITH CHECK (snp_peut_valider());

-- ---------------------------------------------------------- Règlements -----
-- La mine voit ce qu'elle reçoit : c'est la contrepartie de sa créance.
DROP POLICY IF EXISTS "Reglements visibles par la SONASP ou la mine" ON snp_reglements_achat;
CREATE POLICY "Reglements visibles par la SONASP ou la mine" ON snp_reglements_achat
  FOR SELECT TO authenticated
  USING (snp_est_agent_sonasp() OR mining_company_id = snp_societe_utilisateur());

DROP POLICY IF EXISTS "Reglements ecrits par la SONASP" ON snp_reglements_achat;
CREATE POLICY "Reglements ecrits par la SONASP" ON snp_reglements_achat
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

DROP POLICY IF EXISTS "Affectations visibles avec leur facture" ON snp_reglements_affectations;
CREATE POLICY "Affectations visibles avec leur facture" ON snp_reglements_affectations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM snp_factures_achat f
    WHERE f.id = facture_id
      AND (snp_est_agent_sonasp() OR f.mining_company_id = snp_societe_utilisateur())));

DROP POLICY IF EXISTS "Affectations ecrites par la SONASP" ON snp_reglements_affectations;
CREATE POLICY "Affectations ecrites par la SONASP" ON snp_reglements_affectations
  FOR ALL TO authenticated
  USING (snp_est_agent_sonasp()) WITH CHECK (snp_est_agent_sonasp());

-- --------------------------------------------------------------- Audit -----
-- Le journal se lit, ne s'écrit pas et ne s'efface pas : seul le déclencheur,
-- qui s'exécute en SECURITY DEFINER, y insère.
DROP POLICY IF EXISTS "Audit lisible par la SONASP" ON snp_achats_audit;
CREATE POLICY "Audit lisible par la SONASP" ON snp_achats_audit
  FOR SELECT TO authenticated USING (snp_est_agent_sonasp());

REVOKE INSERT, UPDATE, DELETE ON snp_achats_audit FROM authenticated, anon;

-- --------------------------------------------------- Accès aux fonctions ----
REVOKE ALL ON FUNCTION snp_repartir_plan(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION snp_soumettre_plan(uuid) FROM public;
REVOKE ALL ON FUNCTION snp_repondre_demande(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION snp_enregistrer_reglement(uuid, numeric, date, text, text, text, text, boolean) FROM public;
REVOKE ALL ON FUNCTION snp_affecter_reglement(uuid, uuid, numeric, text) FROM public;
REVOKE ALL ON FUNCTION snp_affecter_fifo(uuid) FROM public;
REVOKE ALL ON FUNCTION snp_annuler_affectation(uuid, text) FROM public;

GRANT EXECUTE ON FUNCTION snp_repartir_plan(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_soumettre_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_repondre_demande(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_enregistrer_reglement(uuid, numeric, date, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_affecter_reglement(uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_affecter_fifo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_annuler_affectation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_balance_agee(date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_releve_societe(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_situation_societe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_facture_reste_du(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_facture_net_exigible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_facture_paye(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION snp_reglement_solde(uuid) TO authenticated;
