-- Quatre domaines de plus que le code affirmait sans que la base les impose.
--
-- CONSTAT
-- Les interfaces declarent des unions fermees — type d'or, moyen de paiement,
-- type de taxe, statut client — la ou la base ne porte que du texte libre. Une
-- faute de frappe passait donc jusqu'au stockage, et un ecran se retrouvait avec
-- une valeur qu'aucun de ses libelles ne sait afficher.
--
-- ETAT VERIFIE AVANT D'AGIR
--   type_or        : poudre 18, lingot 12, pepites 9
--   type_paiement  : virement_bancaire 7, moov_money 7, orange_money 6, wave 6
--   type_taxe      : tva 24, retenue_source 24, taxe_municipale 24, autre 24
--   customers.status : active 3, pending 1
-- Aucune valeur hors domaine ; aucune contrainte prealable sur ces colonnes,
-- verifie pour ne pas repeter la redondance posee sur
-- mining_companies.company_type, deja couverte par une enumeration.
--
-- customers.status est nullable : la contrainte laisse passer NULL, faute de
-- quoi elle rejetterait les clients dont le statut n'est pas renseigne.

BEGIN;

DO $$
DECLARE v_hors integer;
BEGIN
  SELECT count(*) INTO v_hors FROM public.snp_artisan_ventes_or
  WHERE type_or NOT IN ('poudre', 'lingot', 'pepites', 'bijoux', 'autre');
  IF v_hors > 0 THEN RAISE EXCEPTION 'Preflight : % vente(s) hors domaine type_or.', v_hors; END IF;

  SELECT count(*) INTO v_hors FROM public.snp_artisan_paiements
  WHERE type_paiement NOT IN ('orange_money', 'moov_money', 'wave', 'mobile_money',
                              'virement_bancaire', 'cheque', 'cash');
  IF v_hors > 0 THEN RAISE EXCEPTION 'Preflight : % paiement(s) hors domaine.', v_hors; END IF;

  SELECT count(*) INTO v_hors FROM public.snp_artisan_taxes_retenues
  WHERE type_taxe NOT IN ('tva', 'retenue_source', 'taxe_municipale', 'taxe_regionale', 'autre');
  IF v_hors > 0 THEN RAISE EXCEPTION 'Preflight : % taxe(s) hors domaine.', v_hors; END IF;

  SELECT count(*) INTO v_hors FROM public.customers
  WHERE status IS NOT NULL AND status NOT IN ('pending', 'active', 'inactive');
  IF v_hors > 0 THEN RAISE EXCEPTION 'Preflight : % client(s) hors domaine de statut.', v_hors; END IF;
END;
$$;

ALTER TABLE public.snp_artisan_ventes_or
  DROP CONSTRAINT IF EXISTS snp_artisan_ventes_or_type_or_check;
ALTER TABLE public.snp_artisan_ventes_or
  ADD CONSTRAINT snp_artisan_ventes_or_type_or_check
  CHECK (type_or IN ('poudre', 'lingot', 'pepites', 'bijoux', 'autre'));

ALTER TABLE public.snp_artisan_paiements
  DROP CONSTRAINT IF EXISTS snp_artisan_paiements_type_paiement_check;
ALTER TABLE public.snp_artisan_paiements
  ADD CONSTRAINT snp_artisan_paiements_type_paiement_check
  CHECK (type_paiement IN ('orange_money', 'moov_money', 'wave', 'mobile_money',
                           'virement_bancaire', 'cheque', 'cash'));

ALTER TABLE public.snp_artisan_taxes_retenues
  DROP CONSTRAINT IF EXISTS snp_artisan_taxes_retenues_type_taxe_check;
ALTER TABLE public.snp_artisan_taxes_retenues
  ADD CONSTRAINT snp_artisan_taxes_retenues_type_taxe_check
  CHECK (type_taxe IN ('tva', 'retenue_source', 'taxe_municipale', 'taxe_regionale', 'autre'));

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_status_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_status_check
  CHECK (status IS NULL OR status IN ('pending', 'active', 'inactive'));

DO $$
DECLARE v_posees integer;
BEGIN
  SELECT count(*) INTO v_posees FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
  WHERE con.conname IN ('snp_artisan_ventes_or_type_or_check',
                        'snp_artisan_paiements_type_paiement_check',
                        'snp_artisan_taxes_retenues_type_taxe_check',
                        'customers_status_check');
  IF v_posees <> 4 THEN
    RAISE EXCEPTION 'Postflight : % contrainte(s) posee(s) au lieu de 4.', v_posees;
  END IF;
END;
$$;

COMMIT;
