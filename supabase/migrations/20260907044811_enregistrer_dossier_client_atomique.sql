-- Dossier client et comptes bancaires : une seule transaction, sous la RLS existante.
-- Aucun DELETE : les banques retirées deviennent inactives sans casser les paiements.
BEGIN;

DO $preflight$
DECLARE v_missing text;
BEGIN
  IF to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('public.snp_est_agent_sonasp()') IS NULL
     OR to_regprocedure('public.snp_session_est_active()') IS NULL THEN
    RAISE EXCEPTION 'Préflight clients : fonctions de session et de permissions absentes.';
  END IF;
  SELECT string_agg(t.table_name || '.' || t.column_name, ', ') INTO v_missing
  FROM (VALUES
    ('customers','id'),('customers','name'),('customers','email'),('customers','phone'),
    ('customers','country'),('customers','address'),('customers','contact_person'),
    ('customers','tax_id'),('customers','payment_terms'),('customers','credit_limit'),
    ('customers','status'),('customers','updated_at'),
    ('customer_banks','id'),('customer_banks','customer_id'),('customer_banks','bank_name'),
    ('customer_banks','country'),('customer_banks','city'),('customer_banks','currency'),
    ('customer_banks','account_number'),('customer_banks','iban'),('customer_banks','swift_code'),
    ('customer_banks','is_primary'),('customer_banks','is_active'),('customer_banks','updated_at')
  ) AS t(table_name,column_name)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.table_name AND c.column_name=t.column_name);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Préflight clients : colonnes absentes : %.', v_missing;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN ('public.customers'::regclass,'public.customer_banks'::regclass) AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Préflight clients : la RLS doit être activée.';
  END IF;
  -- Le trigger historique ensure_single_primary_bank utilise une table non qualifiée.
  -- public reste dans search_path, après pg_catalog, seulement s'il n'est pas inscriptible.
  IF has_schema_privilege('authenticated','public','CREATE') OR has_schema_privilege('anon','public','CREATE') THEN
    RAISE EXCEPTION 'Préflight clients : le schéma public ne doit pas être créable par les rôles API.';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.save_customer_dossier(
  p_customer_id uuid,
  p_customer jsonb,
  p_banks jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_id uuid;
  v_bank jsonb;
  v_bank_id uuid;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_field text;
  v_credit numeric;
  v_expected integer;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL OR public.snp_est_agent_sonasp() IS DISTINCT FROM true
     OR public.snp_session_est_active() IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Vous ne disposez pas des droits nécessaires pour enregistrer ce dossier client.';
  END IF;
  IF jsonb_typeof(p_customer) IS DISTINCT FROM 'object' OR jsonb_typeof(p_banks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le dossier client ou les comptes bancaires sont incomplets.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_customer) k WHERE k NOT IN
    ('name','email','phone','country','address','contact_person','tax_id','payment_terms','credit_limit','status')) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le dossier contient un champ non autorisé.';
  END IF;
  FOREACH v_field IN ARRAY ARRAY['name','email','phone','country','address','contact_person'] LOOP
    IF jsonb_typeof(p_customer->v_field) IS DISTINCT FROM 'string' OR btrim(p_customer->>v_field)='' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Renseignez les informations obligatoires du client.';
    END IF;
  END LOOP;
  IF btrim(p_customer->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le format de l’adresse électronique est invalide.';
  END IF;
  -- Dossier complet : une valeur explicitement null conserve le contrat nullable,
  -- mais une clé absente ne doit pas effacer silencieusement une valeur existante.
  IF NOT (p_customer ? 'payment_terms') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le dossier doit préciser les conditions de paiement, y compris si elles ne sont pas renseignées.';
  END IF;
  FOREACH v_field IN ARRAY ARRAY['tax_id','payment_terms'] LOOP
    IF p_customer ? v_field AND jsonb_typeof(p_customer->v_field) NOT IN ('string','null') THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Une valeur du dossier client possède un format invalide.';
    END IF;
  END LOOP;
  IF jsonb_typeof(p_customer->'credit_limit') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Une limite de crédit valide est obligatoire.';
  END IF;
  v_credit := (p_customer->>'credit_limit')::numeric;
  IF v_credit < 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La limite de crédit ne peut pas être négative.';
  END IF;
  IF NOT (p_customer ? 'status')
     OR jsonb_typeof(p_customer->'status') NOT IN ('string','null')
     OR (jsonb_typeof(p_customer->'status')='string' AND (p_customer->>'status') NOT IN ('pending','active','inactive')) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Le statut du client est invalide.';
  END IF;

  FOR v_bank IN SELECT value FROM jsonb_array_elements(p_banks) LOOP
    IF jsonb_typeof(v_bank) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Un compte bancaire possède un format invalide.';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_bank) k WHERE k NOT IN
      ('id','bank_name','country','city','currency','account_number','iban','swift_code','is_primary','is_active')) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Un compte bancaire contient un champ non autorisé.';
    END IF;
    FOREACH v_field IN ARRAY ARRAY['bank_name','country','city','currency'] LOOP
      IF jsonb_typeof(v_bank->v_field) IS DISTINCT FROM 'string' OR btrim(v_bank->>v_field)='' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Chaque compte bancaire doit comporter un nom de banque, un pays, une ville et une devise.';
      END IF;
    END LOOP;
    IF btrim(v_bank->>'bank_name')='__other__' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Renseignez le nom de la banque sélectionnée.';
    END IF;
    FOREACH v_field IN ARRAY ARRAY['id','account_number','iban','swift_code'] LOOP
      IF v_bank ? v_field AND jsonb_typeof(v_bank->v_field) NOT IN ('string','null') THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Une référence bancaire possède un format invalide.';
      END IF;
    END LOOP;
    FOREACH v_field IN ARRAY ARRAY['is_primary','is_active'] LOOP
      IF v_bank ? v_field AND jsonb_typeof(v_bank->v_field) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Un indicateur bancaire possède un format invalide.';
      END IF;
    END LOOP;
    BEGIN
      v_bank_id := nullif(btrim(v_bank->>'id'),'')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La référence du compte bancaire est invalide.';
    END;
    IF v_bank_id IS NOT NULL THEN
      IF p_customer_id IS NULL OR v_bank_id=ANY(v_seen) THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La référence bancaire est répétée ou ne correspond pas à ce dossier.';
      END IF;
      v_seen := array_append(v_seen,v_bank_id);
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_array_elements(p_banks) b WHERE coalesce((b->>'is_primary')::boolean,false)) > 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Un seul compte bancaire peut être défini comme principal.';
  END IF;

  IF p_customer_id IS NULL THEN
    INSERT INTO public.customers(name,email,phone,country,address,contact_person,tax_id,payment_terms,credit_limit,status)
    VALUES (btrim(p_customer->>'name'),lower(btrim(p_customer->>'email')),btrim(p_customer->>'phone'),
      btrim(p_customer->>'country'),btrim(p_customer->>'address'),btrim(p_customer->>'contact_person'),
      btrim(coalesce(p_customer->>'tax_id','')),p_customer->>'payment_terms',v_credit,p_customer->>'status')
    RETURNING id INTO v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Le client n’a pas pu être enregistré.';
    END IF;
  ELSE
    -- Sérialise les modifications du même dossier avant de fusionner ses enfants.
    SELECT id INTO v_id FROM public.customers WHERE id=p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Ce dossier client est introuvable ou inaccessible.';
    END IF;
    PERFORM id FROM public.customer_banks WHERE customer_id=v_id ORDER BY id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM unnest(v_seen) wanted(id) WHERE NOT EXISTS
      (SELECT 1 FROM public.customer_banks b WHERE b.id=wanted.id AND b.customer_id=v_id)) THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Un compte bancaire ne correspond pas à ce dossier client.';
    END IF;
    UPDATE public.customers SET
      name=btrim(p_customer->>'name'),email=lower(btrim(p_customer->>'email')),phone=btrim(p_customer->>'phone'),
      country=btrim(p_customer->>'country'),address=btrim(p_customer->>'address'),contact_person=btrim(p_customer->>'contact_person'),
      tax_id=btrim(coalesce(p_customer->>'tax_id','')),payment_terms=p_customer->>'payment_terms',
      credit_limit=v_credit,status=p_customer->>'status',updated_at=statement_timestamp()
    WHERE id=v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Le dossier client n’a pas été modifié.';
    END IF;
    SELECT count(*) INTO v_expected FROM public.customer_banks
      WHERE customer_id=v_id AND NOT (id=ANY(v_seen)) AND (is_active IS DISTINCT FROM false OR is_primary IS DISTINCT FROM false);
    UPDATE public.customer_banks SET is_active=false,is_primary=false,updated_at=statement_timestamp()
      WHERE customer_id=v_id AND NOT (id=ANY(v_seen)) AND (is_active IS DISTINCT FROM false OR is_primary IS DISTINCT FROM false);
    GET DIAGNOSTICS v_updated=ROW_COUNT;
    IF v_updated<>v_expected THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Certains comptes bancaires n’ont pas pu être retirés du dossier.';
    END IF;
  END IF;

  FOR v_bank IN SELECT value FROM jsonb_array_elements(p_banks) LOOP
    v_bank_id := nullif(btrim(v_bank->>'id'),'')::uuid;
    IF v_bank_id IS NULL THEN
      INSERT INTO public.customer_banks(customer_id,bank_name,country,city,currency,account_number,iban,swift_code,is_primary,is_active)
      VALUES(v_id,btrim(v_bank->>'bank_name'),btrim(v_bank->>'country'),btrim(v_bank->>'city'),btrim(v_bank->>'currency'),
        nullif(btrim(v_bank->>'account_number'),''),nullif(btrim(v_bank->>'iban'),''),nullif(btrim(v_bank->>'swift_code'),''),
        coalesce((v_bank->>'is_primary')::boolean,false),coalesce((v_bank->>'is_active')::boolean,true));
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Un compte bancaire n’a pas été enregistré.';
      END IF;
    ELSE
      UPDATE public.customer_banks SET bank_name=btrim(v_bank->>'bank_name'),country=btrim(v_bank->>'country'),
        city=btrim(v_bank->>'city'),currency=btrim(v_bank->>'currency'),account_number=nullif(btrim(v_bank->>'account_number'),''),
        iban=nullif(btrim(v_bank->>'iban'),''),swift_code=nullif(btrim(v_bank->>'swift_code'),''),
        is_primary=coalesce((v_bank->>'is_primary')::boolean,false),is_active=coalesce((v_bank->>'is_active')::boolean,true),updated_at=statement_timestamp()
      WHERE id=v_bank_id AND customer_id=v_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Un compte bancaire n’a pas été modifié.';
      END IF;
    END IF;
  END LOOP;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_customer_dossier(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_dossier(uuid,jsonb,jsonb) TO authenticated;
COMMENT ON FUNCTION public.save_customer_dossier(uuid,jsonb,jsonb) IS
  'Enregistre un dossier client et fusionne ses banques dans une transaction sous les permissions du demandeur. Les banques omises sont désactivées, les références historiques conservées.';

DO $postflight$
DECLARE v_function regprocedure := 'public.save_customer_dossier(uuid,jsonb,jsonb)'::regprocedure;
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid=v_function) THEN
    RAISE EXCEPTION 'Postflight clients : SECURITY INVOKER attendu.';
  END IF;
  IF has_function_privilege('anon',v_function,'EXECUTE') OR NOT has_function_privilege('authenticated',v_function,'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight clients : privilèges RPC incorrects.';
  END IF;
END;
$postflight$;
NOTIFY pgrst, 'reload schema';
COMMIT;
