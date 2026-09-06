-- Collecteurs: registre, rattachements historisés et approbations d'achats.
-- Aucune conversion des anciens dossiers, aucune suppression de données.
BEGIN;
CREATE TABLE public.snp_collectors (
 id uuid PRIMARY KEY REFERENCES public.snp_artisans_miniers(id),
 organization_id uuid NOT NULL REFERENCES public.snp_organizations(id),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), creation_fingerprint text NOT NULL,
 payment_authorized_until timestamptz, payment_authorized_by uuid REFERENCES auth.users(id),
 created_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collectors_organization_idx ON public.snp_collectors(organization_id);
CREATE TABLE public.snp_collector_sites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collector_id uuid NOT NULL REFERENCES public.snp_collectors(id),
 site_id uuid NOT NULL REFERENCES public.artisanal_sites(id), valid_from timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz, assigned_by uuid NOT NULL REFERENCES auth.users(id),
 CHECK(valid_until IS NULL OR valid_until>=valid_from)
);
CREATE UNIQUE INDEX collector_site_current ON public.snp_collector_sites(collector_id,site_id) WHERE valid_until IS NULL;
CREATE INDEX collector_site_site_idx ON public.snp_collector_sites(site_id,collector_id) WHERE valid_until IS NULL;
CREATE TABLE public.snp_collector_sales (
 id uuid PRIMARY KEY REFERENCES public.snp_artisan_ventes_or(id) DEFERRABLE INITIALLY DEFERRED,
 collector_id uuid NOT NULL REFERENCES public.snp_collectors(id), artisan_id uuid NOT NULL REFERENCES public.snp_artisans_miniers(id),
 organization_id uuid NOT NULL REFERENCES public.snp_organizations(id), site_id uuid NOT NULL REFERENCES public.artisanal_sites(id),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','approved','rejected')),
 submitted_by uuid NOT NULL REFERENCES auth.users(id), submitted_at timestamptz NOT NULL DEFAULT now(),
 decided_by uuid REFERENCES auth.users(id), decided_at timestamptz, reason text,
 version integer NOT NULL DEFAULT 1, fingerprint text NOT NULL,
 CHECK((status='submitted' AND decided_by IS NULL AND decided_at IS NULL) OR (status<>'submitted' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decided_by<>submitted_by))
);
CREATE INDEX collector_sales_org_idx ON public.snp_collector_sales(organization_id,status,submitted_at);
CREATE INDEX collector_sales_collector_idx ON public.snp_collector_sales(collector_id,submitted_at);
CREATE INDEX collector_sales_artisan_idx ON public.snp_collector_sales(artisan_id);
ALTER TABLE public.snp_collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_collector_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_collector_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.snp_collectors,public.snp_collector_sites,public.snp_collector_sales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.snp_collectors,public.snp_collector_sites,public.snp_collector_sales TO authenticated;

INSERT INTO public.snp_capability_catalog(code,domain,label,description,sensitive) VALUES
 ('collector.payments.execute','artisanat','Collecteur — exécuter un paiement','Paiement limité aux ventes approuvées du collecteur avec délégation de son organisme.',true)
ON CONFLICT DO NOTHING;
INSERT INTO public.snp_responsibility_catalog(code,capability_code,label,description,requires_explicit_assignment)
VALUES('collector.payments.execute','collector.payments.execute','Paiement délégué au collecteur','Autorisation explicite, révocable, dans le périmètre de collecte.',true) ON CONFLICT DO NOTHING;
INSERT INTO public.snp_role_responsibility_ceiling(role,responsibility_code,required)
VALUES('collector','collector.payments.execute',false) ON CONFLICT DO NOTHING;

CREATE FUNCTION public.snp_collector_strong_session() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.snp_session_est_active() OR NOT public.snp_mfa_satisfaite()
 OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active) THEN
 RAISE EXCEPTION 'Une session active avec authentification forte est requise.' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.snp_collector_org_access(p_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.snp_session_est_active() AND public.snp_mfa_satisfaite() AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active) AND (public.snp_peut_gerer_sites_artisanaux() OR
 (public.snp_current_collector_id() IS NULL AND public.snp_current_organization_id()=p_org
 AND EXISTS(SELECT 1 FROM public.snp_organizations WHERE id=p_org AND is_active AND organization_type IN('comptoir','sonasp'))));
$$;
CREATE FUNCTION public.snp_collector_visible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.snp_session_est_active() AND public.snp_mfa_satisfaite() AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active) AND (public.snp_peut_gerer_sites_artisanaux() OR EXISTS(SELECT 1 FROM public.snp_collectors c WHERE c.id=p_id AND
 (public.snp_collector_org_access(c.organization_id) OR (c.id=public.snp_current_collector_id() AND public.snp_actor_has_capability('collector.operate')))));
$$;
CREATE POLICY collectors_read ON public.snp_collectors FOR SELECT TO authenticated USING(public.snp_collector_visible(id));
CREATE POLICY collector_sites_read ON public.snp_collector_sites FOR SELECT TO authenticated USING(public.snp_collector_visible(collector_id));
CREATE POLICY collector_sales_read ON public.snp_collector_sales FOR SELECT TO authenticated
 USING(public.snp_session_est_active() AND public.snp_mfa_satisfaite() AND (public.snp_collector_org_access(organization_id) OR (collector_id=public.snp_current_collector_id() AND public.snp_collector_visible(collector_id))));

CREATE FUNCTION public.snp_collector_references() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.snp_collector_strong_session();
 IF NOT public.snp_peut_gerer_sites_artisanaux() THEN RAISE EXCEPTION 'Référentiel réservé à la DGMG et à l’administration.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('sites',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'locality',locality,'region',region) ORDER BY name),'[]') FROM public.artisanal_sites),
 'organizations',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'organization_type',organization_type) ORDER BY name),'[]') FROM public.snp_organizations WHERE is_active AND organization_type IN('sonasp','comptoir')));
END $$;
CREATE FUNCTION public.snp_list_collectors() RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.snp_collector_strong_session();
 RETURN QUERY SELECT jsonb_build_object('id',a.id,'identity',to_jsonb(a),'organization_id',c.organization_id,
 'organization_name',o.name,'organization_type',o.organization_type,'version',c.version,'payment_authorized_until',c.payment_authorized_until,
 'can_delegate_payment',o.is_active AND public.snp_current_collector_id() IS NULL AND public.snp_current_organization_id()=c.organization_id AND public.snp_actor_has_capability(CASE WHEN o.organization_type='comptoir' THEN 'comptoir.payments.execute' ELSE 'sonasp.finance.execute' END),
 'account_user_id',(SELECT user_id FROM public.snp_collector_accounts WHERE collector_id=c.id AND is_active LIMIT 1),
 'site_ids',(SELECT coalesce(jsonb_agg(site_id),'[]') FROM public.snp_collector_sites WHERE collector_id=c.id AND valid_until IS NULL),
 'sites',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'locality',s.locality,'region',s.region) ORDER BY s.name),'[]') FROM public.snp_collector_sites cs JOIN public.artisanal_sites s ON s.id=cs.site_id WHERE cs.collector_id=c.id AND cs.valid_until IS NULL))
 FROM public.snp_collectors c JOIN public.snp_artisans_miniers a ON a.id=c.id JOIN public.snp_organizations o ON o.id=c.organization_id
 WHERE public.snp_collector_visible(c.id) ORDER BY a.nom,a.prenoms;
 -- Existing identities stay visible. No sites or financial rights are inferred.
 RETURN QUERY SELECT jsonb_build_object('id',a.id,'identity',to_jsonb(a),'is_legacy',true,'version',0,
 'organization_id',coalesce(o.id::text,''),'organization_name',coalesce(o.name,'À compléter'),'organization_type',o.organization_type,
 'site_ids','[]'::jsonb,'sites','[]'::jsonb,'payment_authorized_until',NULL,'can_delegate_payment',false,'account_user_id',ca.user_id)
 FROM public.snp_artisans_miniers a LEFT JOIN LATERAL(SELECT linked.user_id,linked.comptoir_organization_id FROM public.snp_collector_accounts linked WHERE linked.collector_id=a.id AND linked.is_active ORDER BY linked.linked_at DESC LIMIT 1) ca ON true
 LEFT JOIN public.snp_organizations o ON o.id=ca.comptoir_organization_id
 WHERE a.type_artisan='collecteur' AND NOT EXISTS(SELECT 1 FROM public.snp_collectors c WHERE c.id=a.id)
 AND (public.snp_peut_gerer_sites_artisanaux() OR public.snp_collector_org_access(o.id) OR (a.id=public.snp_current_collector_id() AND public.snp_actor_has_capability('collector.operate')))
 ORDER BY a.nom,a.prenoms;
END $$;
CREATE FUNCTION public.snp_save_collector(p_id uuid,p_expected_version integer,p_dossier jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old public.snp_collectors; existing public.snp_artisans_miniers; v public.snp_artisans_miniers; org uuid; sites uuid[]; fingerprint text:=md5(p_dossier::text); identity jsonb; result jsonb;
BEGIN
 PERFORM public.snp_collector_strong_session();
 IF NOT public.snp_peut_gerer_sites_artisanaux() THEN RAISE EXCEPTION 'Gestion réservée à la DGMG et à l’administration.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR jsonb_typeof(p_dossier) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dossier invalide.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(60906111030);
 SELECT * INTO old FROM public.snp_collectors WHERE id=p_id FOR UPDATE;
 SELECT * INTO existing FROM public.snp_artisans_miniers WHERE id=p_id FOR UPDATE;
 IF old.id IS NOT NULL AND (p_expected_version IS NULL OR (p_expected_version=0 AND p_dossier ? 'legacy_updated_at')) THEN
  IF old.created_by=auth.uid() AND old.creation_fingerprint=fingerprint THEN SELECT x INTO result FROM public.snp_list_collectors() x WHERE x->>'id'=p_id::text; RETURN result; END IF;
  RAISE EXCEPTION 'Ce collecteur existe déjà. Rechargez sa fiche.' USING ERRCODE='40001';
 END IF;
 IF old.id IS NULL AND existing.id IS NOT NULL THEN
  IF existing.type_personne<>'physique' OR existing.type_artisan<>'collecteur' THEN RAISE EXCEPTION 'Le dossier historique doit être une personne physique de type collecteur. Aucune conversion automatique.' USING ERRCODE='23514'; END IF;
  IF p_expected_version IS DISTINCT FROM 0 OR (p_dossier->>'legacy_updated_at')::timestamptz IS DISTINCT FROM existing.updated_at THEN RAISE EXCEPTION 'La fiche historique a changé. Rechargez-la avant de compléter.' USING ERRCODE='40001'; END IF;
 END IF;
 IF p_expected_version IS NOT NULL AND ((old.id IS NULL AND existing.id IS NULL) OR (old.id IS NOT NULL AND old.version<>p_expected_version)) THEN RAISE EXCEPTION 'La fiche a changé. Rechargez-la avant de modifier.' USING ERRCODE='40001'; END IF;
 identity:=p_dossier->'identity'; org:=(p_dossier->>'organization_id')::uuid;
 IF identity->>'type_personne' IS DISTINCT FROM 'physique' OR identity->>'type_artisan' IS DISTINCT FROM 'collecteur' THEN RAISE EXCEPTION 'Un collecteur doit être une personne physique.' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(identity) k WHERE k<>ALL(ARRAY['type_personne','type_artisan','artisanal_site_id','exploitant_id','nom','prenoms','date_naissance','lieu_naissance','sexe','nationalite','telephone','whatsapp','whatsapp_identique','email','pays','region','commune','adresse','type_piece_identite','numero_piece_identite','date_delivrance_piece','date_expiration_piece','lieu_delivrance_piece','observations'])) THEN RAISE EXCEPTION 'Champs non autorisés dans le dossier.' USING ERRCODE='22023'; END IF;
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM public.snp_organizations WHERE id=org AND is_active AND organization_type IN('comptoir','sonasp')) THEN RAISE EXCEPTION 'Choisissez un comptoir actif ou la SONASP.' USING ERRCODE='23514'; END IF;
 IF old.id IS NULL AND EXISTS(SELECT 1 FROM public.snp_collector_accounts WHERE collector_id=p_id AND is_active AND comptoir_organization_id<>org) THEN RAISE EXCEPTION 'Conservez l’organisme du compte existant pendant la reprise du dossier.' USING ERRCODE='23514'; END IF;
 IF jsonb_typeof(p_dossier->'site_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Sites de collecte obligatoires.' USING ERRCODE='23514'; END IF;
 SELECT array_agg(DISTINCT x::uuid) INTO sites FROM jsonb_array_elements_text(p_dossier->'site_ids') x;
 IF coalesce(cardinality(sites),0)=0 OR EXISTS(SELECT 1 FROM unnest(sites) s WHERE NOT EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id=s)) THEN RAISE EXCEPTION 'Sélectionnez au moins un site existant.' USING ERRCODE='23514'; END IF;
 IF old.id IS NOT NULL AND old.organization_id<>org AND EXISTS(SELECT 1 FROM public.snp_collector_sales s JOIN public.snp_artisan_ventes_or sale_row ON sale_row.id=s.id WHERE s.collector_id=p_id AND s.status<>'rejected' AND coalesce(sale_row.statut,'') NOT IN('payee','annulee')) THEN
 RAISE EXCEPTION 'Clôturez les ventes en cours avant de changer l’organisme.' USING ERRCODE='23514'; END IF;
 SELECT * INTO v FROM jsonb_populate_record(NULL::public.snp_artisans_miniers,identity);
 IF existing.id IS NULL THEN
  INSERT INTO public.snp_artisans_miniers(id,type_personne,type_artisan,nom,prenoms,date_naissance,lieu_naissance,sexe,nationalite,telephone,whatsapp,whatsapp_identique,email,pays,region,commune,adresse,type_piece_identite,numero_piece_identite,date_delivrance_piece,date_expiration_piece,lieu_delivrance_piece,observations,created_by,updated_by,dossier_version)
  VALUES(p_id,'physique','collecteur',v.nom,v.prenoms,v.date_naissance,v.lieu_naissance,v.sexe,v.nationalite,v.telephone,v.whatsapp,coalesce(v.whatsapp_identique,false),v.email,v.pays,v.region,v.commune,v.adresse,v.type_piece_identite,v.numero_piece_identite,v.date_delivrance_piece,v.date_expiration_piece,v.lieu_delivrance_piece,v.observations,auth.uid(),auth.uid(),1);
 ELSE
  UPDATE public.snp_artisans_miniers SET nom=v.nom,prenoms=v.prenoms,date_naissance=v.date_naissance,lieu_naissance=v.lieu_naissance,sexe=v.sexe,nationalite=v.nationalite,telephone=v.telephone,whatsapp=v.whatsapp,whatsapp_identique=v.whatsapp_identique,email=v.email,pays=v.pays,region=v.region,commune=v.commune,adresse=v.adresse,type_piece_identite=v.type_piece_identite,numero_piece_identite=v.numero_piece_identite,date_delivrance_piece=v.date_delivrance_piece,date_expiration_piece=v.date_expiration_piece,lieu_delivrance_piece=v.lieu_delivrance_piece,observations=v.observations,updated_by=auth.uid(),dossier_version=1 WHERE id=p_id;
 END IF;
 IF old.id IS NULL THEN
  INSERT INTO public.snp_collectors(id,organization_id,creation_fingerprint,created_by) VALUES(p_id,org,fingerprint,auth.uid());
 ELSE
  UPDATE public.snp_collectors SET organization_id=org,version=version+1,updated_at=now(),
   payment_authorized_until=CASE WHEN organization_id=org THEN payment_authorized_until END,
   payment_authorized_by=CASE WHEN organization_id=org THEN payment_authorized_by END WHERE id=p_id;
  IF old.organization_id<>org THEN
   UPDATE public.snp_collector_accounts SET comptoir_organization_id=org WHERE collector_id=p_id AND is_active;
   UPDATE public.snp_collector_artisan_assignments SET valid_until=now() WHERE collector_id=p_id AND valid_until IS NULL;
  END IF;
 END IF;
 UPDATE public.snp_collector_sites SET valid_until=now() WHERE collector_id=p_id AND valid_until IS NULL AND NOT(site_id=ANY(sites));
 INSERT INTO public.snp_collector_sites(collector_id,site_id,assigned_by) SELECT p_id,s,auth.uid() FROM unnest(sites) s
 WHERE NOT EXISTS(SELECT 1 FROM public.snp_collector_sites WHERE collector_id=p_id AND site_id=s AND valid_until IS NULL);
 PERFORM public.snp_record_workflow_event('collector',p_id,CASE WHEN old.id IS NULL THEN 'created' ELSE 'updated' END,NULL,'active',NULL,
 'Enregistrement du dossier collecteur',jsonb_build_object('previous_organization_id',old.organization_id,'organization_id',org,'site_ids',sites));
 SELECT x INTO result FROM public.snp_list_collectors() x WHERE x->>'id'=p_id::text;
 RETURN result;
END $$;

-- A collector account cannot override its employer through a primary membership.
CREATE OR REPLACE FUNCTION public.snp_current_organization_id() RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(
 (SELECT c.organization_id FROM public.snp_collector_accounts ca JOIN public.snp_collectors c ON c.id=ca.collector_id
 JOIN public.snp_organizations o ON o.id=c.organization_id AND o.is_active
 WHERE ca.user_id=auth.uid() AND ca.is_active LIMIT 1),
 (SELECT m.organization_id FROM public.snp_user_organization_memberships m JOIN public.snp_organizations o ON o.id=m.organization_id AND o.is_active
 WHERE m.user_id=auth.uid() AND m.valid_from<=clock_timestamp() AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
 ORDER BY m.is_primary DESC,m.valid_from DESC LIMIT 1),
 (SELECT ca.comptoir_organization_id FROM public.snp_collector_accounts ca JOIN public.snp_organizations o ON o.id=ca.comptoir_organization_id AND o.is_active
 WHERE ca.user_id=auth.uid() AND ca.is_active ORDER BY ca.linked_at DESC LIMIT 1));
$$;
-- Only add site-based visibility for operational identities; historic assignments remain valid.
CREATE OR REPLACE FUNCTION public.snp_can_access_artisan(p_artisan_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.snp_actor_has_capability('collectors.manage') OR
 (public.snp_actor_has_capability('collector.operate') AND
 (p_artisan_id=public.snp_current_collector_id() OR EXISTS(SELECT 1 FROM public.snp_collector_sales s WHERE s.artisan_id=p_artisan_id AND s.collector_id=public.snp_current_collector_id()) OR EXISTS(SELECT 1 FROM public.snp_collector_artisan_assignments a
 WHERE a.artisan_id=p_artisan_id AND a.collector_id=public.snp_current_collector_id() AND a.valid_from<=clock_timestamp() AND (a.valid_until IS NULL OR a.valid_until>clock_timestamp()))
 OR EXISTS(SELECT 1 FROM public.snp_artisans_miniers a JOIN public.snp_collector_sites s ON s.site_id=a.artisanal_site_id
 JOIN public.snp_collectors c ON c.id=s.collector_id JOIN public.snp_organizations o ON o.id=c.organization_id AND o.is_active
 WHERE a.id=p_artisan_id AND a.type_artisan<>'collecteur' AND s.collector_id=public.snp_current_collector_id() AND s.valid_until IS NULL))) OR
 (public.snp_actor_has_capability('comptoir.manage') AND public.snp_current_organization_type()='comptoir' AND
 (EXISTS(SELECT 1 FROM public.snp_collector_artisan_assignments a WHERE a.artisan_id=p_artisan_id AND a.comptoir_organization_id=public.snp_current_organization_id()
 AND a.valid_from<=clock_timestamp() AND (a.valid_until IS NULL OR a.valid_until>clock_timestamp()))
 OR EXISTS(SELECT 1 FROM public.snp_collector_sales s WHERE s.artisan_id=p_artisan_id AND s.organization_id=public.snp_current_organization_id())));
$$;

CREATE FUNCTION public.snp_collector_set_payment_authorization(p_collector_id uuid,p_until timestamptz,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.snp_collectors; kind text;
BEGIN
 PERFORM public.snp_collector_strong_session();
 SELECT * INTO c FROM public.snp_collectors WHERE id=p_collector_id FOR UPDATE;
 SELECT organization_type INTO kind FROM public.snp_organizations WHERE id=c.organization_id AND is_active;
 IF c.id IS NULL OR public.snp_current_collector_id() IS NOT NULL OR public.snp_current_organization_id() IS DISTINCT FROM c.organization_id THEN RAISE EXCEPTION 'Seul l’organisme de rattachement peut déléguer le paiement.' USING ERRCODE='42501'; END IF;
 PERFORM public.snp_require_capability(CASE WHEN kind='comptoir' THEN 'comptoir.payments.execute' ELSE 'sonasp.finance.execute' END);
 IF length(trim(coalesce(p_reason,'')))<10 OR (p_until IS NOT NULL AND (p_until<=now() OR p_until>now()+interval '1 year')) THEN RAISE EXCEPTION 'Justification et échéance future de moins d’un an requises.' USING ERRCODE='22023'; END IF;
 UPDATE public.snp_collectors SET payment_authorized_until=p_until,payment_authorized_by=auth.uid(),version=version+1,updated_at=now() WHERE id=c.id;
 PERFORM public.snp_record_workflow_event('collector',c.id,'payment-delegation',NULL,CASE WHEN p_until IS NULL THEN 'revoked' ELSE 'authorized' END,NULL,p_reason,jsonb_build_object('until',p_until,'organization_id',c.organization_id));
END $$;
CREATE FUNCTION public.snp_collector_can_pay(p_sale_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT public.snp_actor_has_capability('collector.payments.execute') AND EXISTS(
 SELECT 1 FROM public.snp_collector_sales s JOIN public.snp_collectors c ON c.id=s.collector_id JOIN public.snp_artisans_miniers a ON a.id=c.id AND a.actif
 JOIN public.snp_organizations o ON o.id=c.organization_id AND o.is_active
 WHERE s.id=p_sale_id AND s.status='approved' AND c.id=public.snp_current_collector_id()
 AND c.organization_id=s.organization_id AND c.payment_authorized_until>clock_timestamp());
$$;
CREATE FUNCTION public.snp_collector_require_payment(p_sale_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.snp_collector_strong_session();
 IF NOT public.snp_collector_can_pay(p_sale_id) THEN RAISE EXCEPTION 'Paiement non autorisé : vente approuvée, habilitation et délégation valides requises.' USING ERRCODE='42501'; END IF;
 RETURN 'collector.payments.execute';
END $$;
CREATE FUNCTION public.snp_collector_sale_artisans() RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.snp_collector_strong_session(); PERFORM public.snp_require_capability('collector.operate');
 RETURN QUERY SELECT jsonb_build_object('id',a.id,'name',coalesce(a.raison_sociale,concat_ws(' ',a.prenoms,a.nom)),'site_id',s.site_id,'site_name',site.name)
 FROM public.snp_artisans_miniers a JOIN public.snp_collector_sites s ON s.site_id=a.artisanal_site_id
 JOIN public.artisanal_sites site ON site.id=s.site_id JOIN public.snp_collectors c ON c.id=s.collector_id
 JOIN public.snp_artisans_miniers collector ON collector.id=c.id AND collector.actif
 JOIN public.snp_organizations o ON o.id=c.organization_id AND o.is_active
 WHERE s.collector_id=public.snp_current_collector_id() AND s.valid_until IS NULL AND a.actif
 AND a.type_artisan<>'collecteur' AND public.snp_artisan_affiliation_eligible(a.id) ORDER BY a.nom;
END $$;

CREATE FUNCTION public.snp_collector_submit_sale(p_id uuid,p_sale jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.snp_collectors; old public.snp_collector_sales; a public.snp_artisans_miniers; orgtype text; quantity numeric; price numeric; purity numeric; sale_date date;
BEGIN
 PERFORM public.snp_collector_strong_session(); PERFORM public.snp_require_capability('collector.operate');
 SELECT * INTO c FROM public.snp_collectors WHERE id=public.snp_current_collector_id() FOR SHARE;
 IF c.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.snp_artisans_miniers WHERE id=c.id AND actif) THEN RAISE EXCEPTION 'Dossier collecteur actif requis.' USING ERRCODE='42501'; END IF;
 SELECT organization_type INTO orgtype FROM public.snp_organizations WHERE id=c.organization_id AND is_active;
 IF orgtype IS NULL OR p_id IS NULL THEN RAISE EXCEPTION 'Organisme actif et identifiant requis.' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,6145430));
 SELECT * INTO old FROM public.snp_collector_sales WHERE id=p_id;
 IF old.id IS NOT NULL THEN
 IF old.submitted_by=auth.uid() AND old.fingerprint=md5(p_sale::text) THEN RETURN old.id; END IF;
 RAISE EXCEPTION 'Identifiant de vente déjà utilisé.' USING ERRCODE='23505'; END IF;
 SELECT * INTO a FROM public.snp_artisans_miniers WHERE id=(p_sale->>'artisan_id')::uuid FOR SHARE;
 IF a.id IS NULL OR NOT a.actif OR a.type_artisan='collecteur' OR a.artisanal_site_id IS DISTINCT FROM (p_sale->>'site_id')::uuid
 OR NOT EXISTS(SELECT 1 FROM public.snp_collector_sites WHERE collector_id=c.id AND site_id=a.artisanal_site_id AND valid_until IS NULL)
 OR NOT public.snp_artisan_affiliation_eligible(a.id) THEN RAISE EXCEPTION 'Artisan actif avec affiliation valide et site autorisé requis.' USING ERRCODE='42501'; END IF;
 quantity:=(p_sale->>'quantity')::numeric; price:=(p_sale->>'price')::numeric; purity:=(p_sale->>'purity')::numeric; sale_date:=(p_sale->>'date')::date;
 IF quantity IS NULL OR NOT(quantity>0 AND quantity<1000000000) OR price IS NULL OR NOT(price>0 AND price<1000000000000)
 OR purity IS NULL OR NOT(purity>0 AND purity<=24) OR sale_date IS NULL OR sale_date>CURRENT_DATE OR
 coalesce(p_sale->>'gold_type','') NOT IN('poudre','lingot','pepites','bijoux','autre') THEN RAISE EXCEPTION 'Quantité, prix, pureté ou date invalides.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.snp_collector_sales(id,collector_id,artisan_id,organization_id,site_id,submitted_by,fingerprint)
 VALUES(p_id,c.id,a.id,c.organization_id,a.artisanal_site_id,auth.uid(),md5(p_sale::text));
 INSERT INTO public.snp_artisan_ventes_or(id,artisan_id,date_vente,quantite_grammes,type_or,purete_karat,prix_kg_fcfa,
 montant_brut_fcfa,tva_taux,tva_montant_fcfa,taxe_dev_comm_taux,taxe_dev_comm_montant_fcfa,montant_total_fcfa,
 numero_recu,observations,statut,created_by,updated_by,comptoir_organization_id,acheteur_comptoir_organization_id)
 VALUES(p_id,a.id,sale_date,quantity,p_sale->>'gold_type',purity,price,round(quantity*price/1000,2),18,0,1,0,round(quantity*price/1000*1.19,2),
 'COL-'||upper(replace(p_id::text,'-','')),left(p_sale->>'observations',2000),'en_attente',auth.uid(),auth.uid(),
 CASE WHEN orgtype='comptoir' THEN c.organization_id END,CASE WHEN orgtype='comptoir' THEN c.organization_id END);
 PERFORM public.snp_record_workflow_event('collector-sale',p_id,'submitted',NULL,'submitted','collector.operate','Vente soumise à l’organisme de rattachement',jsonb_build_object('collector_id',c.id,'organization_id',c.organization_id,'site_id',a.artisanal_site_id));
 RETURN p_id;
END $$;

-- Notifications aux titulaires sans compte: file SMTP existante, aucune fausse
CREATE FUNCTION public.snp_collector_workspace_artisans() RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.snp_collector_strong_session(); PERFORM public.snp_require_capability('collector.operate');
 RETURN QUERY SELECT DISTINCT a.id FROM public.snp_artisans_miniers a WHERE a.type_artisan<>'collecteur' AND (
 EXISTS(SELECT 1 FROM public.snp_collector_sites s WHERE s.collector_id=public.snp_current_collector_id() AND s.site_id=a.artisanal_site_id AND s.valid_until IS NULL)
 OR EXISTS(SELECT 1 FROM public.snp_collector_sales s WHERE s.collector_id=public.snp_current_collector_id() AND s.artisan_id=a.id));
END $$;
REVOKE ALL ON FUNCTION public.snp_collector_workspace_artisans() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_collector_workspace_artisans() TO authenticated;

-- Notifications aux titulaires sans compte: file SMTP existante, aucune fausse
-- notification « envoyée » si le contact n'est pas renseigné.
ALTER TABLE public.snp_notifications ALTER COLUMN destinataire_id DROP NOT NULL;
ALTER TABLE public.snp_notifications ADD COLUMN destinataire_artisan_id uuid REFERENCES public.snp_artisans_miniers(id);
ALTER TABLE public.snp_notifications ADD CONSTRAINT notification_recipient_required
 CHECK(destinataire_id IS NOT NULL OR destinataire_artisan_id IS NOT NULL);
CREATE UNIQUE INDEX notification_artisan_dedup ON public.snp_notifications(destinataire_artisan_id,cle_dedoublonnage)
 WHERE destinataire_artisan_id IS NOT NULL AND cle_dedoublonnage IS NOT NULL;
CREATE FUNCTION public.snp_collector_notify_member(p_artisan_id uuid,p_sale_id uuid,p_title text,p_body text,p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n uuid; contact text;
BEGIN
 SELECT email INTO contact FROM public.snp_artisans_miniers WHERE id=p_artisan_id;
 INSERT INTO public.snp_notifications(destinataire_artisan_id,type,gravite,titre,message,objet_domaine,objet_id,cle_dedoublonnage,emise_par)
 VALUES(p_artisan_id,'decision','normale',p_title,p_body,'vente',p_sale_id,p_key,auth.uid()) ON CONFLICT DO NOTHING RETURNING id INTO n;
 IF n IS NOT NULL AND nullif(trim(contact),'') IS NOT NULL THEN
 INSERT INTO public.snp_notifications_livraisons(notification_id,canal,destinataire,statut) VALUES(n,'courriel',contact,'en_attente');
 END IF;
END $$;
CREATE FUNCTION public.snp_collector_decide_sale(p_id uuid,p_expected_version integer,p_decision text,p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.snp_collector_sales; kind text; account uuid; title text; body text;
BEGIN
 PERFORM public.snp_collector_strong_session();
 SELECT * INTO s FROM public.snp_collector_sales WHERE id=p_id FOR UPDATE;
 IF s.id IS NULL OR public.snp_current_collector_id() IS NOT NULL OR public.snp_current_organization_id() IS DISTINCT FROM s.organization_id OR s.submitted_by=auth.uid() THEN
 RAISE EXCEPTION 'Seul l’organisme destinataire peut approuver la vente d’un autre acteur.' USING ERRCODE='42501'; END IF;
 SELECT organization_type INTO kind FROM public.snp_organizations WHERE id=s.organization_id AND is_active;
 IF kind IS NULL THEN RAISE EXCEPTION 'Organisme inactif.' USING ERRCODE='42501'; END IF;
 PERFORM public.snp_require_capability(CASE WHEN kind='comptoir' THEN 'comptoir.manage' ELSE 'sonasp.approve' END);
 IF p_decision NOT IN('approved','rejected') OR p_decision IS NULL THEN RAISE EXCEPTION 'Décision invalide.' USING ERRCODE='22023'; END IF;
 IF s.status=p_decision AND s.decided_by=auth.uid() AND coalesce(s.reason,'')=coalesce(nullif(trim(p_reason),''),'') THEN RETURN; END IF;
 IF s.status<>'submitted' OR s.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'La vente a déjà été traitée. Rechargez la liste.' USING ERRCODE='40001'; END IF;
 IF p_decision='rejected' AND length(trim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Expliquez le refus (10 caractères minimum).' USING ERRCODE='22023'; END IF;
 IF p_decision='approved' AND NOT public.snp_artisan_affiliation_eligible(s.artisan_id) THEN RAISE EXCEPTION 'L’affiliation de l’artisan doit être valide à la date de validation.' USING ERRCODE='23514'; END IF;
 UPDATE public.snp_collector_sales SET status=p_decision,version=version+1,decided_by=auth.uid(),decided_at=now(),reason=nullif(trim(p_reason),'') WHERE id=s.id;
 UPDATE public.snp_artisan_ventes_or SET statut=CASE WHEN p_decision='approved' THEN 'validee' ELSE 'annulee' END,version=version+1,updated_at=now(),updated_by=auth.uid() WHERE id=s.id;
 title:=CASE WHEN p_decision='approved' THEN 'Vente artisanale approuvée' ELSE 'Vente artisanale refusée' END;
 body:=CASE WHEN p_decision='approved' THEN 'Votre vente a été approuvée par l’organisme de rattachement. Le paiement fera l’objet d’un traitement distinct.' ELSE 'Votre vente a été refusée. Motif : '||trim(p_reason) END;
 SELECT user_id INTO account FROM public.snp_collector_accounts WHERE collector_id=s.collector_id AND is_active LIMIT 1;
 IF account IS NOT NULL THEN
 PERFORM public.snp_notifier(account,title,body,'decision','normale','vente',s.id,'/collecte/ventes',NULL,'collector-decision-'||s.id,true);
 ELSE PERFORM public.snp_collector_notify_member(s.collector_id,s.id,title,body,'collector-decision-'||s.id); END IF;
 PERFORM public.snp_collector_notify_member(s.artisan_id,s.id,title,body,'artisan-decision-'||s.id);
 PERFORM public.snp_record_workflow_event('collector-sale',s.id,p_decision,'submitted',p_decision,NULL,p_reason,jsonb_build_object('organization_id',s.organization_id,'collector_id',s.collector_id));
END $$;
CREATE FUNCTION public.snp_collector_sales() RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.snp_collector_strong_session();
 RETURN QUERY SELECT jsonb_build_object('id',s.id,'collector_id',s.collector_id,'collector_name',concat_ws(' ',c.prenoms,c.nom),
 'artisan_id',s.artisan_id,'artisan_name',coalesce(a.raison_sociale,concat_ws(' ',a.prenoms,a.nom)),'site_name',site.name,
 'organization_id',s.organization_id,'organization_name',o.name,'quantity',v.quantite_grammes,'total',v.montant_total_fcfa,'date',v.date_vente,
 'status',s.status,'version',s.version,'reason',s.reason,'invoice_id',v.facture_definitive_id,'payment_status',v.statut_paiement,
 'payment_id',(SELECT p.id FROM public.snp_artisan_paiements p WHERE p.vente_or_id=s.id AND p.statut NOT IN('annule','echec') ORDER BY p.created_at DESC LIMIT 1),
 'can_approve',s.status='submitted' AND s.submitted_by<>auth.uid() AND public.snp_current_collector_id() IS NULL AND s.organization_id=public.snp_current_organization_id()
 AND public.snp_actor_has_capability(CASE WHEN o.organization_type='comptoir' THEN 'comptoir.manage' ELSE 'sonasp.approve' END),
 'can_pay',s.status='approved' AND (public.snp_collector_can_pay(s.id) OR (public.snp_current_collector_id() IS NULL AND s.organization_id=public.snp_current_organization_id()
 AND public.snp_actor_has_capability(CASE WHEN o.organization_type='comptoir' THEN 'comptoir.payments.execute' ELSE 'sonasp.finance.execute' END))),
 'can_issue_invoice',o.is_active AND s.status='approved' AND public.snp_current_collector_id() IS NULL AND s.organization_id=public.snp_current_organization_id() AND public.snp_actor_has_capability(CASE WHEN o.organization_type='comptoir' THEN 'comptoir.invoices.issue' ELSE 'sonasp.prepare' END),
 'notifications',(SELECT coalesce(jsonb_agg(jsonb_build_object('recipient',CASE WHEN n.destinataire_artisan_id=s.artisan_id THEN 'Artisan' ELSE 'Collecteur' END,
 'status',coalesce((SELECT CASE WHEN bool_or(l.statut='envoye') THEN 'envoye' WHEN bool_or(l.statut='en_attente') THEN 'en_attente' ELSE 'echec' END
 FROM public.snp_notifications_livraisons l WHERE l.notification_id=n.id AND l.canal='courriel'),'contact_manquant'))),'[]')
 FROM public.snp_notifications n WHERE n.objet_id=s.id AND n.objet_domaine='vente'))
 FROM public.snp_collector_sales s JOIN public.snp_artisan_ventes_or v ON v.id=s.id JOIN public.snp_artisans_miniers a ON a.id=s.artisan_id
 JOIN public.snp_artisans_miniers c ON c.id=s.collector_id JOIN public.artisanal_sites site ON site.id=s.site_id JOIN public.snp_organizations o ON o.id=s.organization_id
 WHERE public.snp_collector_org_access(s.organization_id) OR (s.collector_id=public.snp_current_collector_id() AND public.snp_actor_has_capability('collector.operate'))
 ORDER BY s.submitted_at DESC;
END $$;
-- Restrictive policies also protect existing generic financial screens.
CREATE FUNCTION public.snp_collector_sale_visible(p_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT (NOT EXISTS(SELECT 1 FROM public.snp_collector_sales WHERE id=p_id) AND
 (public.snp_current_collector_id() IS NULL OR EXISTS(SELECT 1 FROM public.snp_artisan_ventes_or v JOIN public.snp_collector_artisan_assignments a ON a.artisan_id=v.artisan_id
 WHERE v.id=p_id AND a.collector_id=public.snp_current_collector_id() AND a.valid_from<=clock_timestamp() AND (a.valid_until IS NULL OR a.valid_until>clock_timestamp())))) OR EXISTS(
 SELECT 1 FROM public.snp_collector_sales s WHERE s.id=p_id AND (public.snp_collector_org_access(s.organization_id)
 OR (s.collector_id=public.snp_current_collector_id() AND public.snp_collector_visible(s.collector_id))));
$$;
CREATE POLICY collector_sale_boundary ON public.snp_artisan_ventes_or AS RESTRICTIVE FOR ALL TO authenticated USING(public.snp_collector_sale_visible(id)) WITH CHECK(public.snp_collector_sale_visible(id));
CREATE POLICY collector_invoice_boundary ON public.snp_artisan_factures_definitives AS RESTRICTIVE FOR ALL TO authenticated USING(public.snp_collector_sale_visible(vente_or_id)) WITH CHECK(public.snp_collector_sale_visible(vente_or_id));
CREATE POLICY collector_payment_boundary ON public.snp_artisan_paiements AS RESTRICTIVE FOR ALL TO authenticated USING(public.snp_collector_sale_visible(vente_or_id)) WITH CHECK(public.snp_collector_sale_visible(vente_or_id));
CREATE FUNCTION public.snp_collector_finance_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.snp_collector_sales;
BEGIN
 SELECT * INTO s FROM public.snp_collector_sales WHERE id=NEW.vente_or_id;
 IF s.id IS NOT NULL THEN
  IF s.status<>'approved' THEN RAISE EXCEPTION 'Approbation de l’organisme requise avant facturation ou paiement.' USING ERRCODE='23514'; END IF;
  IF public.snp_current_collector_id() IS NOT NULL THEN
   PERFORM public.snp_collector_require_payment(s.id);
  ELSIF public.snp_current_organization_id() IS DISTINCT FROM s.organization_id THEN
   RAISE EXCEPTION 'Opération financière hors organisme destinataire.' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER collector_invoice_guard BEFORE INSERT OR UPDATE ON public.snp_artisan_factures_definitives FOR EACH ROW EXECUTE FUNCTION public.snp_collector_finance_guard();
CREATE TRIGGER collector_payment_guard BEFORE INSERT OR UPDATE ON public.snp_artisan_paiements FOR EACH ROW EXECUTE FUNCTION public.snp_collector_finance_guard();

-- Generic identity updates must preserve the collector's physical-person invariant.
CREATE FUNCTION public.snp_guard_collector_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.snp_collectors WHERE id=NEW.id)
 AND (NEW.type_personne IS DISTINCT FROM 'physique' OR NEW.type_artisan IS DISTINCT FROM 'collecteur') THEN
 RAISE EXCEPTION 'Le dossier collecteur doit rester une personne physique de type collecteur.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.snp_guard_collector_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER collector_identity_guard BEFORE UPDATE ON public.snp_artisans_miniers FOR EACH ROW EXECUTE FUNCTION public.snp_guard_collector_identity();

CREATE FUNCTION public.snp_check_collector_sale_change(p_old public.snp_artisan_ventes_or,p_new public.snp_artisan_ventes_or,p_operation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.snp_collector_sales; kind text;
BEGIN
 PERFORM public.snp_collector_strong_session();
 SELECT * INTO s FROM public.snp_collector_sales WHERE id=coalesce(p_new.id,p_old.id);
 IF p_operation='DELETE' THEN RAISE EXCEPTION 'Une vente soumise est conservée dans l’historique.' USING ERRCODE='42501'; END IF;
 IF p_operation='INSERT' THEN
  IF s.submitted_by IS DISTINCT FROM auth.uid() OR s.collector_id IS DISTINCT FROM public.snp_current_collector_id() OR s.artisan_id IS DISTINCT FROM p_new.artisan_id THEN
   RAISE EXCEPTION 'Utilisez le circuit de collecte sécurisé.' USING ERRCODE='42501'; END IF;
  RETURN;
 END IF;
 IF (to_jsonb(p_old)-ARRAY['statut','statut_paiement','statut_validation','facture_definitive_id','version','updated_at','updated_by'])
 IS DISTINCT FROM (to_jsonb(p_new)-ARRAY['statut','statut_paiement','statut_validation','facture_definitive_id','version','updated_at','updated_by']) THEN
 RAISE EXCEPTION 'Les données de la vente soumise sont immuables.' USING ERRCODE='42501'; END IF;
 IF current_setting('sonasp.artisan_finance_rpc',true)='1' AND s.status='approved' THEN
  IF public.snp_current_collector_id() IS NOT NULL THEN PERFORM public.snp_collector_require_payment(s.id);
  ELSIF public.snp_current_organization_id() IS DISTINCT FROM s.organization_id THEN RAISE EXCEPTION 'Périmètre financier interdit.' USING ERRCODE='42501'; END IF;
  RETURN;
 END IF;
 IF p_old.statut='en_attente' AND p_new.statut=(CASE s.status WHEN 'approved' THEN 'validee' WHEN 'rejected' THEN 'annulee' END)
 AND s.decided_by=auth.uid() AND s.organization_id=public.snp_current_organization_id() AND public.snp_current_collector_id() IS NULL THEN
  SELECT organization_type INTO kind FROM public.snp_organizations WHERE id=s.organization_id AND is_active;
  PERFORM public.snp_require_capability(CASE WHEN kind='comptoir' THEN 'comptoir.manage' ELSE 'sonasp.approve' END);
  RETURN;
 END IF;
 RAISE EXCEPTION 'Utilisez l’approbation de collecte ou le circuit de paiement.' USING ERRCODE='42501';
END $$;
CREATE OR REPLACE FUNCTION public.snp_guard_artisan_gold_sale_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  -- Les traitements d'administration hors JWT restent possibles pour les
  -- migrations contrôlées. Toute requête navigateur est strictement gouvernée.
  IF v_actor IS NULL OR coalesce(auth.role(),'')='service_role' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF EXISTS(SELECT 1 FROM public.snp_collector_sales WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END) THEN
    PERFORM public.snp_check_collector_sale_change(OLD,NEW,TG_OP);
    RETURN NEW;
  ELSIF TG_OP='INSERT' AND public.snp_current_collector_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Le collecteur doit soumettre la vente au circuit d’approbation.' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.created_by:=v_actor;
    NEW.updated_by:=v_actor;
    NEW.statut:='en_attente';
    RETURN NEW;
  END IF;

  IF TG_OP='DELETE' THEN
    IF OLD.statut<>'en_attente' OR OLD.created_by IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Seul l’auteur peut supprimer sa vente encore en attente.' USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.comptoir_organization_id IS DISTINCT FROM OLD.comptoir_organization_id
     OR NEW.acheteur_comptoir_organization_id IS DISTINCT FROM OLD.acheteur_comptoir_organization_id THEN
    RAISE EXCEPTION 'L’auteur et le périmètre de la vente sont immuables.' USING ERRCODE='42501';
  END IF;

  IF OLD.statut<>'en_attente' AND (
    NEW.artisan_id IS DISTINCT FROM OLD.artisan_id
    OR NEW.date_vente IS DISTINCT FROM OLD.date_vente
    OR NEW.quantite_grammes IS DISTINCT FROM OLD.quantite_grammes
    OR NEW.type_or IS DISTINCT FROM OLD.type_or
    OR NEW.purete_karat IS DISTINCT FROM OLD.purete_karat
    OR NEW.prix_kg_fcfa IS DISTINCT FROM OLD.prix_kg_fcfa
    OR NEW.tva_taux IS DISTINCT FROM OLD.tva_taux
    OR NEW.taxe_dev_comm_taux IS DISTINCT FROM OLD.taxe_dev_comm_taux
  ) THEN
    RAISE EXCEPTION 'Les données d’une vente validée sont immuables.' USING ERRCODE='42501';
  END IF;

  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    IF OLD.statut='en_attente' AND NEW.statut='validee' THEN
      PERFORM public.snp_require_capability('sonasp.approve');
      IF OLD.created_by=v_actor THEN
        RAISE EXCEPTION 'L’auteur ne peut pas valider sa propre vente.' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.statut='validee' AND NEW.statut='payee' THEN
      PERFORM public.snp_require_capability('sonasp.finance.execute');
      IF OLD.created_by=v_actor THEN
        RAISE EXCEPTION 'L’auteur ne peut pas exécuter le paiement de sa vente.' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.statut='en_attente' AND NEW.statut='annulee' THEN
      IF OLD.created_by IS DISTINCT FROM v_actor
         AND NOT public.snp_actor_has_capability('sonasp.approve') THEN
        RAISE EXCEPTION 'Seul l’auteur ou un approbateur peut annuler ce brouillon.' USING ERRCODE='42501';
      END IF;
    ELSIF OLD.statut='validee' AND NEW.statut='annulee' THEN
      PERFORM public.snp_require_capability('sonasp.approve');
    ELSE
      RAISE EXCEPTION 'Transition de vente artisanale interdite : % -> %.',OLD.statut,NEW.statut USING ERRCODE='22023';
    END IF;
  ELSIF OLD.statut='en_attente'
        AND OLD.created_by IS NOT NULL
        AND OLD.created_by<>v_actor
        AND NOT public.snp_actor_has_capability('sonasp.prepare') THEN
    RAISE EXCEPTION 'Seul l’auteur ou un gestionnaire habilité peut corriger le brouillon.' USING ERRCODE='42501';
  END IF;

  NEW.updated_by:=v_actor;
  NEW.updated_at:=now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snp_artisan_creer_paiement(p_facture_id uuid, p_expected_facture_statut text, p_expected_facture_version bigint, p_moyen_paiement_id uuid, p_idempotency_key uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
  v_moyen public.snp_artisan_moyens_paiement%ROWTYPE;
  v_paiement public.snp_artisan_paiements%ROWTYPE;
  v_capability text;
  v_type text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF p_facture_id IS NULL OR p_moyen_paiement_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_facture_statut IS NULL OR p_expected_facture_version IS NULL THEN
    RAISE EXCEPTION 'Facture, moyen, état/version attendus et idempotence sont obligatoires.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_facture FROM public.snp_artisan_factures_definitives WHERE id=p_facture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture artisanale introuvable.' USING ERRCODE='P0002'; END IF;
  IF public.snp_current_collector_id() IS NOT NULL THEN
    v_capability:=public.snp_collector_require_payment(v_facture.vente_or_id);
  ELSE
    v_capability:=public.snp_4i_capability_for_scope(v_facture.comptoir_organization_id,'comptoir.payments.execute','sonasp.finance.execute');
  END IF;
  v_replay:=public.snp_4i_idempotency_reserve(
    p_idempotency_key,'payment.create',p_facture_id,v_facture.comptoir_organization_id,
    jsonb_build_object(
      'invoice_id',p_facture_id,'expected_status',p_expected_facture_statut,
      'expected_version',p_expected_facture_version,
      'payment_method_id',p_moyen_paiement_id,'notes',nullif(trim(p_notes),'')
    ),v_capability
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay||jsonb_build_object('replayed',true);
  END IF;

  SELECT * INTO v_facture FROM public.snp_artisan_factures_definitives
  WHERE id=p_facture_id FOR UPDATE;
  SELECT * INTO v_vente FROM public.snp_artisan_ventes_or
  WHERE id=v_facture.vente_or_id FOR UPDATE;
  IF v_facture.statut IS DISTINCT FROM p_expected_facture_statut
     OR v_facture.version IS DISTINCT FROM p_expected_facture_version THEN
    RAISE EXCEPTION 'Conflit facture : état/version attendus %/%, courants %/%.',
      p_expected_facture_statut,p_expected_facture_version,v_facture.statut,v_facture.version
      USING ERRCODE='40001';
  END IF;
  IF v_facture.statut IS DISTINCT FROM 'emise'
     OR v_facture.certification_dgi_status IS DISTINCT FROM 'certified' THEN
    RAISE EXCEPTION 'Une facture émise et certifiée DGI est requise.' USING ERRCODE='23514';
  END IF;
  IF v_vente.id IS NULL
     OR v_facture.artisan_id IS DISTINCT FROM v_vente.artisan_id
     OR v_facture.comptoir_organization_id IS DISTINCT FROM v_vente.comptoir_organization_id
     OR v_vente.facture_definitive_id IS DISTINCT FROM v_facture.id THEN
    RAISE EXCEPTION 'Facture et vente ne partagent pas leur parent/tenant.' USING ERRCODE='23503';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.snp_artisan_paiements
    WHERE facture_id=p_facture_id AND statut NOT IN('annule','echec')
  ) THEN
    RAISE EXCEPTION 'Un paiement actif existe déjà pour cette facture.' USING ERRCODE='23505';
  END IF;

  SELECT * INTO v_moyen FROM public.snp_artisan_moyens_paiement
  WHERE id=p_moyen_paiement_id FOR SHARE;
  IF NOT FOUND OR v_moyen.artisan_id IS DISTINCT FROM v_facture.artisan_id THEN
    RAISE EXCEPTION 'Moyen de paiement absent du dossier artisan.' USING ERRCODE='23514';
  END IF;
  IF NOT v_moyen.actif OR v_moyen.verifie_le IS NULL THEN
    RAISE EXCEPTION 'Le moyen de paiement doit être actif et vérifié.' USING ERRCODE='23514';
  END IF;
  v_type:=CASE v_moyen.type WHEN 'especes' THEN 'cash' ELSE v_moyen.type END;
  IF v_type NOT IN(
    'virement_bancaire','cash','orange_money','mobile_money',
    'moov_money','wave','cheque'
  ) THEN
    RAISE EXCEPTION 'Type de paiement non supporté : %.',v_moyen.type USING ERRCODE='22023';
  END IF;

  PERFORM set_config('sonasp.artisan_finance_rpc','1',true);
  BEGIN
    INSERT INTO public.snp_artisan_paiements(
      reference_paiement,facture_id,vente_or_id,artisan_id,
      moyen_paiement_id,numero_facture,type_paiement,montant_paye,
      montant_taxes_retenues,details_paiement,statut,date_paiement,
      traite_par,notes,comptoir_organization_id,version
    ) VALUES(
      format('PA-ART-%s-%s',to_char(current_date,'YYYYMMDD'),
             upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
      v_facture.id,v_vente.id,v_facture.artisan_id,v_moyen.id,
      v_facture.numero_facture,v_type,v_facture.montant_net_a_payer,
      v_facture.montant_total_taxes,public.snp_4b_payment_snapshot(v_moyen),
      'en_attente',now(),auth.uid(),nullif(trim(p_notes),''),
      v_facture.comptoir_organization_id,0
    ) RETURNING * INTO v_paiement;

    UPDATE public.snp_artisan_factures_definitives
    SET statut='en_paiement',version=version+1,updated_at=now()
    WHERE id=v_facture.id RETURNING * INTO v_facture;
    UPDATE public.snp_artisan_ventes_or
    SET statut_paiement='en_paiement',version=version+1,
        updated_by=auth.uid(),updated_at=now()
    WHERE id=v_vente.id RETURNING * INTO v_vente;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.artisan_finance_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.artisan_finance_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_paiement.id,'invoice_id',v_facture.id,'sale_id',v_vente.id,
    'artisan_id',v_paiement.artisan_id,'payment_reference',v_paiement.reference_paiement,
    'payment_status',v_paiement.statut,'payment_version',v_paiement.version,
    'invoice_status',v_facture.statut,'invoice_version',v_facture.version,
    'sale_status',v_vente.statut,'sale_payment_status',v_vente.statut_paiement,
    'sale_version',v_vente.version,'amount_paid',v_paiement.montant_paye,
    'taxes_withheld',v_paiement.montant_taxes_retenues,
    'payment_method_id',v_paiement.moyen_paiement_id,'payment_type',v_paiement.type_paiement,
    'idempotency_key',p_idempotency_key,'replayed',false,'processed_at',now()
  );
  PERFORM public.snp_record_workflow_event(
    'artisan-payment',v_paiement.id,'created',NULL,'en_attente',v_capability,p_notes,
    jsonb_build_object('invoice_id',v_facture.id,'sale_id',v_vente.id,
                       'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4i_idempotency_complete(p_idempotency_key,v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snp_artisan_transition_paiement(p_paiement_id uuid, p_expected_statut text, p_expected_version bigint, p_nouveau_statut text, p_idempotency_key uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_paiement public.snp_artisan_paiements%ROWTYPE;
  v_facture public.snp_artisan_factures_definitives%ROWTYPE;
  v_vente public.snp_artisan_ventes_or%ROWTYPE;
  v_capability text;
  v_comptoir_capability text;
  v_sonasp_capability text;
  v_replay jsonb;
  v_result jsonb;
BEGIN
  IF p_paiement_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_statut IS NULL OR p_expected_version IS NULL
     OR p_nouveau_statut IS NULL THEN
    RAISE EXCEPTION 'Paiement, transition/version et idempotence sont obligatoires.' USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='valide' THEN
    v_comptoir_capability:='comptoir.payments.reconcile';
    v_sonasp_capability:='sonasp.finance.reconcile';
  ELSE
    v_comptoir_capability:='comptoir.payments.execute';
    v_sonasp_capability:='sonasp.finance.execute';
  END IF;

  SELECT * INTO v_paiement FROM public.snp_artisan_paiements WHERE id=p_paiement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement artisan introuvable.' USING ERRCODE='P0002'; END IF;
  IF public.snp_current_collector_id() IS NOT NULL THEN
    IF p_nouveau_statut='valide' THEN RAISE EXCEPTION 'Le contrôle du paiement appartient à l’organisme.' USING ERRCODE='42501'; END IF;
    v_capability:=public.snp_collector_require_payment(v_paiement.vente_or_id);
  ELSE
    v_capability:=public.snp_4i_capability_for_scope(v_paiement.comptoir_organization_id,v_comptoir_capability,v_sonasp_capability);
  END IF;
  v_replay:=public.snp_4i_idempotency_reserve(
    p_idempotency_key,'payment.transition',p_paiement_id,
    v_paiement.comptoir_organization_id,
    jsonb_build_object(
      'payment_id',p_paiement_id,'expected_status',p_expected_statut,
      'expected_version',p_expected_version,'new_status',p_nouveau_statut,
      'notes',nullif(trim(p_notes),'')
    ),v_capability
  );
  IF v_replay IS NOT NULL THEN
    RETURN v_replay||jsonb_build_object('replayed',true);
  END IF;

  SELECT * INTO v_paiement FROM public.snp_artisan_paiements
  WHERE id=p_paiement_id FOR UPDATE;
  SELECT * INTO v_facture FROM public.snp_artisan_factures_definitives
  WHERE id=v_paiement.facture_id FOR UPDATE;
  SELECT * INTO v_vente FROM public.snp_artisan_ventes_or
  WHERE id=v_paiement.vente_or_id FOR UPDATE;
  IF v_paiement.statut IS DISTINCT FROM p_expected_statut
     OR v_paiement.version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Conflit paiement : état/version attendus %/%, courants %/%.',
      p_expected_statut,p_expected_version,v_paiement.statut,v_paiement.version
      USING ERRCODE='40001';
  END IF;
  IF NOT (
    (v_paiement.statut='en_attente' AND p_nouveau_statut IN('en_traitement','annule','echec'))
    OR (v_paiement.statut='en_traitement' AND p_nouveau_statut IN('valide','annule','echec'))
    OR (v_paiement.statut='valide' AND p_nouveau_statut IN('complete','annule','echec'))
  ) THEN
    RAISE EXCEPTION 'Transition de paiement interdite : % vers %.',
      v_paiement.statut,p_nouveau_statut USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut IN('annule','echec')
     AND length(trim(coalesce(p_notes,'')))<10 THEN
    RAISE EXCEPTION 'Annulation/échec : motif de dix caractères minimum.' USING ERRCODE='22023';
  END IF;
  IF p_nouveau_statut='valide' AND auth.uid()=v_paiement.traite_par THEN
    RAISE EXCEPTION 'Le préparateur ne valide pas son propre paiement.' USING ERRCODE='42501';
  END IF;
  IF p_nouveau_statut='complete' THEN
    IF auth.uid()=v_paiement.valide_par THEN
      RAISE EXCEPTION 'Le validateur ne clôture pas le paiement qu’il a contrôlé.' USING ERRCODE='42501';
    END IF;
    IF v_facture.certification_dgi_status IS DISTINCT FROM 'certified'
       OR length(trim(coalesce(v_paiement.preuve_paiement_url,'')))<5 THEN
      RAISE EXCEPTION 'Certification DGI et preuve de paiement canonique requises.' USING ERRCODE='23514';
    END IF;
  END IF;

  IF v_facture.id IS NULL OR v_vente.id IS NULL
     OR v_facture.vente_or_id IS DISTINCT FROM v_vente.id
     OR v_paiement.artisan_id IS DISTINCT FROM v_facture.artisan_id
     OR v_paiement.comptoir_organization_id IS DISTINCT FROM v_facture.comptoir_organization_id
     OR v_facture.comptoir_organization_id IS DISTINCT FROM v_vente.comptoir_organization_id THEN
    RAISE EXCEPTION 'Paiement, facture et vente divergent sur parent/tenant.' USING ERRCODE='23503';
  END IF;

  PERFORM set_config('sonasp.artisan_finance_rpc','1',true);
  BEGIN
    UPDATE public.snp_artisan_paiements
    SET statut=p_nouveau_statut,version=version+1,
        date_validation=CASE WHEN p_nouveau_statut='valide' THEN now() ELSE date_validation END,
        valide_par=CASE WHEN p_nouveau_statut='valide' THEN auth.uid() ELSE valide_par END,
        date_completion=CASE WHEN p_nouveau_statut='complete' THEN now() ELSE date_completion END,
        completed_by=CASE WHEN p_nouveau_statut='complete' THEN auth.uid() ELSE completed_by END,
        cancelled_by=CASE WHEN p_nouveau_statut='annule' THEN auth.uid() ELSE cancelled_by END,
        failed_by=CASE WHEN p_nouveau_statut='echec' THEN auth.uid() ELSE failed_by END,
        terminal_reason=CASE WHEN p_nouveau_statut IN('annule','echec') THEN trim(p_notes) ELSE terminal_reason END,
        notes=coalesce(nullif(trim(p_notes),''),notes),updated_at=now()
    WHERE id=v_paiement.id RETURNING * INTO v_paiement;

    IF p_nouveau_statut='complete' THEN
      UPDATE public.snp_artisan_factures_definitives
      SET statut='payee',version=version+1,updated_at=now()
      WHERE id=v_facture.id RETURNING * INTO v_facture;
      UPDATE public.snp_artisan_ventes_or
      SET statut='payee',statut_paiement='paye',version=version+1,
          updated_by=auth.uid(),updated_at=now()
      WHERE id=v_vente.id RETURNING * INTO v_vente;

      INSERT INTO public.snp_artisan_taxes_retenues(
        paiement_id,facture_id,vente_or_id,artisan_id,type_taxe,libelle_taxe,
        taux_taxe,montant_taxe,statut_reversement,periode_fiscale,
        exercice_fiscal,comptoir_organization_id,version
      ) SELECT
        v_paiement.id,v_facture.id,v_vente.id,v_paiement.artisan_id,
        tax.code,tax.label,tax.rate,tax.amount,'a_reverser',
        to_char(v_paiement.date_completion,'YYYY-MM'),
        to_char(v_paiement.date_completion,'YYYY'),
        v_paiement.comptoir_organization_id,0
      FROM (VALUES
        ('tva','Taxe sur la valeur ajoutée',coalesce(v_facture.taux_tva,0),coalesce(v_facture.montant_taxe_tva,0)),
        ('retenue_source','Retenue à la source',coalesce(v_facture.taux_retenue_source,0),coalesce(v_facture.montant_taxe_retenue_source,0)),
        ('taxe_municipale','Taxe de développement communal',
          CASE WHEN v_facture.montant_brut>0 THEN round(coalesce(v_facture.montant_autres_taxes,0)*100/v_facture.montant_brut,4) ELSE 0 END,
          coalesce(v_facture.montant_autres_taxes,0))
      ) AS tax(code,label,rate,amount)
      WHERE tax.amount>0
      ON CONFLICT(paiement_id,type_taxe) DO NOTHING;
    ELSIF p_nouveau_statut IN('annule','echec') THEN
      UPDATE public.snp_artisan_factures_definitives
      SET statut='emise',version=version+1,updated_at=now()
      WHERE id=v_facture.id RETURNING * INTO v_facture;
      UPDATE public.snp_artisan_ventes_or
      SET statut='validee',statut_paiement='facture_emise',version=version+1,
          updated_by=auth.uid(),updated_at=now()
      WHERE id=v_vente.id RETURNING * INTO v_vente;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.artisan_finance_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.artisan_finance_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_paiement.id,'invoice_id',v_facture.id,'sale_id',v_vente.id,
    'artisan_id',v_paiement.artisan_id,'payment_reference',v_paiement.reference_paiement,
    'payment_status',v_paiement.statut,'payment_version',v_paiement.version,
    'invoice_status',v_facture.statut,'invoice_version',v_facture.version,
    'sale_status',v_vente.statut,'sale_payment_status',v_vente.statut_paiement,
    'sale_version',v_vente.version,'amount_paid',v_paiement.montant_paye,
    'taxes_withheld',v_paiement.montant_taxes_retenues,
    'payment_method_id',v_paiement.moyen_paiement_id,'payment_type',v_paiement.type_paiement,
    'idempotency_key',p_idempotency_key,'replayed',false,'processed_at',now()
  );
  PERFORM public.snp_record_workflow_event(
    'artisan-payment',v_paiement.id,'status-changed',p_expected_statut,p_nouveau_statut,
    v_capability,p_notes,jsonb_build_object('invoice_id',v_facture.id,'sale_id',v_vente.id,
                                            'idempotency_key',p_idempotency_key)
  );
  PERFORM public.snp_4i_idempotency_complete(p_idempotency_key,v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snp_link_collector_account(p_user_id uuid, p_collector_id uuid, p_comptoir_organization_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
  PERFORM public.snp_require_capability('collectors.manage');
  PERFORM public.snp_collector_strong_session();
  IF EXISTS(SELECT 1 FROM public.snp_collectors WHERE id=p_collector_id AND organization_id<>p_comptoir_organization_id) THEN RAISE EXCEPTION 'Le compte doit reprendre l’organisme du dossier collecteur.' USING ERRCODE='23514'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'Le rattachement du collecteur doit être justifié.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_artisans_miniers
    WHERE id = p_collector_id AND actif AND type_artisan = 'collecteur' AND type_personne='physique'
  ) THEN
    RAISE EXCEPTION 'Le profil collecteur est introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.snp_organizations
    WHERE id = p_comptoir_organization_id
      AND organization_type IN ('comptoir','sonasp') AND is_active
  ) THEN
    RAISE EXCEPTION 'Le comptoir est introuvable ou inactif.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.snp_collector_accounts
  SET is_active = false, unlinked_at = now()
  WHERE (user_id = p_user_id OR collector_id = p_collector_id) AND is_active;

  INSERT INTO public.snp_collector_accounts (
    user_id, collector_id, comptoir_organization_id, linked_by, reason
  ) VALUES (
    p_user_id, p_collector_id, p_comptoir_organization_id, auth.uid(), trim(p_reason)
  ) RETURNING id INTO v_id;

  INSERT INTO public.snp_user_capabilities (
    user_id, capability_code, allowed, reason, granted_by
  ) VALUES (
    p_user_id, 'collector.operate', true, trim(p_reason), auth.uid()
  )
  ON CONFLICT (user_id, capability_code) DO UPDATE
  SET allowed = true, valid_from = now(), valid_until = NULL,
      reason = EXCLUDED.reason, granted_by = EXCLUDED.granted_by, granted_at = now();

  PERFORM public.snp_record_workflow_event(
    'collector-account', v_id, 'collector-linked', NULL, 'active',
    'collectors.manage', p_reason,
    jsonb_build_object(
      'user_id', p_user_id,
      'collector_id', p_collector_id,
      'comptoir_organization_id', p_comptoir_organization_id
    )
  );
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snp_configurer_acces_compte(p_user_id uuid, p_full_name text, p_phone text, p_role text, p_is_active boolean, p_mining_company_id uuid, p_organization_id uuid, p_collector_id uuid, p_responsibilities jsonb, p_permissions jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_role text; v_target_role text; v_expected_org text; v_org_type text; v_effective_org uuid;
  v_status_context text;
  v_membership_changed_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('snp-account-administration',0));
  PERFORM 1 FROM public.user_profiles WHERE id IN(auth.uid(),p_user_id) ORDER BY id FOR UPDATE;
  IF NOT public.snp_peut_administrer_compte(p_user_id) THEN
    RAISE EXCEPTION 'Vous ne pouvez pas administrer ce compte.' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_actor_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  SELECT role INTO v_target_role FROM public.user_profiles WHERE id=p_user_id;
  IF p_role IS NULL OR NOT (
    p_role IN('owner','admin','management','dgmg','dgi','mine','comptoir','collector','customer')
    OR (p_role=v_target_role AND p_role IN('manager','factory','airport','refinery'))
  ) OR (v_actor_role<>'owner' AND public.snp_niveau_role(p_role)>=public.snp_niveau_role(v_actor_role)) THEN
    RAISE EXCEPTION 'Rôle non attribuable par ce compte.' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_full_name),'') IS NULL THEN RAISE EXCEPTION 'Le nom complet est obligatoire.' USING ERRCODE='22023'; END IF;
  PERFORM public.snp_validate_responsibilities(p_role,p_responsibilities);
  SELECT organization_type INTO v_expected_org FROM public.snp_access_role_policies WHERE role=p_role;
  IF p_role='collector' THEN
    SELECT organization_type INTO v_expected_org FROM public.snp_organizations WHERE id=p_organization_id AND organization_type IN('comptoir','sonasp') AND is_active;
    IF v_expected_org IS NULL OR EXISTS(SELECT 1 FROM public.snp_collectors WHERE id=p_collector_id AND organization_id IS DISTINCT FROM p_organization_id) THEN
      RAISE EXCEPTION 'Le compte doit reprendre le comptoir ou la SONASP du dossier collecteur.' USING ERRCODE='42501';
    END IF;
  END IF;
  v_effective_org:=p_organization_id;
  IF p_role='mine' THEN
    IF p_mining_company_id IS NULL THEN RAISE EXCEPTION 'La société minière est obligatoire.' USING ERRCODE='23502'; END IF;
    SELECT id INTO v_effective_org FROM public.snp_organizations
    WHERE mining_company_id=p_mining_company_id AND organization_type='mine' AND is_active LIMIT 1;
    IF v_effective_org IS NULL THEN RAISE EXCEPTION 'Organisation minière active introuvable.' USING ERRCODE='23503'; END IF;
  ELSIF p_role IN('owner','admin','management') THEN
    IF v_effective_org IS NOT NULL THEN
      SELECT organization_type INTO v_org_type FROM public.snp_organizations WHERE id=v_effective_org AND is_active;
      IF v_org_type IS DISTINCT FROM 'sonasp' THEN RAISE EXCEPTION 'Le compte national doit relever de la SONASP.' USING ERRCODE='42501'; END IF;
    END IF;
  ELSIF EXISTS(SELECT 1 FROM public.snp_access_role_policies WHERE role=p_role AND organization_required) THEN
    IF v_effective_org IS NULL THEN RAISE EXCEPTION 'Organisation obligatoire pour ce rôle.' USING ERRCODE='23502'; END IF;
    SELECT organization_type INTO v_org_type FROM public.snp_organizations WHERE id=v_effective_org AND is_active;
    IF v_org_type IS DISTINCT FROM v_expected_org THEN RAISE EXCEPTION 'Type d’organisation incompatible.' USING ERRCODE='42501'; END IF;
  ELSIF v_effective_org IS NOT NULL THEN
    RAISE EXCEPTION 'Ce rôle ne peut pas recevoir cette organisation.' USING ERRCODE='42501';
  END IF;
  IF p_role='collector' THEN
    IF p_collector_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.snp_artisans_miniers artisan
      WHERE artisan.id=p_collector_id AND artisan.type_artisan='collecteur' AND artisan.type_personne='physique' AND artisan.actif
    ) THEN RAISE EXCEPTION 'Profil collecteur actif obligatoire.' USING ERRCODE='42501'; END IF;
    IF EXISTS(
      SELECT 1 FROM public.snp_collector_accounts account
      WHERE account.collector_id=p_collector_id AND account.is_active AND account.user_id<>p_user_id
    ) THEN RAISE EXCEPTION 'Ce collecteur possède déjà un compte actif.' USING ERRCODE='23505'; END IF;
  END IF;
  v_status_context:=current_setting('snp.account_status_rpc',true);
  PERFORM set_config('snp.account_status_rpc','on',true);
  UPDATE public.user_profiles SET
    full_name=trim(p_full_name),phone=nullif(trim(p_phone),''),role=p_role,
    is_active=coalesce(p_is_active,true),
    mining_company_id=CASE WHEN p_role='mine' THEN p_mining_company_id ELSE NULL END,
    updated_at=now()
  WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte cible introuvable.' USING ERRCODE='P0002'; END IF;
  PERFORM set_config('snp.account_status_rpc',coalesce(v_status_context,''),true);
  v_membership_changed_at:=clock_timestamp();
  UPDATE public.snp_user_organization_memberships SET valid_until=v_membership_changed_at,is_primary=false
  WHERE user_id=p_user_id AND valid_until IS NULL;
  IF v_effective_org IS NOT NULL THEN
    INSERT INTO public.snp_user_organization_memberships(
      user_id,organization_id,membership_role,is_primary,reason,granted_by,valid_from
    ) VALUES(
      p_user_id,v_effective_org,CASE WHEN p_role IN('mine','comptoir') THEN 'manager' ELSE 'operator' END,
      true,'Configuration administrative du périmètre',auth.uid(),v_membership_changed_at
    );
  END IF;
  UPDATE public.snp_collector_accounts SET is_active=false,unlinked_at=now()
  WHERE user_id=p_user_id AND is_active;
  IF p_role='collector' THEN
    INSERT INTO public.snp_collector_accounts(user_id,collector_id,comptoir_organization_id,is_active,linked_by,reason)
    VALUES(p_user_id,p_collector_id,v_effective_org,true,auth.uid(),'Configuration administrative du collecteur');
  END IF;
  DELETE FROM public.snp_user_responsibilities WHERE user_id=p_user_id;
  INSERT INTO public.snp_user_responsibilities(user_id,responsibility_code,granted_by,reason)
  SELECT p_user_id,item.key,auth.uid(),'Configuration administrative des responsabilités'
  FROM jsonb_each_text(p_responsibilities) item WHERE item.value::boolean;
  INSERT INTO public.snp_user_capabilities(user_id,capability_code,allowed,reason,granted_by)
  SELECT p_user_id,catalog.capability_code,
    EXISTS(
      SELECT 1 FROM public.snp_user_responsibilities selected
      WHERE selected.user_id=p_user_id AND selected.responsibility_code=catalog.code
    ),
    'Synchronisation autoritative des responsabilités',auth.uid()
  FROM public.snp_responsibility_catalog catalog
  WHERE catalog.requires_explicit_assignment OR EXISTS(
    SELECT 1 FROM public.snp_role_responsibility_ceiling ceiling
    WHERE ceiling.role=p_role AND ceiling.responsibility_code=catalog.code
  )
  ON CONFLICT(user_id,capability_code) DO UPDATE SET
    allowed=excluded.allowed,valid_from=now(),valid_until=NULL,
    reason=excluded.reason,granted_by=auth.uid(),granted_at=now();
  PERFORM public.snp_remplacer_habilitations_compte(p_user_id,CASE WHEN p_role='owner' THEN '[]'::jsonb ELSE p_permissions END);
  PERFORM public.snp_sessions_revoquer_toutes(p_user_id,false,'Révocation après modification des accès du compte');
  INSERT INTO public.snp_account_admin_audit(actor_id,target_id,action,new_values)
  VALUES(auth.uid(),p_user_id,'access_configuration',jsonb_build_object(
    'previous_role',v_target_role,'role',p_role,'organization_id',v_effective_org,'collector_id',p_collector_id
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.snp_access_resources_search(p_category_code text, p_query text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, category_code text, resource_kind text, display_name text, secondary_name text, code text, email text, phone text, address text, representative text, status text, organization_id uuid, organization_name text, details jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_kind text;
  v_legacy_role text;
  v_expected_organization_type text;
  v_query text:='%'||lower(trim(coalesce(p_query,'')))||'%';
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Recherche de ressources non autorisée.' USING ERRCODE='42501';
  END IF;
  IF p_offset<0 OR p_limit NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Pagination invalide.' USING ERRCODE='22023';
  END IF;
  SELECT category.resource_kind,category.legacy_role INTO v_kind,v_legacy_role
  FROM public.snp_actor_categories category
  WHERE category.code=p_category_code AND category.is_active;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'Catégorie inconnue.' USING ERRCODE='22023'; END IF;
  IF v_kind='identity' THEN RETURN; END IF;
  SELECT policy.organization_type INTO v_expected_organization_type
  FROM public.snp_access_role_policies policy WHERE policy.role=v_legacy_role;
  IF v_legacy_role='collector' THEN v_expected_organization_type:='comptoir'; END IF;

  IF v_kind='mining_company' THEN
    RETURN QUERY SELECT company.id,p_category_code,v_kind,company.name::text,company.abbreviation::text,company.code::text,
      company.contact_person_email::text,company.contact_person_phone::text,
      concat_ws(', ',company.address,company.city,company.region),company.contact_person_name::text,
      CASE WHEN coalesce(company.is_active,false) THEN 'Actif' ELSE 'Inactif' END,
      organization.id,organization.name,
      jsonb_strip_nulls(jsonb_build_object('raison_sociale',company.name::text,'registre',company.registration_number,
        'identifiant_fiscal',company.tax_id,'pays',company.country,'type',company.company_type))
    FROM public.mining_companies company
    LEFT JOIN public.snp_organizations organization
      ON organization.mining_company_id=company.id AND organization.is_active
    WHERE lower(concat_ws(' ',company.name::text,company.abbreviation::text,company.code::text,company.registration_number)) LIKE v_query
    ORDER BY company.name::text OFFSET p_offset LIMIT p_limit;
  ELSIF v_kind='organization' THEN
    RETURN QUERY SELECT organization.id,p_category_code,v_kind,organization.name,organization.short_name,
      organization.code,organization.email,organization.phone,organization.address,NULL::text,
      CASE WHEN organization.is_active THEN 'Actif' ELSE 'Inactif' END,
      organization.id,organization.name,
      jsonb_strip_nulls(jsonb_build_object('forme_juridique',organization.legal_form,
        'region',organization.administrative_region,'type',organization.organization_type,
        'sous_type',organization.organization_subtype))
    FROM public.snp_organizations organization
    WHERE organization.organization_type=v_expected_organization_type
      AND lower(concat_ws(' ',organization.name,organization.short_name,organization.code)) LIKE v_query
    ORDER BY organization.name OFFSET p_offset LIMIT p_limit;
  ELSIF v_kind IN ('artisan','collector') THEN
    RETURN QUERY SELECT artisan.id,p_category_code,v_kind,
      coalesce(nullif(trim(concat_ws(' ',artisan.prenoms,artisan.nom)),''),artisan.raison_sociale,'Sans nom'),
      artisan.raison_sociale,coalesce(artisan.numero_carte,artisan.numero_piece_identite),
      artisan.email,artisan.telephone,concat_ws(', ',artisan.adresse,artisan.commune,artisan.region),NULL::text,
      CASE WHEN artisan.actif THEN 'Actif' ELSE 'Inactif' END,
      organization.id,organization.name,
      jsonb_strip_nulls(jsonb_build_object('type_personne',artisan.type_personne,
        'type_acteur',artisan.type_artisan,'numero_carte',artisan.numero_carte,
        'registre_commerce',artisan.numero_registre_commerce,'site_id',artisan.artisanal_site_id))
    FROM public.snp_artisans_miniers artisan
    LEFT JOIN LATERAL (
      SELECT assignment.comptoir_organization_id
      FROM public.snp_collector_artisan_assignments assignment
      WHERE assignment.collector_id=artisan.id AND assignment.valid_until IS NULL
        AND assignment.comptoir_organization_id IS NOT NULL
      ORDER BY assignment.valid_from DESC LIMIT 1
    ) collector_scope ON true
    LEFT JOIN public.snp_organizations organization ON organization.id=coalesce((SELECT c.organization_id FROM public.snp_collectors c WHERE c.id=artisan.id),collector_scope.comptoir_organization_id)
    WHERE ((v_kind='collector' AND artisan.type_artisan='collecteur' AND artisan.type_personne='physique')
      OR (v_kind='artisan' AND artisan.type_artisan<>'collecteur'))
      AND lower(concat_ws(' ',artisan.nom,artisan.prenoms,artisan.raison_sociale,
        artisan.numero_carte,artisan.numero_piece_identite,artisan.telephone)) LIKE v_query
    ORDER BY artisan.raison_sociale NULLS LAST,artisan.nom,artisan.prenoms
    OFFSET p_offset LIMIT p_limit;
  ELSIF v_kind='artisanal_site' THEN
    RETURN QUERY SELECT site.id,p_category_code,v_kind,site.name,site.locality,site.code,
      NULL::text,NULL::text,concat_ws(', ',site.locality,site.province,site.region),NULL::text,
      CASE WHEN lower(site.status) IN ('active','actif','approved') THEN 'Actif' ELSE site.status END,
      NULL::uuid,NULL::text,
      jsonb_strip_nulls(jsonb_build_object('type_exploitation',site.exploitation_type,
        'region',site.region,'province',site.province,'superficie_hectares',site.area_hectares,
        'mineurs_actifs',site.active_miners))
    FROM public.artisanal_sites site
    WHERE lower(concat_ws(' ',site.name,site.code,site.locality,site.province,site.region)) LIKE v_query
    ORDER BY site.name OFFSET p_offset LIMIT p_limit;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.snp_access_legacy_user_permission_allowed(p_user_id uuid, p_module_id uuid, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  WITH normalized AS (
    SELECT public.snp_access_action_to_legacy(p_action) AS action
  ), target AS (
    SELECT profile.role,module.access_domain,(SELECT action FROM normalized) AS action
    FROM public.user_profiles profile CROSS JOIN public.modules module
    WHERE profile.id=p_user_id AND profile.is_active AND module.id=p_module_id
  ), selected AS (
    SELECT responsibility_code FROM public.snp_user_responsibilities WHERE user_id=p_user_id
  )
  SELECT coalesce((SELECT CASE
    WHEN target.action IS NULL THEN false
    WHEN NOT public.snp_permission_allowed(target.role,p_module_id,target.action) THEN false
    WHEN target.role='owner' THEN true
    WHEN target.action='view' THEN true
    WHEN target.role='admin' THEN true /* l’attribution explicite reste exigée par la matrice effective */
    WHEN target.role='management' AND target.action IN('create','edit') THEN CASE
      WHEN target.access_domain='payments' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.execute')
      WHEN target.access_domain='reconciliation' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='reconciliation.manage')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.prepare') END
    WHEN target.role='management' AND target.action='approve' THEN CASE
      WHEN target.access_domain IN('payments','reconciliation') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.finance.reconcile')
      ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='sonasp.approve') END
    WHEN target.role='dgmg' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.supervise')
    WHEN target.role='dgmg' AND target.action='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgmg.production.validate')
    WHEN target.role='dgi' AND target.action='edit' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.control')
    WHEN target.role='dgi' AND target.action='approve' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='dgi.fiscal.reconcile')
    WHEN target.role='mine' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='mine.production.manage')
    WHEN target.role='comptoir' AND target.action IN('create','edit') THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='comptoir.manage')
    WHEN target.role='collector' AND target.action IN('create','edit') THEN CASE WHEN target.access_domain='payments' THEN EXISTS(SELECT 1 FROM selected WHERE responsibility_code='collector.payments.execute') ELSE EXISTS(SELECT 1 FROM selected WHERE responsibility_code='collector.operate') END
    ELSE false END FROM target),false);
$function$;

INSERT INTO public.snp_role_module_ceilings(role,access_domain,can_view,can_create,can_edit,can_delete,can_approve) VALUES
 ('collector','sales',true,true,false,false,false),('collector','payments',true,true,true,false,false)
ON CONFLICT(role,access_domain) DO UPDATE SET can_view=true,can_create=true,can_edit=EXCLUDED.can_edit;
CREATE POLICY collector_purchase_read ON public.snp_artisan_ventes_or FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.snp_collector_sales c WHERE c.id=snp_artisan_ventes_or.id));
CREATE POLICY collector_invoice_read ON public.snp_artisan_factures_definitives FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.snp_collector_sales c WHERE c.id=vente_or_id));
CREATE POLICY collector_payment_read ON public.snp_artisan_paiements FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.snp_collector_sales c WHERE c.id=vente_or_id));
DO $grants$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN(
 'snp_collector_strong_session','snp_collector_org_access','snp_collector_visible','snp_collector_references','snp_list_collectors','snp_save_collector',
 'snp_collector_set_payment_authorization','snp_collector_can_pay','snp_collector_require_payment','snp_collector_sale_artisans','snp_collector_submit_sale',
 'snp_collector_notify_member','snp_collector_decide_sale','snp_collector_sales','snp_collector_sale_visible','snp_collector_finance_guard','snp_check_collector_sale_change') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  IF f.proname IN('snp_collector_visible','snp_collector_org_access','snp_collector_references','snp_list_collectors','snp_save_collector',
  'snp_collector_set_payment_authorization','snp_collector_can_pay','snp_collector_sale_artisans','snp_collector_submit_sale','snp_collector_decide_sale','snp_collector_sales','snp_collector_sale_visible') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END IF;
 END LOOP;
END $grants$;
GRANT ALL ON public.snp_collectors,public.snp_collector_sites,public.snp_collector_sales TO service_role;

ALTER TABLE public.snp_notifications_livraisons ADD COLUMN collection_lease uuid, ADD COLUMN collection_claimed_at timestamptz;
CREATE FUNCTION public.snp_collection_mail_allowed(p_sale_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND is_active) AND public.snp_session_est_active() AND public.snp_mfa_satisfaite() AND EXISTS(SELECT 1 FROM public.snp_collector_sales s WHERE s.id=p_sale_id AND s.status<>'submitted'
 AND (public.snp_collector_org_access(s.organization_id) OR (s.collector_id=public.snp_current_collector_id() AND public.snp_actor_has_capability('collector.operate'))));
$$;
CREATE FUNCTION public.snp_claim_collection_mail(p_sale_id uuid) RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.snp_notifications_livraisons; n public.snp_notifications; lease uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service interne requis.' USING ERRCODE='42501'; END IF;
 UPDATE public.snp_notifications_livraisons delivery SET statut='echec',collection_lease=NULL,collection_claimed_at=NULL
 FROM public.snp_notifications notification WHERE notification.id=delivery.notification_id AND notification.objet_id=p_sale_id
 AND EXISTS(SELECT 1 FROM public.snp_collector_sales WHERE id=p_sale_id) AND notification.objet_domaine='vente'
 AND delivery.canal='courriel' AND delivery.statut='en_attente' AND delivery.tentatives>=3
 AND (delivery.collection_lease IS NULL OR delivery.collection_claimed_at<now()-interval '5 minutes');
 FOR l IN SELECT delivery.* FROM public.snp_notifications_livraisons delivery JOIN public.snp_notifications notification ON notification.id=delivery.notification_id
 JOIN public.snp_collector_sales sale ON sale.id=notification.objet_id
 WHERE sale.id=p_sale_id AND notification.objet_domaine='vente' AND delivery.canal='courriel' AND delivery.statut='en_attente' AND delivery.tentatives<3
 AND (delivery.collection_lease IS NULL OR delivery.collection_claimed_at<now()-interval '5 minutes') FOR UPDATE OF delivery SKIP LOCKED LOOP
  lease:=gen_random_uuid();
  UPDATE public.snp_notifications_livraisons SET collection_lease=lease,collection_claimed_at=now(),tentatives=tentatives+1 WHERE id=l.id;
  SELECT * INTO n FROM public.snp_notifications WHERE id=l.notification_id;
  RETURN NEXT jsonb_build_object('id',l.id,'lease',lease,'to',l.destinataire,'title',n.titre,'message',n.message);
 END LOOP;
END $$;
CREATE FUNCTION public.snp_finish_collection_mail(p_id uuid,p_lease uuid,p_sent boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service interne requis.' USING ERRCODE='42501'; END IF;
 UPDATE public.snp_notifications_livraisons SET statut=CASE WHEN p_sent THEN 'envoye' WHEN tentatives>=3 THEN 'echec' ELSE 'en_attente' END,
 envoye_le=CASE WHEN p_sent THEN now() END,collection_lease=NULL,collection_claimed_at=NULL WHERE id=p_id AND collection_lease=p_lease;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bail de notification expiré.' USING ERRCODE='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.snp_collection_mail_allowed(uuid),public.snp_claim_collection_mail(uuid),public.snp_finish_collection_mail(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snp_collection_mail_allowed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_claim_collection_mail(uuid),public.snp_finish_collection_mail(uuid,uuid,boolean) TO service_role;
-- Le dispatcher de collecte possède ces livraisons, le dispatcher général les exclut.
CREATE OR REPLACE FUNCTION public.snp_courriels_a_envoyer(p_limite integer DEFAULT 50)
RETURNS TABLE(livraison_id uuid,notification_id uuid,destinataire text,titre text,message text,gravite text,chemin text,faits jsonb,tentatives integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public','pg_temp' AS $$
 SELECT l.id,n.id,l.destinataire,n.titre,n.message,n.gravite,n.chemin,n.faits,l.tentatives
 FROM snp_notifications_livraisons l JOIN snp_notifications n ON n.id=l.notification_id
 WHERE l.canal='courriel' AND l.statut='en_attente' AND l.tentatives<3
 AND NOT EXISTS(SELECT 1 FROM public.snp_collector_sales s WHERE s.id=n.objet_id AND n.objet_domaine='vente')
 ORDER BY l.created_at LIMIT GREATEST(1,LEAST(COALESCE(p_limite,50),200));
$$;
COMMIT;
