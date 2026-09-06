BEGIN;

-- Dossier dédié aux entreprises : aucune modification des dossiers artisan/site.
CREATE TABLE public.snp_comptoir_tax_offices (
 code text PRIMARY KEY, label text NOT NULL, group_name text NOT NULL, source_url text NOT NULL,
 checked_on date NOT NULL DEFAULT DATE '2026-09-06', is_active boolean NOT NULL DEFAULT true
);
INSERT INTO public.snp_comptoir_tax_offices(code,label,group_name,source_url) VALUES
('DGE','Direction des grandes entreprises','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DME-C-I','Direction des moyennes entreprises du Centre I','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DME-C-II','Direction des moyennes entreprises du Centre II','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DME-C-III','Direction des moyennes entreprises du Centre III','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DME-C-IV','Direction des moyennes entreprises du Centre IV','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DME-C-V','Direction des moyennes entreprises du Centre V','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DME-HBS','Direction des moyennes entreprises des Hauts-Bassins','Grandes et moyennes entreprises','https://dgi.bf/contacts/'),
('DRI-BMH','Direction régionale des impôts de la Boucle du Mouhoun','Directions régionales','https://dgi.bf/contacts/'),
('DRI-C','Direction régionale des impôts du Centre','Directions régionales','https://dgi.bf/organigramme/'),
('DRI-CASC','Direction régionale des impôts des Cascades','Directions régionales','https://dgi.bf/contacts/'),
('DRI-CE','Direction régionale des impôts du Centre-Est','Directions régionales','https://dgi.bf/contacts/'),
('DRI-CN','Direction régionale des impôts du Centre-Nord','Directions régionales','https://dgi.bf/contacts/'),
('DRI-CO','Direction régionale des impôts du Centre-Ouest','Directions régionales','https://dgi.bf/contacts/'),
('DRI-CS','Direction régionale des impôts du Centre-Sud','Directions régionales','https://dgi.bf/contacts/'),
('DRI-E','Direction régionale des impôts de l’Est','Directions régionales','https://dgi.bf/contacts/'),
('DRI-HBS','Direction régionale des impôts des Hauts-Bassins','Directions régionales','https://dgi.bf/contacts/'),
('DRI-N','Direction régionale des impôts du Nord','Directions régionales','https://dgi.bf/contacts/'),
('DRI-PCL','Direction régionale des impôts du Plateau central','Directions régionales','https://dgi.bf/contacts/'),
('DRI-S','Direction régionale des impôts du Sahel','Directions régionales','https://dgi.bf/contacts/'),
('DRI-SO','Direction régionale des impôts du Sud-Ouest','Directions régionales','https://dgi.bf/contacts/'),
('DCI-OUAGA-I','Direction du Centre des Impôts Ouaga I','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-II','Direction du Centre des Impôts Ouaga II','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-III','Direction du Centre des Impôts Ouaga III','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-IV','Direction du Centre des Impôts Ouaga IV','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-V','Direction du Centre des Impôts Ouaga V','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-VI','Direction du Centre des Impôts Ouaga VI','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-VII','Direction du Centre des Impôts Ouaga VII','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-VIII','Direction du Centre des Impôts Ouaga VIII','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-OUAGA-IX','Direction du Centre des Impôts Ouaga IX','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-BOBO-I','Direction du Centre des Impôts Bobo I','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-BOBO-II','Direction du Centre des Impôts Bobo II','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-BOBO-III','Direction du Centre des Impôts Bobo III','Centres des impôts','https://dgi.bf/contacts/'),
('DCI-BOBO-IV','Direction du Centre des Impôts Bobo IV','Centres des impôts','https://dgi.bf/contacts/'),
('DPI-KENEDOUGOU','Direction provinciale des impôts — Kénédougou','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-TUY','Direction provinciale des impôts — Tuy','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-BOULGOU','Direction provinciale des impôts — Boulgou','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-KOULPELOGO','Direction provinciale des impôts — Koulpélogo','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-KOURITTENGA','Direction provinciale des impôts — Kourittenga','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-BOUGOURIBA','Direction provinciale des impôts — Bougouriba','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-IOBA','Direction provinciale des impôts — Ioba','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-NOUMBIEL','Direction provinciale des impôts — Noumbiel','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-PONI','Direction provinciale des impôts — Poni','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-SANMATENGA','Direction provinciale des impôts — Sanmatenga','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-BAM','Direction provinciale des impôts — Bam','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-NAMENTENGA','Direction provinciale des impôts — Namentenga','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-SENO','Direction provinciale des impôts — Séno','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-SOUM','Direction provinciale des impôts — Soum','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-OUDALAN','Direction provinciale des impôts — Oudalan','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-YAGHA','Direction provinciale des impôts — Yagha','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-GOURMA','Direction provinciale des impôts — Gourma','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-TAPOA','Direction provinciale des impôts — Tapoa','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-GNAGNA','Direction provinciale des impôts — Gnagna','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-KOMPIENGA','Direction provinciale des impôts — Kompienga','Directions provinciales','https://dgi.bf/contacts/'),
('DPI-KOMONDJARI','Direction provinciale des impôts — Komondjari','Directions provinciales','https://dgi.bf/contacts/'),
('CDI-PABRE','Centre des impôts — Pabré','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-SAABA','Centre des impôts — Saaba','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-KOMSILGA','Centre des impôts — Komsilga','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-TANGHIN-DASSOURI','Centre des impôts — Tanghin Dassouri','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-KOUBRI','Centre des impôts — Koubri','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-FO','Centre des impôts — Fô','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-N-DOROLA','Centre des impôts — N’Dorola','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-SAMOROGOUAN','Centre des impôts — Samorogouan','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-BITTOU','Centre des impôts — Bittou','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-GARANGO','Centre des impôts — Garango','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-ZABRE','Centre des impôts — Zabré','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-POUYTENGA','Centre des impôts — Pouytenga','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-KAMPTI','Centre des impôts — Kampti','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-KORSIMORO','Centre des impôts — Korsimoro','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-BARSALOGHO','Centre des impôts — Barsalogho','Centres départementaux','https://dgi.bf/contacts/'),
('CDI-TOUGOURI','Centre des impôts — Tougouri','Centres départementaux','https://dgi.bf/contacts/');


CREATE TABLE public.snp_comptoir_dossiers (
 organization_id uuid PRIMARY KEY REFERENCES public.snp_organizations(id) ON DELETE RESTRICT,
 data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
 version integer NOT NULL CHECK (version>0), last_request_id uuid NOT NULL,
 created_by uuid NOT NULL REFERENCES auth.users(id), updated_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX snp_comptoir_rccm_unique ON public.snp_comptoir_dossiers(upper(btrim(data->>'rccm_number'))) WHERE nullif(btrim(data->>'rccm_number'),'') IS NOT NULL;
CREATE UNIQUE INDEX snp_comptoir_ifu_unique ON public.snp_comptoir_dossiers(upper(btrim(data->>'ifu_number'))) WHERE nullif(btrim(data->>'ifu_number'),'') IS NOT NULL;
CREATE INDEX snp_comptoir_dossiers_updated_by ON public.snp_comptoir_dossiers(updated_by);
CREATE INDEX snp_comptoir_dossiers_created_by ON public.snp_comptoir_dossiers(created_by);
CREATE TABLE public.snp_comptoir_documents (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.snp_comptoir_dossiers(organization_id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('logo','rccm','ifu','purchase_authorization','representative_identity','representative_photo','other')),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 250), path text NOT NULL UNIQUE,
 mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','application/pdf')),
 size_bytes bigint NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880), sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 uploaded_by uuid NOT NULL REFERENCES auth.users(id), uploaded_at timestamptz NOT NULL DEFAULT now(),
 deleted_by uuid REFERENCES auth.users(id), deleted_at timestamptz,
 CHECK(kind NOT IN ('logo','representative_photo') OR (mime_type IN ('image/jpeg','image/png') AND size_bytes<=2097152))
);
CREATE INDEX snp_comptoir_documents_parent ON public.snp_comptoir_documents(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX snp_comptoir_documents_uploaded_by ON public.snp_comptoir_documents(uploaded_by);
CREATE INDEX snp_comptoir_documents_deleted_by ON public.snp_comptoir_documents(deleted_by);
CREATE TABLE public.snp_comptoir_dossier_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.snp_organizations(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), action text NOT NULL CHECK(action IN ('creation','modification','document_ajoute','document_retire')),
 document_id uuid REFERENCES public.snp_comptoir_documents(id), version integer, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX snp_comptoir_audit_parent ON public.snp_comptoir_dossier_audit(organization_id,created_at DESC);
CREATE INDEX snp_comptoir_audit_actor ON public.snp_comptoir_dossier_audit(actor_id);
CREATE INDEX snp_comptoir_audit_document ON public.snp_comptoir_dossier_audit(document_id);

CREATE FUNCTION public.snp_comptoir_registry_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(public.snp_session_est_active() AND public.snp_peut_gerer_sites_artisanaux(),false);
$$;
REVOKE ALL ON FUNCTION public.snp_comptoir_registry_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_comptoir_registry_allowed() TO authenticated,service_role;

ALTER TABLE public.snp_comptoir_tax_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_comptoir_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_comptoir_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_comptoir_dossier_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.snp_comptoir_tax_offices,public.snp_comptoir_dossiers,public.snp_comptoir_documents,public.snp_comptoir_dossier_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.snp_comptoir_tax_offices,public.snp_comptoir_dossiers,public.snp_comptoir_documents,public.snp_comptoir_dossier_audit TO authenticated;
GRANT ALL ON public.snp_comptoir_tax_offices,public.snp_comptoir_dossiers,public.snp_comptoir_documents,public.snp_comptoir_dossier_audit TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.snp_comptoir_dossier_audit_id_seq TO service_role;
CREATE POLICY comptoir_tax_read ON public.snp_comptoir_tax_offices FOR SELECT TO authenticated USING((SELECT public.snp_comptoir_registry_allowed()));
CREATE POLICY comptoir_dossier_read ON public.snp_comptoir_dossiers FOR SELECT TO authenticated USING((SELECT public.snp_comptoir_registry_allowed()));
CREATE POLICY comptoir_documents_read ON public.snp_comptoir_documents FOR SELECT TO authenticated USING(deleted_at IS NULL AND (SELECT public.snp_comptoir_registry_allowed()));
CREATE POLICY comptoir_audit_read ON public.snp_comptoir_dossier_audit FOR SELECT TO authenticated USING((SELECT public.snp_comptoir_registry_allowed()));

CREATE FUNCTION public.snp_list_comptoir_dossiers(p_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.snp_comptoir_registry_allowed() THEN RAISE EXCEPTION 'Accès réservé à la DGMG et à l’administration avec une session active et une authentification renforcée.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',o.id,'code',o.code,'name',o.name,'is_active',o.is_active,'organization_updated_at',o.updated_at,
  'version',coalesce(d.version,0),'updated_at',coalesce(d.updated_at,o.updated_at),
  'values',coalesce(d.data,'{}'::jsonb)||jsonb_build_object('name',o.name,'short_name',coalesce(o.short_name,''),'legal_form',coalesce(o.legal_form,''),
    'phone',coalesce(o.phone,''),'email',coalesce(o.email,''),'website',coalesce(o.website,''),'region',coalesce(o.administrative_region,''),'country','BF',
    'street',coalesce(d.data->>'street',o.address,''),'notes',coalesce(d.data->>'notes',o.notes,'')),
  'documents',coalesce((SELECT jsonb_agg(to_jsonb(doc) ORDER BY doc.uploaded_at DESC,doc.id) FROM public.snp_comptoir_documents doc WHERE doc.organization_id=o.id AND doc.deleted_at IS NULL),'[]'::jsonb)
 ) ORDER BY o.name,o.id) FROM public.snp_organizations o LEFT JOIN public.snp_comptoir_dossiers d ON d.organization_id=o.id
 WHERE o.organization_type='comptoir' AND (p_id IS NULL OR o.id=p_id)),'[]'::jsonb);
END $$;

CREATE FUNCTION public.snp_save_comptoir_dossier(p_id uuid,p_values jsonb,p_expected_version integer,p_expected_organization_updated_at timestamptz,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.snp_organizations; d public.snp_comptoir_dossiers; v jsonb; k text; dt date; ministry uuid; next_version integer;
 allowed_keys constant text[]:=ARRAY['name','short_name','legal_form','capital','rccm_number','rccm_issued_on','ifu_number','ifu_issued_on','tax_regime','tax_office_code','authorization_number','authorization_issuer','authorization_issued_on','authorization_expires_on','country','region','city','district','street','postal_address','phone','email','website','representative_last_name','representative_first_name','representative_position','representative_phone','representative_email','representative_identity_type','representative_identity_number','representative_identity_issued_on','representative_identity_expires_on','notes'];
BEGIN
 IF NOT public.snp_comptoir_registry_allowed() THEN RAISE EXCEPTION 'Gestion réservée à la DGMG et à l’administration.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_request_id IS NULL OR p_expected_version IS NULL OR p_expected_version<0 OR p_values IS NULL OR jsonb_typeof(p_values)<>'object' THEN RAISE EXCEPTION 'Dossier invalide.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_values) e WHERE NOT(e.key=ANY(allowed_keys)) OR jsonb_typeof(e.value)<>'string') THEN RAISE EXCEPTION 'Le dossier contient un champ non autorisé.' USING ERRCODE='22023'; END IF;
 SELECT jsonb_object_agg(key,to_jsonb(btrim(value #>> '{}'))) INTO v FROM jsonb_each(p_values);
 IF coalesce(length(v->>'name'),0) NOT BETWEEN 3 AND 180 OR coalesce(v->>'legal_form','') NOT IN ('EI','SARL','SA','SAS','SNC','SCS')
   OR nullif(v->>'city','') IS NULL OR v->>'country' IS DISTINCT FROM 'BF' THEN RAISE EXCEPTION 'Renseignez la dénomination, le type d’entreprise et la ville du siège au Burkina Faso.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(v) e WHERE length(e.value)>CASE WHEN e.key='notes' THEN 4000 ELSE 250 END) THEN RAISE EXCEPTION 'Un champ dépasse la longueur autorisée.' USING ERRCODE='22023'; END IF;
 IF nullif(v->>'tax_regime','') IS NOT NULL AND v->>'tax_regime' NOT IN ('RNI','RSI','CME') THEN RAISE EXCEPTION 'Régime d’imposition invalide.' USING ERRCODE='22023'; END IF;
 IF nullif(v->>'tax_office_code','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.snp_comptoir_tax_offices WHERE code=v->>'tax_office_code' AND is_active) THEN RAISE EXCEPTION 'Sélectionnez une direction ou un centre DGI actif.' USING ERRCODE='22023'; END IF;
 IF nullif(v->>'representative_identity_type','') IS NOT NULL AND v->>'representative_identity_type' NOT IN ('CNIB','PASSPORT','RESIDENCE_PERMIT') THEN RAISE EXCEPTION 'Type de pièce d’identité invalide.' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['email','representative_email'] LOOP
  IF nullif(v->>k,'') IS NOT NULL AND v->>k !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Adresse e-mail invalide.' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['phone','representative_phone'] LOOP
  IF nullif(v->>k,'') IS NOT NULL AND v->>k !~ '^\+?[0-9 ()-]{8,25}$' THEN RAISE EXCEPTION 'Numéro de téléphone invalide.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF nullif(v->>'capital','') IS NOT NULL AND v->>'capital' !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'Capital social invalide.' USING ERRCODE='22023'; END IF;
 IF nullif(v->>'website','') IS NOT NULL AND v->>'website' !~* '^https?://[^[:space:]]+$' THEN RAISE EXCEPTION 'Adresse du site internet invalide.' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['rccm_issued_on','ifu_issued_on','authorization_issued_on','authorization_expires_on','representative_identity_issued_on','representative_identity_expires_on'] LOOP
  IF nullif(v->>k,'') IS NOT NULL THEN
   IF v->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Format de date invalide.' USING ERRCODE='22023'; END IF;
   BEGIN dt:=(v->>k)::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'Date invalide.' USING ERRCODE='22023'; END;
   IF dt<DATE '1900-01-01' OR dt>DATE '9999-12-31' THEN RAISE EXCEPTION 'Date hors limites.' USING ERRCODE='22023'; END IF;
  END IF;
 END LOOP;
 IF nullif(v->>'authorization_expires_on','') IS NOT NULL AND (nullif(v->>'authorization_issued_on','') IS NULL OR v->>'authorization_expires_on'<v->>'authorization_issued_on') THEN RAISE EXCEPTION 'L’expiration de l’autorisation doit suivre sa délivrance.' USING ERRCODE='22023'; END IF;
 IF nullif(v->>'representative_identity_expires_on','') IS NOT NULL AND (nullif(v->>'representative_identity_issued_on','') IS NULL OR v->>'representative_identity_expires_on'<v->>'representative_identity_issued_on') THEN RAISE EXCEPTION 'L’expiration de la pièce doit suivre sa délivrance.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,60906174800));
 SELECT * INTO o FROM public.snp_organizations WHERE id=p_id FOR UPDATE;
 SELECT * INTO d FROM public.snp_comptoir_dossiers WHERE organization_id=p_id FOR UPDATE;
 IF o.id IS NOT NULL AND o.organization_type<>'comptoir' THEN RAISE EXCEPTION 'Ce dossier ne correspond pas à un comptoir.' USING ERRCODE='42501'; END IF;
 IF d.last_request_id=p_request_id THEN
  IF d.data IS DISTINCT FROM v THEN RAISE EXCEPTION 'La clé de reprise correspond à un autre enregistrement.' USING ERRCODE='22023'; END IF;
  RETURN public.snp_list_comptoir_dossiers(p_id)->0;
 END IF;
 IF coalesce(d.version,0)<>p_expected_version OR (o.id IS NOT NULL AND o.updated_at IS DISTINCT FROM p_expected_organization_updated_at)
   OR (o.id IS NULL AND (p_expected_version<>0 OR p_expected_organization_updated_at IS NOT NULL)) THEN RAISE EXCEPTION 'Ce dossier a été modifié depuis son ouverture. Rechargez-le avant de reprendre vos modifications.' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.snp_comptoir_dossiers WHERE organization_id<>p_id AND
   ((nullif(v->>'rccm_number','') IS NOT NULL AND upper(data->>'rccm_number')=upper(v->>'rccm_number')) OR (nullif(v->>'ifu_number','') IS NOT NULL AND upper(data->>'ifu_number')=upper(v->>'ifu_number')))) THEN RAISE EXCEPTION 'Ce RCCM ou cet IFU est déjà associé à un autre comptoir.' USING ERRCODE='23505'; END IF;
 IF o.id IS NULL THEN
  SELECT id INTO ministry FROM public.snp_ministries WHERE code='MEMC' AND is_active;
  IF ministry IS NULL THEN RAISE EXCEPTION 'Le rattachement du registre minier est indisponible.'; END IF;
  INSERT INTO public.snp_organizations(id,code,name,organization_type,supervising_ministry_id,created_by,scope_metadata)
  VALUES(p_id,'CPT-'||upper(substr(replace(p_id::text,'-',''),1,20)),v->>'name','comptoir',ministry,auth.uid(),jsonb_build_object('scope','national'));
 END IF;
 -- Ne touche ni les liens commerciaux, ni l’état actif, ni les tutelles historiques.
 UPDATE public.snp_organizations SET name=v->>'name',short_name=nullif(v->>'short_name',''),legal_form=v->>'legal_form',email=nullif(v->>'email',''),
  phone=nullif(v->>'phone',''),website=nullif(v->>'website',''),administrative_region=nullif(v->>'region',''),
  address=concat_ws(', ',nullif(v->>'city',''),nullif(v->>'district',''),nullif(v->>'street','')),notes=nullif(v->>'notes',''),updated_at=clock_timestamp() WHERE id=p_id;
 next_version:=coalesce(d.version,0)+1;
 INSERT INTO public.snp_comptoir_dossiers(organization_id,data,version,last_request_id,created_by,updated_by)
 VALUES(p_id,v,next_version,p_request_id,auth.uid(),auth.uid())
 ON CONFLICT(organization_id) DO UPDATE SET data=excluded.data,version=excluded.version,last_request_id=excluded.last_request_id,updated_by=auth.uid(),updated_at=clock_timestamp();
 INSERT INTO public.snp_comptoir_dossier_audit(organization_id,actor_id,action,version) VALUES(p_id,auth.uid(),CASE WHEN d.organization_id IS NULL THEN 'creation' ELSE 'modification' END,next_version);
 RETURN public.snp_list_comptoir_dossiers(p_id)->0;
END $$;

CREATE FUNCTION public.snp_comptoir_document_allowed(p_organization_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.snp_comptoir_registry_allowed() AND EXISTS(SELECT 1 FROM public.snp_comptoir_dossiers d JOIN public.snp_organizations o ON o.id=d.organization_id WHERE d.organization_id=p_organization_id AND o.organization_type='comptoir');
$$;

-- Le rôle service du gateway atteste le contrôle des octets et du contexte AAL2.
CREATE FUNCTION public.snp_register_comptoir_document_gateway(p_document jsonb,p_actor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.snp_comptoir_documents; old public.snp_comptoir_documents; meta jsonb;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=p_actor_id AND is_active AND mining_company_id IS NULL AND role IN ('owner','admin','dgmg')) THEN RAISE EXCEPTION 'Dépôt réservé au service documentaire.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM jsonb_populate_record(NULL::public.snp_comptoir_documents,p_document);
 IF d.id IS NULL OR d.organization_id IS NULL OR d.path IS NULL OR d.sha256 IS NULL OR d.mime_type IS NULL OR d.size_bytes IS NULL OR d.kind IS NULL
  OR d.path !~ ('^'||d.organization_id::text||'/'||d.id::text||'\.(pdf|jpg|jpeg|png)$') OR d.sha256 !~ '^[0-9a-f]{64}$'
  OR d.size_bytes NOT BETWEEN 1 AND 5242880 OR d.mime_type NOT IN ('image/jpeg','image/png','application/pdf')
  OR d.kind NOT IN ('logo','rccm','ifu','purchase_authorization','representative_identity','representative_photo','other')
  OR (d.kind IN ('logo','representative_photo') AND (d.size_bytes>2097152 OR d.mime_type NOT IN ('image/jpeg','image/png')))
  OR coalesce(length(d.file_name),0) NOT BETWEEN 1 AND 250 OR d.file_name ~ '[/\\]'
  OR NOT EXISTS(SELECT 1 FROM public.snp_comptoir_dossiers cd JOIN public.snp_organizations o ON o.id=cd.organization_id WHERE cd.organization_id=d.organization_id AND o.organization_type='comptoir') THEN RAISE EXCEPTION 'Référence documentaire invalide.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(d.organization_id::text,60906174801));
 SELECT * INTO old FROM public.snp_comptoir_documents WHERE id=d.id;
 IF old.id IS NOT NULL THEN
  IF ROW(old.organization_id,old.kind,old.sha256,old.path,old.size_bytes,old.mime_type,old.file_name) IS DISTINCT FROM ROW(d.organization_id,d.kind,d.sha256,d.path,d.size_bytes,d.mime_type,d.file_name) OR old.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Une autre pièce utilise cet identifiant.'; END IF;
  RETURN to_jsonb(old);
 END IF;
 SELECT metadata INTO meta FROM storage.objects WHERE bucket_id='comptoir-dossiers' AND name=d.path;
 IF meta IS NULL OR (meta->>'size')::bigint IS DISTINCT FROM d.size_bytes OR meta->>'mimetype' IS DISTINCT FROM d.mime_type THEN RAISE EXCEPTION 'Le dépôt contrôlé est introuvable.'; END IF;
 IF (SELECT count(*) FROM public.snp_comptoir_documents WHERE organization_id=d.organization_id AND deleted_at IS NULL)>=50 THEN RAISE EXCEPTION 'Le dossier accepte au maximum 50 documents.'; END IF;
 INSERT INTO public.snp_comptoir_documents(id,organization_id,kind,file_name,path,mime_type,size_bytes,sha256,uploaded_by)
 VALUES(d.id,d.organization_id,d.kind,d.file_name,d.path,d.mime_type,d.size_bytes,d.sha256,p_actor_id) RETURNING * INTO d;
 INSERT INTO public.snp_comptoir_dossier_audit(organization_id,actor_id,action,document_id) VALUES(d.organization_id,p_actor_id,'document_ajoute',d.id);
 RETURN to_jsonb(d);
END $$;

CREATE FUNCTION public.snp_archive_comptoir_document(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.snp_comptoir_documents;
BEGIN
 IF NOT public.snp_comptoir_registry_allowed() THEN RAISE EXCEPTION 'Accès documentaire refusé.' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.snp_comptoir_documents WHERE id=p_id FOR UPDATE;
 IF d.id IS NULL OR NOT public.snp_comptoir_document_allowed(d.organization_id) THEN RAISE EXCEPTION 'Document introuvable ou inaccessible.' USING ERRCODE='42501'; END IF;
 IF d.deleted_at IS NOT NULL THEN RETURN; END IF;
 UPDATE public.snp_comptoir_documents SET deleted_at=clock_timestamp(),deleted_by=auth.uid() WHERE id=p_id;
 INSERT INTO public.snp_comptoir_dossier_audit(organization_id,actor_id,action,document_id) VALUES(d.organization_id,auth.uid(),'document_retire',d.id);
END $$;

CREATE FUNCTION public.snp_comptoir_document_path_allowed(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.snp_comptoir_registry_allowed() AND EXISTS(SELECT 1 FROM public.snp_comptoir_documents WHERE path=p_path AND deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.snp_list_comptoir_dossiers(uuid),public.snp_save_comptoir_dossier(uuid,jsonb,integer,timestamptz,uuid),public.snp_comptoir_document_allowed(uuid),public.snp_archive_comptoir_document(uuid),public.snp_comptoir_document_path_allowed(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_list_comptoir_dossiers(uuid),public.snp_save_comptoir_dossier(uuid,jsonb,integer,timestamptz,uuid),public.snp_comptoir_document_allowed(uuid),public.snp_archive_comptoir_document(uuid),public.snp_comptoir_document_path_allowed(text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.snp_register_comptoir_document_gateway(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snp_register_comptoir_document_gateway(jsonb,uuid) TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('comptoir-dossiers','comptoir-dossiers',false,5242880,ARRAY['image/jpeg','image/png','application/pdf']);
CREATE POLICY comptoir_files_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='comptoir-dossiers' AND public.snp_comptoir_document_path_allowed(name));
CREATE POLICY comptoir_files_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'comptoir-dossiers' OR public.snp_comptoir_document_path_allowed(name));
CREATE POLICY comptoir_files_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'comptoir-dossiers');
CREATE POLICY comptoir_files_update_boundary ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'comptoir-dossiers') WITH CHECK(bucket_id<>'comptoir-dossiers');
CREATE POLICY comptoir_files_delete_boundary ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'comptoir-dossiers');
CREATE POLICY comptoir_files_anon_boundary ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'comptoir-dossiers') WITH CHECK(bucket_id<>'comptoir-dossiers');
COMMENT ON TABLE public.snp_comptoir_dossiers IS 'Complément entreprise du référentiel comptoirs, sans modification des droits commerciaux ni validation automatique d’autorisation.';
COMMENT ON TABLE public.snp_comptoir_tax_offices IS 'Annuaire DGI public consulté le 6 septembre 2026. Les codes identifient les options de la plateforme ; les libellés suivent la source indiquée.';
NOTIFY pgrst,'reload schema';
COMMIT;
