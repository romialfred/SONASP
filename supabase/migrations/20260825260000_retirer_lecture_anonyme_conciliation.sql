-- Retire la lecture anonyme sur les objets financiers de conciliation.
--
-- CONSTAT
-- Les tables creees pour la conciliation, les grands livres, le referentiel
-- fiscal et les avoirs ont recu SELECT pour `anon`, par le jeu des privileges
-- par defaut du schema.
--
-- Aucune fuite n'en resulte aujourd'hui : leurs politiques de lecture visent
-- `authenticated` et n'accordent rien a `anon`, qui ne verrait donc aucune
-- ligne. Mais le privilege n'a aucune raison d'exister : ces donnees sont
-- financieres et fiscales, et aucune vitrine publique ne les consulte. Le
-- conserver reviendrait a faire reposer leur confidentialite sur la seule
-- exactitude des politiques, alors que le moindre privilege permet de la faire
-- reposer d'abord sur l'absence de droit.
--
-- C'est la meme lecon que la falsification de requete cote serveur corrigee plus
-- tot dans la journee : ce qui n'a pas de raison d'etre joignable ne doit pas
-- l'etre.
--
-- RETOUR ARRIERE
--   GRANT SELECT ON <chaque table> TO anon;

BEGIN;

REVOKE ALL ON
  public.snp_regles_fiscales,
  public.snp_calculs_fiscaux,
  public.snp_grand_livre_commercial,
  public.snp_grand_livre_fiscal,
  public.snp_conciliations,
  public.snp_conciliations_versions,
  public.snp_conciliations_ecarts,
  public.snp_conciliations_operation_ledger,
  public.snp_avoirs_client,
  public.snp_avoirs_imputations
FROM anon;

DO $$
DECLARE
  v_restants integer;
  v_lecture_authentifiee integer;
BEGIN
  SELECT count(*) INTO v_restants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'anon'
    AND table_name IN (
      'snp_regles_fiscales', 'snp_calculs_fiscaux',
      'snp_grand_livre_commercial', 'snp_grand_livre_fiscal',
      'snp_conciliations', 'snp_conciliations_versions',
      'snp_conciliations_ecarts', 'snp_conciliations_operation_ledger',
      'snp_avoirs_client', 'snp_avoirs_imputations'
    );

  IF v_restants <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % privilege(s) anonymes subsistent.', v_restants;
  END IF;

  -- La lecture par les comptes authentifies doit rester intacte : ce sont eux
  -- qui consultent les dossiers, et la retirer casserait les ecrans.
  SELECT count(*) INTO v_lecture_authentifiee
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'authenticated'
    AND privilege_type = 'SELECT'
    AND table_name IN (
      'snp_regles_fiscales', 'snp_calculs_fiscaux',
      'snp_grand_livre_commercial', 'snp_grand_livre_fiscal',
      'snp_conciliations', 'snp_conciliations_versions',
      'snp_conciliations_ecarts', 'snp_avoirs_client', 'snp_avoirs_imputations'
    );

  IF v_lecture_authentifiee <> 9 THEN
    RAISE EXCEPTION
      'Postflight : % lectures authentifiees au lieu de 9.', v_lecture_authentifiee;
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
