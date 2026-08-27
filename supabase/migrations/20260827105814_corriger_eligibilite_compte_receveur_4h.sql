-- R-25 — Éligibilité du compte receveur du paiement international (4H).
--
-- Cause racine : le lot 4H (20260825000003) exige, sur le compte receveur,
--   stakeholder_type = sales.seller_type      (donc 'sonasp')
--   verification_status = 'verified'
-- alors que les contraintes CHECK de stakeholder_bank_accounts n'admettent
-- que stakeholder_type IN ('customer','mining_company','freight_company',
-- 'refinery_plant') et verification_status IN ('a_verifier','verifie',
-- 'rejete'). Les deux valeurs attendues sont donc ininsérables : aucun
-- compte ne pouvait jamais passer le contrôle et l'exécution 4H était
-- structurellement refusée pour toutes les ventes.
--
-- Correctif : les vendeurs (SONASP nationale comme mines industrielles)
-- vivent dans mining_companies ; leurs comptes bancaires portent
-- stakeholder_type='mining_company'. Le statut vérifié canonique est
-- 'verifie'. Le rattachement au vendeur reste contrôlé par stakeholder_id.
-- Migration rejouable : ancres strictes, saut si déjà appliquée.

DO $do$
DECLARE
  v_def text;
  v_ancre_type text := $a$OR v_seller_bank.stakeholder_type<>v_sale.seller_type$a$;
  v_ancre_statut text := $a$lower(coalesce(v_seller_bank.verification_status,''))<>'verified'$a$;
  v_neuf_type text := $a$OR v_seller_bank.stakeholder_type<>'mining_company'$a$;
  v_neuf_statut text := $a$lower(coalesce(v_seller_bank.verification_status,''))<>'verifie'$a$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_paiement_international_executer';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'snp_paiement_international_executer introuvable.';
  END IF;

  IF position(v_neuf_type IN v_def) > 0 AND position(v_neuf_statut IN v_def) > 0
     AND position(v_ancre_type IN v_def) = 0 AND position(v_ancre_statut IN v_def) = 0 THEN
    RAISE NOTICE 'Déjà appliquée : rien à faire.';
    RETURN;
  END IF;

  IF (length(v_def) - length(replace(v_def, v_ancre_type, ''))) / length(v_ancre_type) <> 1 THEN
    RAISE EXCEPTION 'Ancre stakeholder_type absente ou multiple : correctif à reprendre.';
  END IF;
  IF (length(v_def) - length(replace(v_def, v_ancre_statut, ''))) / length(v_ancre_statut) <> 1 THEN
    RAISE EXCEPTION 'Ancre verification_status absente ou multiple : correctif à reprendre.';
  END IF;

  v_def := replace(v_def, v_ancre_type, v_neuf_type);
  v_def := replace(v_def, v_ancre_statut, v_neuf_statut);
  EXECUTE v_def;

  -- Postflight : la définition en place porte bien le contrôle corrigé.
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'snp_paiement_international_executer';
  IF position(v_neuf_statut IN v_def) = 0 OR position(v_ancre_statut IN v_def) > 0 THEN
    RAISE EXCEPTION 'Postflight en échec : le contrôle corrigé n''est pas en place.';
  END IF;
END
$do$;
