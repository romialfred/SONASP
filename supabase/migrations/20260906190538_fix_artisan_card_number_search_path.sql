-- The dossier RPC deliberately uses an empty search_path. Its legacy BEFORE
-- INSERT trigger must resolve application objects explicitly in that context.
-- Preserve numbering, existing numbers, trigger conditions and invoker rights.
BEGIN;

CREATE OR REPLACE FUNCTION public.generate_numero_carte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  instant timestamptz := CURRENT_TIMESTAMP;
  prefixe text;
  prochain int;
BEGIN
  prefixe := 'BF-AM-' || EXTRACT(YEAR FROM instant)::text || '-'
    || public.snp_encoder_instant_carte(instant);

  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero_carte, '^.*-', ''), '')::int), 0) + 1
  INTO prochain
  FROM public.snp_artisans_miniers
  WHERE numero_carte LIKE prefixe || '-%';

  NEW.numero_carte := prefixe || '-' || LPAD(prochain::text, 4, '0');
  RETURN NEW;
END;
$function$;

COMMIT;
