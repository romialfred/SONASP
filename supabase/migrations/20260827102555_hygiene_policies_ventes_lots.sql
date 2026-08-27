-- Hygiene des politiques de snp_ventes_lots.
--
-- ETAT VERIFIE LE 27 AOUT 2026
-- La table est deja sure : trois politiques RESTRICTIVES bloquent toute
-- ecriture directe (check false) et bornent la lecture au perimetre de la vente
-- (snp_peut_consulter_vente). Mais deux politiques permissives « USING (true) »
-- subsistent — « Ecriture des lots de vente » (ALL) et « Lecture des lots de
-- vente » — heritees d'avant le verrouillage. Elles sont sans effet reel
-- (les restrictives s'appliquent en ET), mais elles font croire a une table
-- ouverte a quiconque lit le catalogue des politiques, et un futur DROP de la
-- restrictive rouvrirait tout en silence.
--
-- On retire les permissives redondantes et on les remplace par des permissives
-- qui disent la meme chose que la regle effective. Le comportement ne change
-- pas ; la lecture du catalogue devient honnete.

BEGIN;

DROP POLICY IF EXISTS "Ecriture des lots de vente" ON public.snp_ventes_lots;
DROP POLICY IF EXISTS "Lecture des lots de vente" ON public.snp_ventes_lots;
DROP POLICY IF EXISTS snp_vente_enfant_acces_authentifie ON public.snp_ventes_lots;

-- La permissive de lecture porte desormais la meme regle que la restrictive :
-- si la restrictive disparait un jour, le perimetre tient toujours.
CREATE POLICY snp_ventes_lots_lecture_perimetre
  ON public.snp_ventes_lots FOR SELECT TO authenticated
  USING (public.snp_peut_consulter_vente(sale_id));

DO $$
DECLARE v_larges integer;
BEGIN
  SELECT count(*) INTO v_larges
  FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
  WHERE c.relname = 'snp_ventes_lots'
    AND pol.polpermissive
    AND coalesce(pg_get_expr(pol.polqual, pol.polrelid), 'true') = 'true';
  IF v_larges > 0 THEN
    RAISE EXCEPTION 'Postflight : % politique(s) permissive(s) USING(true) subsistent.', v_larges;
  END IF;
END;
$$;

COMMIT;
