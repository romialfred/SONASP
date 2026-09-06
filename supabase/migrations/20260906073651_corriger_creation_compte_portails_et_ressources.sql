-- Corrige les erreurs 42702 et 42804 du parcours de création de compte.
-- Contrats RPC et contrôles d’autorisation conservés.
BEGIN;

CREATE OR REPLACE FUNCTION public.snp_access_compatible_portals(p_category_code text)
RETURNS TABLE(
  id uuid,code text,name text,description text,institutional_scope text,
  is_active boolean,is_system boolean,role_count bigint,user_count bigint,
  active_group_count bigint,updated_at timestamptz,updated_by_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
BEGIN
  IF NOT public.snp_access_admin_authorized(false,false) THEN
    RAISE EXCEPTION 'Consultation des portails compatibles non autorisée.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.snp_actor_categories category WHERE category.code=p_category_code AND category.is_active) THEN
    RAISE EXCEPTION 'Catégorie inconnue.' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  SELECT summary.* FROM public.snp_access_portals_list(false) summary
  WHERE EXISTS(
    SELECT 1 FROM public.snp_access_roles role
    JOIN public.snp_access_role_categories category ON category.role_id=role.id
    WHERE role.portal_id=summary.id AND role.is_active AND role.deleted_at IS NULL
      AND category.category_code=p_category_code
  ) ORDER BY summary.name;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_access_resources_search(
  p_category_code text,p_query text DEFAULT '',p_offset integer DEFAULT 0,p_limit integer DEFAULT 20
) RETURNS TABLE(
  id uuid,category_code text,resource_kind text,display_name text,secondary_name text,
  code text,email text,phone text,address text,representative text,status text,
  organization_id uuid,organization_name text,details jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp' AS $fn$
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
      collector_scope.comptoir_organization_id,organization.name,
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
    LEFT JOIN public.snp_organizations organization ON organization.id=collector_scope.comptoir_organization_id
    WHERE ((v_kind='collector' AND artisan.type_artisan='collecteur')
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
$fn$;

COMMIT;
