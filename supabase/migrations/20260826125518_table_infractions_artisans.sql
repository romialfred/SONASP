-- Les constats d'infraction contre un artisan minier n'avaient pas de table.
--
-- CONSTAT
-- artisanInfractionsService interroge snp_artisan_infractions, qui n'existe sous
-- aucun nom. Trois pages vivantes l'appellent au chargement : le dossier de
-- l'artisan, le detail d'un constat et le formulaire de constat. Chacune passe
-- par Promise.allSettled, si bien que l'echec ne plante pas l'ecran : le dossier
-- affiche « aucune infraction » alors que la verite est « la table n'existe
-- pas ». Un agent en conclut qu'un artisan est irreprochable.
--
-- Le contrat est repris tel que le code l'attend, sans rien inventer : memes
-- colonnes, memes valeurs de statut et de conclusion que les types TypeScript.
--
-- CLOISONNEMENT
-- Le meme que les tables soeurs de ce domaine : snp_can_access_artisan() decide
-- du perimetre, par une politique restrictive que rien ne contourne. Un
-- collecteur ne voit que les artisans qui lui sont assignes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.snp_artisan_infractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id) ON DELETE CASCADE,
  date_infraction date NOT NULL,
  type_infraction text NOT NULL,
  description text NOT NULL,
  lieu text,
  statut_traitement text NOT NULL DEFAULT 'en_cours',
  conclusion text,
  remarques text,
  documents text[] NOT NULL DEFAULT ARRAY[]::text[],
  date_cloture date,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT snp_artisan_infractions_statut_check
    CHECK (statut_traitement IN ('en_cours', 'cloture')),
  CONSTRAINT snp_artisan_infractions_conclusion_check
    CHECK (conclusion IS NULL OR conclusion IN ('reconnu', 'soupçonne', 'complice', 'innocente')),
  -- Un constat clos porte une date de cloture, et lui seul.
  CONSTRAINT snp_artisan_infractions_cloture_coherente
    CHECK (
      (statut_traitement = 'cloture' AND date_cloture IS NOT NULL)
      OR (statut_traitement <> 'cloture' AND date_cloture IS NULL)
    ),
  CONSTRAINT snp_artisan_infractions_cloture_posterieure
    CHECK (date_cloture IS NULL OR date_cloture >= date_infraction)
);

CREATE INDEX IF NOT EXISTS snp_artisan_infractions_artisan_idx
  ON public.snp_artisan_infractions (artisan_id, date_infraction DESC);
CREATE INDEX IF NOT EXISTS snp_artisan_infractions_statut_idx
  ON public.snp_artisan_infractions (statut_traitement)
  WHERE statut_traitement = 'en_cours';

COMMENT ON TABLE public.snp_artisan_infractions IS
  'Constats d''infraction releves contre un artisan minier. Perimetre defini par snp_can_access_artisan().';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.snp_artisan_infractions_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS snp_artisan_infractions_touch_trg ON public.snp_artisan_infractions;
CREATE TRIGGER snp_artisan_infractions_touch_trg
  BEFORE UPDATE ON public.snp_artisan_infractions
  FOR EACH ROW EXECUTE FUNCTION public.snp_artisan_infractions_touch();

-- ---------------------------------------------------------------------------
-- Droits et cloisonnement
-- ---------------------------------------------------------------------------

ALTER TABLE public.snp_artisan_infractions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.snp_artisan_infractions FROM PUBLIC;
REVOKE ALL ON public.snp_artisan_infractions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.snp_artisan_infractions TO authenticated;

-- Perimetre : restrictive, donc jamais contournee par une politique permissive.
DROP POLICY IF EXISTS snp_artisan_infractions_perimetre ON public.snp_artisan_infractions;
CREATE POLICY snp_artisan_infractions_perimetre
  ON public.snp_artisan_infractions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.snp_can_access_artisan(artisan_id))
  WITH CHECK (public.snp_can_access_artisan(artisan_id));

DROP POLICY IF EXISTS snp_artisan_infractions_select ON public.snp_artisan_infractions;
CREATE POLICY snp_artisan_infractions_select
  ON public.snp_artisan_infractions FOR SELECT TO authenticated
  USING (true);

-- Relever, modifier ou retirer un constat releve de la gestion des artisans.
DROP POLICY IF EXISTS snp_artisan_infractions_insert ON public.snp_artisan_infractions;
CREATE POLICY snp_artisan_infractions_insert
  ON public.snp_artisan_infractions FOR INSERT TO authenticated
  WITH CHECK (public.snp_actor_has_capability('collectors.manage'));

DROP POLICY IF EXISTS snp_artisan_infractions_update ON public.snp_artisan_infractions;
CREATE POLICY snp_artisan_infractions_update
  ON public.snp_artisan_infractions FOR UPDATE TO authenticated
  USING (public.snp_actor_has_capability('collectors.manage'))
  WITH CHECK (public.snp_actor_has_capability('collectors.manage'));

DROP POLICY IF EXISTS snp_artisan_infractions_delete ON public.snp_artisan_infractions;
CREATE POLICY snp_artisan_infractions_delete
  ON public.snp_artisan_infractions FOR DELETE TO authenticated
  USING (public.snp_actor_has_capability('collectors.manage'));

-- ---------------------------------------------------------------------------
-- Controles
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_rls boolean;
  v_anon integer;
  v_restrictive integer;
BEGIN
  SELECT c.relrowsecurity INTO v_rls FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'snp_artisan_infractions';
  IF NOT coalesce(v_rls, false) THEN
    RAISE EXCEPTION 'Postflight : RLS inactive sur les infractions.';
  END IF;

  SELECT count(*) INTO v_anon FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'snp_artisan_infractions' AND grantee = 'anon';
  IF v_anon > 0 THEN
    RAISE EXCEPTION 'Postflight : anon conserve % privilege(s).', v_anon;
  END IF;

  SELECT count(*) INTO v_restrictive FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  WHERE c.relname = 'snp_artisan_infractions' AND NOT pol.polpermissive;
  IF v_restrictive = 0 THEN
    RAISE EXCEPTION 'Postflight : aucune politique restrictive de perimetre.';
  END IF;
END;
$$;

COMMIT;
