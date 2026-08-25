-- Cloisonne les compteurs de lots d'expedition.
--
-- CONSTAT
-- expedition_lot_counters porte mining_company_id et RLS active, mais sa
-- politique de lecture est `USING (true)` : tout compte authentifie voit les
-- compteurs de toutes les societes minieres.
--
-- COMMENT IL A ETE TROUVE
-- Non par lecture des metadonnees, qui s'est revelee trompeuse a deux reprises,
-- mais par un essai systematique : pour chacune des trente-quatre tables portant
-- mining_company_id, un compte minier a tente de compter les lignes appartenant
-- a une autre societe. Vingt de ces tables contenaient effectivement des donnees
-- tierces — jusqu'a 209 lignes — et une seule les a laissees voir : celle-ci.
--
-- Le meme essai a verifie l'inverse : un agent national continue de voir les 221
-- productions, les 16 preparations d'expedition et les 53 achats miniers. Le
-- cloisonnement ne prive donc personne de ce qui lui revient.
--
-- PORTEE
-- La fuite est reelle mais mesuree : ce sont des compteurs, non des montants ni
-- des teneurs. Elle est corrigee parce qu'aucune fuite inter-organisation n'est
-- acceptable, non parce qu'elle serait grave.
--
-- PREDICAT
-- Celui deja retenu par le reste de la plateforme, notamment par
-- snp_portail_lecture_perimetre sur daily_production : un agent SONASP, une
-- lecture de direction, ou la societe de rattachement. Ne pas y inclure
-- snp_est_direction_lecture aurait prive les roles admin, manager et management,
-- comme l'aurait fait la migration 20260822170000 ecartee plus tot.
--
-- RETOUR ARRIERE
--   DROP POLICY snp_compteurs_expedition_perimetre ON public.expedition_lot_counters;
--   CREATE POLICY "Users can view expedition lot counters"
--     ON public.expedition_lot_counters FOR SELECT TO authenticated USING (true);

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.expedition_lot_counters') IS NULL THEN
    RAISE NOTICE 'Table absente : rien a cloisonner.';
    RETURN;
  END IF;

  -- La politique permissive sans filtre est remplacee, non doublee : la laisser
  -- en place suffirait a maintenir la fuite, les politiques permissives se
  -- combinant par OU.
  DROP POLICY IF EXISTS "Users can view expedition lot counters"
    ON public.expedition_lot_counters;

  DROP POLICY IF EXISTS snp_compteurs_expedition_perimetre
    ON public.expedition_lot_counters;

  CREATE POLICY snp_compteurs_expedition_perimetre
    ON public.expedition_lot_counters
    FOR SELECT TO authenticated
    USING (
      public.snp_est_agent_sonasp()
      OR public.snp_est_direction_lecture()
      OR mining_company_id = public.snp_societe_utilisateur()
    );
END;
$$;

DO $$
DECLARE
  v_sans_filtre integer;
BEGIN
  IF to_regclass('public.expedition_lot_counters') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_sans_filtre
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'expedition_lot_counters'
    AND cmd IN ('SELECT', 'ALL')
    AND permissive = 'PERMISSIVE'
    AND coalesce(qual, 'true') = 'true';

  IF v_sans_filtre <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % politique(s) de lecture sans filtre subsistent.', v_sans_filtre;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'expedition_lot_counters'
      AND policyname = 'snp_compteurs_expedition_perimetre'
  ) THEN
    RAISE EXCEPTION 'Postflight : la politique de perimetre est absente.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
