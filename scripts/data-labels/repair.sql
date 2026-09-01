-- One-off data correction. The caller MUST wrap this file in a transaction.
-- No application generator, schema, security policy or historical audit is changed.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '90s';
SET LOCAL search_path = pg_catalog, public, pg_temp;
LOCK TABLE public.sales, public.snp_achats_mines, public.shipping_preparations,
  public.expedition_lot_counters, public.snp_factures_achat, public.snp_reglements_achat,
  public.daily_production, public.quarterly_forecasts, public.fx_rates_daily,
  public.snp_conciliations, public.snp_regles_fiscales, public.stakeholder_bank_accounts
IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE label_allowed(table_name text PRIMARY KEY, fields text[]) ON COMMIT DROP;
INSERT INTO label_allowed VALUES
  ('sales', ARRAY['sale_number']),
  ('snp_achats_mines', ARRAY['numero_achat','observations']),
  ('shipping_preparations', ARRAY['expedition_lot_number','notes']),
  ('snp_factures_achat', ARRAY['numero_facture']),
  ('snp_reglements_achat', ARRAY['reference_reglement','reference_interne']),
  ('daily_production', ARRAY['notes']), ('quarterly_forecasts', ARRAY['notes']),
  ('fx_rates_daily', ARRAY['notes']), ('snp_conciliations', ARRAY['observations']),
  ('snp_regles_fiscales', ARRAY['commentaire']), ('stakeholder_bank_accounts', ARRAY['notes']);
CREATE TEMP TABLE label_changes(table_name text, row_id uuid, column_name text, old_value text, new_value text,
  PRIMARY KEY(table_name,row_id,column_name)) ON COMMIT DROP;
CREATE TEMP TABLE label_baseline(table_name text PRIMARY KEY, ignored text[], fingerprint text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.label_contracts_fingerprint() RETURNS text LANGUAGE sql AS $$
  SELECT md5(jsonb_build_object(
    'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid) ORDER BY p.oid) FROM pg_proc p
      WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'),
    'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.oid) FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
    'rls',(SELECT jsonb_agg(jsonb_build_array(oid,relrowsecurity,relforcerowsecurity) ORDER BY oid)
      FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')
  )::text)
$$;
CREATE TEMP TABLE label_contracts_baseline ON COMMIT DROP AS SELECT pg_temp.label_contracts_fingerprint() AS fingerprint;

CREATE FUNCTION pg_temp.label_fingerprint(tab text, ignored text[]) RETURNS text LANGUAGE plpgsql AS $$
DECLARE result text;
BEGIN
  EXECUTE format('SELECT md5(coalesce(string_agg(payload::text,'''' ORDER BY payload::text),'''')) FROM
    (SELECT to_jsonb(r)-$1 AS payload FROM public.%I r) s', tab) INTO result USING ignored;
  RETURN result;
END $$;

DO $$
DECLARE rel record;
BEGIN
  -- Include all direct dependent tables. Audit rows are append-only and must not be rewritten.
  FOR rel IN
    SELECT DISTINCT t.relname AS table_name,
      coalesce(a.fields,ARRAY[]::text[]) || CASE WHEN a.table_name IS NOT NULL
        THEN ARRAY['updated_at','updated_by'] ELSE ARRAY[]::text[] END AS ignored
    FROM pg_class t LEFT JOIN label_allowed a ON a.table_name=t.relname
    WHERE t.relnamespace='public'::regnamespace AND t.relkind='r'
      AND t.relname !~ '(audit|journal|logs?|event)'
      AND (a.table_name IS NOT NULL OR t.oid IN (
        SELECT c.conrelid FROM pg_constraint c JOIN label_allowed l ON c.confrelid=to_regclass('public.'||l.table_name)
        WHERE c.contype='f'))
  LOOP
    INSERT INTO label_baseline VALUES(rel.table_name,rel.ignored,pg_temp.label_fingerprint(rel.table_name,rel.ignored));
  END LOOP;
END $$;

CREATE FUNCTION pg_temp.rename_label(tab text, col text, rid uuid, previous text, replacement text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE affected integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM label_allowed WHERE table_name=tab AND col=ANY(fields)) THEN
    RAISE EXCEPTION 'Champ hors périmètre: %.%',tab,col;
  END IF;
  IF replacement IS NULL OR replacement=previous OR replacement ~* '(PORTAIL-TEST|DEMO|TEST3Y)' THEN
    RAISE EXCEPTION 'Libellé de remplacement invalide';
  END IF;
  EXECUTE format('UPDATE public.%I SET %I=$1 WHERE id=$2 AND %I IS NOT DISTINCT FROM $3',tab,col,col)
    USING replacement,rid,previous;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Donnée absente ou modifiée pendant la correction: % %',tab,rid; END IF;
  INSERT INTO label_changes VALUES(tab,rid,col,previous,replacement);
END $$;

DO $$
DECLARE r record; n integer; yr integer; replacement text; prefix text; refcol text; datecol text; tab text;
BEGIN
  -- Same annual lock, numeric suffix and six-digit format as snp_creer_vente_export.
  FOR r IN SELECT id,sale_number,sale_date FROM public.sales
    WHERE sale_number ~ '^PORTAIL-TEST-SL-(ESK|SOPAMIB)$' ORDER BY sale_date,sale_number,id
  LOOP
    yr:=extract(year FROM r.sale_date);
    PERFORM pg_advisory_xact_lock(hashtext('SONASP:sales:'||yr::text));
    SELECT coalesce(max(substring(sale_number FROM '[0-9]+$')::integer),0)+1 INTO n
    FROM public.sales WHERE sale_number~('^SL-'||yr::text||'-[0-9]+$');
    IF n>999999 THEN RAISE EXCEPTION 'Compteur annuel des ventes épuisé'; END IF;
    PERFORM pg_temp.rename_label('sales','sale_number',r.id,r.sale_number,'SL-'||yr||'-'||lpad(n::text,6,'0'));
  END LOOP;

  -- Preserve the existing AC-MI annual format (five digits).
  FOR r IN SELECT id,numero_achat,date_achat FROM public.snp_achats_mines
    WHERE numero_achat ~ '^(PORTAIL-TEST-ACH-(ESK|SOPAMIB)|ACH-DEMO-[A-Z]+-[0-9]+)$'
    ORDER BY date_achat,numero_achat,id
  LOOP
    yr:=extract(year FROM r.date_achat);
    SELECT coalesce(max(substring(numero_achat FROM '[0-9]+$')::integer),0)+1 INTO n
    FROM public.snp_achats_mines WHERE numero_achat~('^AC-MI-'||yr||'-[0-9]+$');
    IF n>99999 THEN RAISE EXCEPTION 'Compteur annuel des achats épuisé'; END IF;
    PERFORM pg_temp.rename_label('snp_achats_mines','numero_achat',r.id,r.numero_achat,'AC-MI-'||yr||'-'||lpad(n::text,5,'0'));
  END LOOP;

  -- HUM-<company abbreviation>-NNNN/YYYY; reserve the counter used by the existing generator.
  FOR r IN SELECT sp.id,sp.expedition_lot_number,sp.mining_company_id,sp.created_at,mc.abbreviation
    FROM public.shipping_preparations sp JOIN public.mining_companies mc ON mc.id=sp.mining_company_id
    WHERE sp.expedition_lot_number ~ '^PORTAIL-TEST-EXP-(ESK|SOPAMIB)$' ORDER BY sp.id
  LOOP
    IF nullif(btrim(r.abbreviation),'') IS NULL THEN RAISE EXCEPTION 'Abréviation de société absente'; END IF;
    yr:=extract(year FROM r.created_at); prefix:='HUM-'||r.abbreviation||'-';
    SELECT coalesce(max(split_part(substring(expedition_lot_number FROM length(prefix)+1),'/',1)::integer),0)
    INTO n FROM public.shipping_preparations
    WHERE mining_company_id=r.mining_company_id
      AND expedition_lot_number LIKE prefix||'%/'||yr
      AND split_part(substring(expedition_lot_number FROM length(prefix)+1),'/',1)~'^[0-9]+$';
    INSERT INTO public.expedition_lot_counters(mining_company_id,year,counter)
    VALUES(r.mining_company_id,yr,n+1)
    ON CONFLICT(mining_company_id,year) DO UPDATE
      SET counter=greatest(public.expedition_lot_counters.counter,n)+1,updated_at=now()
    RETURNING counter INTO n;
    IF n>9999 THEN RAISE EXCEPTION 'Compteur annuel des expéditions épuisé'; END IF;
    PERFORM pg_temp.rename_label('shipping_preparations','expedition_lot_number',r.id,r.expedition_lot_number,
      prefix||lpad(n::text,4,'0')||'/'||yr);
  END LOOP;

  -- Use the existing generator directly for purchase invoices and settlements.
  FOR tab,refcol,datecol,prefix IN VALUES
    ('snp_factures_achat','numero_facture','date_emission','FA'),
    ('snp_reglements_achat','reference_reglement','date_reglement','REG')
  LOOP
    FOR r IN EXECUTE format('SELECT id,%I AS reference,%I AS date FROM public.%I
      WHERE %I ~ $1 ORDER BY %I,%I,id',refcol,datecol,tab,refcol,datecol,refcol)
      USING '^'||prefix||'-DEMO-'
    LOOP
      yr:=extract(year FROM r.date);
      IF yr IS NULL THEN RAISE EXCEPTION 'Date du document absente'; END IF;
      replacement:=public.snp_numero_suivant(prefix,yr,to_regclass('public.'||tab),refcol);
      PERFORM pg_temp.rename_label(tab,refcol,r.id,r.reference,replacement);
    END LOOP;
  END LOOP;
  FOR r IN SELECT id,reference_interne FROM public.snp_reglements_achat WHERE reference_interne~'^DEMO-[A-Z]+-(ACO|VIR)-[0-9]+$'
  LOOP
    PERFORM pg_temp.rename_label('snp_reglements_achat','reference_interne',r.id,r.reference_interne,
      substring(r.reference_interne FROM 6));
  END LOOP;
END $$;

-- Exact labels only. Preserve non-certification and non-official-source warnings.
DO $$
DECLARE item record; r record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('daily_production','notes','Jeu portail Mine — validation locale','Déclaration de production minière.'),
    ('quarterly_forecasts','notes','Jeu portail Mine — prévision de validation','Prévision de production minière.'),
    ('shipping_preparations','notes','Jeu portail Mine — expédition de validation','Préparation d’expédition de la production minière.'),
    ('snp_achats_mines','observations','Jeu portail Mine — achat partiel SONASP','Achat partiel de production par la SONASP.'),
    ('snp_conciliations','observations','DEMO-20260826 : dossier de demonstration, en attente du resultat de l''acheteur.',
      'Dossier en attente du résultat de l’acheteur.'),
    ('snp_regles_fiscales','commentaire','DEMO-20260826 : taux illustratif, sans valeur juridique.',
      'Taux illustratif, sans valeur juridique.'),
    ('stakeholder_bank_accounts','notes','Jeu de démonstration','Coordonnées bancaires fictives, non utilisables pour un virement.'),
    ('fx_rates_daily','notes','Test','Taux indicatif, source à vérifier.'),
    ('fx_rates_daily','notes','Test import','Import de taux de change, source à vérifier.'),
    ('fx_rates_daily','notes','Test import from ECB','Import de taux de change, source à vérifier.'),
    ('fx_rates_daily','notes','Test: Calculated from EUR/USD','Taux calculé à partir de EUR/USD, source à vérifier.'),
    ('fx_rates_daily','notes','Test: Cross rate','Taux croisé, source à vérifier.')
  ) v(tab,col,previous,replacement)
  LOOP
    FOR r IN EXECUTE format('SELECT id FROM public.%I WHERE %I=$1 ORDER BY id',item.tab,item.col) USING item.previous
    LOOP PERFORM pg_temp.rename_label(item.tab,item.col,r.id,item.previous,item.replacement); END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  IF (SELECT fingerprint FROM label_contracts_baseline) IS DISTINCT FROM pg_temp.label_contracts_fingerprint() THEN
    RAISE EXCEPTION 'Régression: générateur, trigger ou politique de sécurité modifié';
  END IF;
  FOR r IN SELECT * FROM label_baseline LOOP
    IF r.fingerprint IS DISTINCT FROM pg_temp.label_fingerprint(r.table_name,r.ignored) THEN
      RAISE EXCEPTION 'Régression: données métier ou rattachements modifiés dans %',r.table_name;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.sales WHERE sale_number LIKE 'PORTAIL-TEST-%') THEN
    RAISE EXCEPTION 'Référence de vente non traitée';
  END IF;
END $$;
SELECT jsonb_build_object('changes',coalesce((SELECT jsonb_agg(c ORDER BY table_name,row_id,column_name) FROM label_changes c),'[]'::jsonb),
  'verified_tables',(SELECT count(*) FROM label_baseline)) AS result;
