-- Corrige le double enregistrement de la taxe de developpement communal
-- et annule, sans les detruire, les lignes historiques qui en resultent.
--
-- CONSTAT
-- Deux mecanismes inserent la meme assiette (snp_artisan_factures_definitives
-- .montant_autres_taxes) sous deux codes distincts :
--   1. le declencheur historique `trigger_creer_taxes_retenues` sur
--      snp_artisan_paiements, via creer_taxes_retenues_auto(), qui ecrit
--      ('autre', 'Autres taxes', taux 0, montant brut non arrondi) ;
--   2. la RPC courante snp_artisan_transition_paiement(), qui ecrit
--      ('taxe_municipale', 'Taxe de developpement communal', taux calcule,
--      montant arrondi).
-- Le garde ON CONFLICT (paiement_id, type_taxe) de la RPC ne protege pas :
-- les deux codes different, donc l'index unique uq_snp_artisan_tax_payment_type
-- laisse passer les deux lignes. Le declencheur, anterieur a la RPC, n'a jamais
-- ete retire lors de sa mise en place.
--
-- IMPACT MESURE le 25 aout 2026 sur le projet heberge : 24 paiements portent
-- les deux lignes, pour des montants egaux a moins d'un centime pres. La ligne
-- 'taxe_municipale' est marquee 'reverse' tandis que le doublon 'autre' reste
-- 'a_reverser' pour 16 573 105,49 FCFA : la plateforme reclame un second
-- reversement d'une taxe deja soldee.
--
-- PARTI PRIS
-- Aucune ligne n'est supprimee. Conformement au principe de journal immuable,
-- les doublons sont marques 'annule' avec leur motif, ce qui les sort des
-- montants a reverser tout en conservant la trace de l'anomalie et de sa
-- correction. Seuls les doublons averes sont touches : la ligne 'autre' n'est
-- annulee que s'il existe, pour le meme paiement, une ligne 'taxe_municipale'
-- de meme montant a un centime pres.
--
-- RETOUR ARRIERE
--   UPDATE public.snp_artisan_taxes_retenues
--      SET statut_reversement = 'a_reverser', reversement_reference = NULL
--    WHERE statut_reversement = 'annule'
--      AND reversement_reference = 'DOUBLON-TDC-20260825';
--   CREATE TRIGGER trigger_creer_taxes_retenues
--     AFTER INSERT ON public.snp_artisan_paiements FOR EACH ROW
--     WHEN ((new.statut = 'complete'::text) OR (new.statut = 'valide'::text))
--     EXECUTE FUNCTION public.creer_taxes_retenues_auto();
-- La fonction creer_taxes_retenues_auto() est conservee pour rendre ce retour
-- arriere possible ; seul son rattachement est retire.

BEGIN;

-- Preflight : la table et le declencheur attendus doivent exister.
DO $$
BEGIN
  IF to_regclass('public.snp_artisan_taxes_retenues') IS NULL THEN
    RAISE EXCEPTION 'Table snp_artisan_taxes_retenues absente : migration inapplicable.';
  END IF;
END;
$$;

-- 1. Cause : detacher le declencheur historique.
--    La RPC snp_artisan_transition_paiement() inscrit deja les trois taxes
--    (tva, retenue_source, taxe_municipale) avec les bons codes, les bons taux
--    et une garde d'idempotence. Le declencheur ne fait plus que dupliquer.
DROP TRIGGER IF EXISTS trigger_creer_taxes_retenues ON public.snp_artisan_paiements;

-- 2. Autoriser un statut d'annulation tracable.
ALTER TABLE public.snp_artisan_taxes_retenues
  DROP CONSTRAINT IF EXISTS snp_artisan_taxes_retenues_statut_reversement_check;

ALTER TABLE public.snp_artisan_taxes_retenues
  ADD CONSTRAINT snp_artisan_taxes_retenues_statut_reversement_check
  CHECK (statut_reversement = ANY (ARRAY[
    'a_reverser'::text,
    'en_cours'::text,
    'reverse'::text,
    'comptabilise'::text,
    'annule'::text
  ]));

-- 3. Historique : annuler les doublons averes, sans rien supprimer.
UPDATE public.snp_artisan_taxes_retenues AS doublon
   SET statut_reversement = 'annule',
       reversement_reference = 'DOUBLON-TDC-20260825',
       updated_at = now()
 WHERE doublon.type_taxe = 'autre'
   AND doublon.statut_reversement <> 'annule'
   AND EXISTS (
     SELECT 1
       FROM public.snp_artisan_taxes_retenues AS reference
      WHERE reference.paiement_id = doublon.paiement_id
        AND reference.type_taxe = 'taxe_municipale'
        AND abs(reference.montant_taxe - doublon.montant_taxe) < 0.01
   );

-- Postflight : plus aucun doublon actif, et le declencheur est bien detache.
DO $$
DECLARE
  v_doublons_actifs integer;
  v_declencheur integer;
BEGIN
  SELECT count(*) INTO v_doublons_actifs
    FROM public.snp_artisan_taxes_retenues AS doublon
   WHERE doublon.type_taxe = 'autre'
     AND doublon.statut_reversement <> 'annule'
     AND EXISTS (
       SELECT 1
         FROM public.snp_artisan_taxes_retenues AS reference
        WHERE reference.paiement_id = doublon.paiement_id
          AND reference.type_taxe = 'taxe_municipale'
          AND abs(reference.montant_taxe - doublon.montant_taxe) < 0.01
     );

  IF v_doublons_actifs <> 0 THEN
    RAISE EXCEPTION 'Postflight : % doublon(s) encore actif(s).', v_doublons_actifs;
  END IF;

  SELECT count(*) INTO v_declencheur
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'snp_artisan_paiements'
     AND t.tgname = 'trigger_creer_taxes_retenues'
     AND NOT t.tgisinternal;

  IF v_declencheur <> 0 THEN
    RAISE EXCEPTION 'Postflight : le declencheur historique est encore rattache.';
  END IF;
END;
$$;

COMMIT;
