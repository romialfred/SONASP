-- Corrige les fonctions encore appelées par l'application dont les dépendances
-- ou la syntaxe ne correspondaient plus au schéma de production.

CREATE SEQUENCE IF NOT EXISTS public.bar_reference_seq;

CREATE OR REPLACE FUNCTION public.generate_bar_reference(
  company_name text DEFAULT NULL,
  production_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  prefix text;
  sequence_num text;
  year_month text;
BEGIN
  prefix := CASE
    WHEN company_name IS NULL OR btrim(company_name) = '' THEN 'PROD'
    ELSE upper(left(regexp_replace(company_name, '[^A-Za-z]', '', 'g'), 5))
  END;

  IF prefix = '' THEN
    prefix := 'PROD';
  END IF;

  year_month := to_char(production_date, 'YYMM');
  sequence_num := lpad(nextval('public.bar_reference_seq')::text, 4, '0');

  RETURN prefix || '-' || year_month || '-' || sequence_num;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.check_sale_authorization(
  p_mining_company_id uuid,
  p_customer_id uuid,
  p_quantity_oz numeric,
  p_available_stock_oz numeric
)
RETURNS TABLE(
  is_authorized boolean,
  reason text,
  max_allowed_oz numeric,
  settings jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_settings public.gold_sales_settings%ROWTYPE;
  v_max_allowed_oz numeric;
  v_percentage numeric;
BEGIN
  IF p_quantity_oz IS NULL OR p_quantity_oz <= 0 THEN
    RETURN QUERY SELECT false, 'La quantité doit être supérieure à zéro.'::text, 0::numeric, NULL::jsonb;
    RETURN;
  END IF;

  IF p_available_stock_oz IS NULL OR p_available_stock_oz <= 0 THEN
    RETURN QUERY SELECT false, 'Le stock disponible est insuffisant.'::text, 0::numeric, NULL::jsonb;
    RETURN;
  END IF;

  SELECT *
  INTO v_settings
  FROM public.gold_sales_settings
  WHERE mining_company_id = p_mining_company_id
    AND customer_id = p_customer_id
    AND is_active = true
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_settings.id IS NULL THEN
    RETURN QUERY SELECT
      p_quantity_oz <= p_available_stock_oz,
      CASE
        WHEN p_quantity_oz <= p_available_stock_oz THEN 'Vente autorisée.'
        ELSE 'La quantité demandée dépasse le stock disponible.'
      END::text,
      p_available_stock_oz,
      NULL::jsonb;
    RETURN;
  END IF;

  v_max_allowed_oz := (p_available_stock_oz * v_settings.max_stock_percentage) / 100.0;
  v_percentage := (p_quantity_oz / p_available_stock_oz) * 100.0;

  RETURN QUERY SELECT
    p_quantity_oz <= v_max_allowed_oz,
    CASE
      WHEN p_quantity_oz <= v_max_allowed_oz THEN 'Vente autorisée.'
      ELSE format(
        'La quantité demandée (%s %%) dépasse le plafond autorisé (%s %%).',
        round(v_percentage, 2),
        round(v_settings.max_stock_percentage, 2)
      )
    END::text,
    v_max_allowed_oz,
    jsonb_build_object(
      'max_stock_percentage', v_settings.max_stock_percentage,
      'sale_method', v_settings.sale_method,
      'refining_fees_paid_by_customer', v_settings.refining_fees_paid_by_customer,
      'transport_fees_paid_by_customer', v_settings.transport_fees_paid_by_customer
    );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reserve_license_quota(
  p_license_id uuid,
  p_shipping_id uuid,
  p_quantity numeric,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_remaining numeric;
  v_license_number text;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité à réserver doit être supérieure à zéro.';
  END IF;

  -- Verrouille la licence afin d'éviter une double réservation concurrente.
  SELECT license_number, remaining_quantity_grams
  INTO v_license_number, v_remaining
  FROM public.export_licenses
  WHERE id = p_license_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Licence active introuvable.';
  END IF;

  IF v_remaining < p_quantity THEN
    RAISE EXCEPTION 'Quota insuffisant sur la licence % : disponible % g, requis % g.',
      v_license_number,
      round(v_remaining, 2),
      round(p_quantity, 2);
  END IF;

  UPDATE public.export_licenses
  SET used_quantity_grams = used_quantity_grams + p_quantity,
      updated_at = now(),
      updated_by = coalesce(p_user_id, auth.uid())
  WHERE id = p_license_id;

  UPDATE public.export_licenses
  SET status = 'exhausted'
  WHERE id = p_license_id
    AND remaining_quantity_grams <= 0
    AND status = 'active';

  -- p_shipping_id reste dans la signature publique pour compatibilité avec
  -- le workflow d'expédition et pour permettre la traçabilité applicative.
  PERFORM p_shipping_id;
  RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_unified_status_history(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS TABLE(
  id uuid,
  old_status text,
  new_status text,
  change_context text,
  changed_by uuid,
  changed_at timestamptz,
  action_description text,
  notes text,
  user_email text,
  user_name text,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT
    ush.id,
    ush.old_status,
    ush.new_status,
    ush.change_context::text,
    ush.changed_by,
    ush.changed_at,
    ush.action_description,
    ush.notes,
    au.email::text,
    coalesce(up.full_name, au.email)::text,
    ush.metadata
  FROM public.unified_status_history AS ush
  LEFT JOIN auth.users AS au ON au.id = ush.changed_by
  LEFT JOIN public.user_profiles AS up ON up.id = ush.changed_by
  WHERE ush.entity_type = p_entity_type
    AND ush.entity_id = p_entity_id
  ORDER BY ush.changed_at ASC;
$fn$;

REVOKE ALL ON FUNCTION public.generate_bar_reference(text, date) FROM public;
REVOKE ALL ON FUNCTION public.check_sale_authorization(uuid, uuid, numeric, numeric) FROM public;
REVOKE ALL ON FUNCTION public.reserve_license_quota(uuid, uuid, numeric, uuid) FROM public;
REVOKE ALL ON FUNCTION public.get_unified_status_history(text, uuid) FROM public;

GRANT USAGE, SELECT ON SEQUENCE public.bar_reference_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_bar_reference(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_sale_authorization(uuid, uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_license_quota(uuid, uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_status_history(text, uuid) TO authenticated;
