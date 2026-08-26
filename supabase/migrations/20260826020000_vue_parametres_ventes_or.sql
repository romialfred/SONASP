-- Restaure la vue des parametres de vente d'or, appelee par le code et absente
-- de la base.
--
-- CONSTAT
-- goldSalesSettingsService interroge gold_sales_settings_view en trois endroits,
-- dont getAllGoldSalesSettings, qui est appelee. La vue n'existant pas, la
-- lecture des parametres echoue.
--
-- Ces parametres ne sont pas decoratifs : snp_creer_vente_export s'en sert pour
-- refuser une vente a un client non autorise et pour plafonner la part de stock
-- qui lui est accessible. Ne pas pouvoir les consulter revient a piloter a
-- l'aveugle une regle qui, elle, s'applique.
--
-- DEFINITION
-- La table gold_sales_settings porte tout le parametrage. La vue n'y ajoute que
-- des libelles : la societe miniere, son abreviation, le client, sa personne de
-- contact, et les noms des comptes ayant cree puis modifie la ligne. Chaque
-- colonne attendue par le service se rapporte a une source unique et existante ;
-- rien n'est suppose.
--
-- SECURITY INVOKER : la vue respecte les politiques de gold_sales_settings. Sans
-- cela elle exposerait le parametrage commercial de toutes les societes.
--
-- CE QUI N'EST PAS FAIT ICI
-- refining_processes, egalement absente, n'est pas recreee : le code y attend
-- une colonne document_url qui n'existe dans aucune table. refining_records, la
-- seule source plausible, ne porte ni document ni date de creation. Son appelant
-- ne verifie d'ailleurs pas l'erreur et poursuit sans document : l'absence est
-- deja traitee, et inventer une colonne serait pire.
--
-- RETOUR ARRIERE
--   DROP VIEW public.gold_sales_settings_view;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.gold_sales_settings') IS NULL
     OR to_regclass('public.mining_companies') IS NULL
     OR to_regclass('public.customers') IS NULL THEN
    RAISE EXCEPTION 'Preflight : une source des parametres de vente est absente.';
  END IF;
END;
$$;

DROP VIEW IF EXISTS public.gold_sales_settings_view;

CREATE VIEW public.gold_sales_settings_view
WITH (security_invoker = true) AS
SELECT
  g.id,
  g.mining_company_id,
  g.customer_id,
  g.max_stock_percentage,
  g.sale_method,
  g.refining_fees_paid_by_customer,
  g.transport_fees_paid_by_customer,
  g.is_active,
  g.effective_date,
  g.notes,
  g.created_at,
  g.updated_at,
  g.created_by,
  g.updated_by,
  mc.name AS mining_company_name,
  -- L'abreviation n'est pas toujours saisie ; le code y supplee alors.
  coalesce(mc.abbreviation, mc.code) AS mining_company_abbr,
  c.name AS customer_name,
  c.contact_person,
  auteur.full_name AS created_by_name,
  modificateur.full_name AS updated_by_name
FROM public.gold_sales_settings g
LEFT JOIN public.mining_companies mc ON mc.id = g.mining_company_id
LEFT JOIN public.customers c ON c.id = g.customer_id
LEFT JOIN public.user_profiles auteur ON auteur.id = g.created_by
LEFT JOIN public.user_profiles modificateur ON modificateur.id = g.updated_by;

COMMENT ON VIEW public.gold_sales_settings_view IS
  'Parametres de vente d''or accompagnes des libelles de la societe, du client et des auteurs. security_invoker : respecte les politiques de gold_sales_settings.';

GRANT SELECT ON public.gold_sales_settings_view TO authenticated;
REVOKE ALL ON public.gold_sales_settings_view FROM anon;

DO $$
DECLARE
  v_invoker boolean;
  v_lignes_vue integer;
  v_lignes_table integer;
BEGIN
  IF to_regclass('public.gold_sales_settings_view') IS NULL THEN
    RAISE EXCEPTION 'Postflight : la vue est absente.';
  END IF;

  SELECT coalesce(
    (SELECT option_value::boolean
       FROM pg_options_to_table(c.reloptions)
      WHERE option_name = 'security_invoker'),
    false)
  INTO v_invoker
  FROM pg_class c
  WHERE c.oid = 'public.gold_sales_settings_view'::regclass;

  IF NOT v_invoker THEN
    RAISE EXCEPTION 'Postflight : la vue ne respecte pas les droits de l''appelant.';
  END IF;

  -- Les jointures sont ouvertes : la vue ne doit ni perdre ni dupliquer de ligne.
  SELECT count(*) INTO v_lignes_vue FROM public.gold_sales_settings_view;
  SELECT count(*) INTO v_lignes_table FROM public.gold_sales_settings;
  IF v_lignes_vue <> v_lignes_table THEN
    RAISE EXCEPTION
      'Postflight : % lignes dans la vue pour % dans la table.',
      v_lignes_vue, v_lignes_table;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'gold_sales_settings_view'
      AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'Postflight : la vue est lisible sans authentification.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
