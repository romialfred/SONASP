-- Intégrité des ventes d'or artisanales.
--
-- Le formulaire calcule les montants pour donner un retour immédiat, mais la
-- base reste l'autorité : quantité, prix et taux sont les seules entrées. Les
-- quatre montants sont recalculés avant chaque écriture, y compris lors d'un
-- import ou d'un appel hors interface.

BEGIN;

DO $preflight$
DECLARE v_doublons integer;
BEGIN
  SELECT count(*) INTO v_doublons
  FROM (
    SELECT numero_recu
    FROM public.snp_artisan_ventes_or
    WHERE numero_recu IS NOT NULL
    GROUP BY numero_recu
    HAVING count(*) > 1
  ) doublons;

  IF v_doublons > 0 THEN
    RAISE EXCEPTION 'Preflight : % référence(s) de vente en doublon.', v_doublons;
  END IF;
END;
$preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_snp_artisan_ventes_numero_recu
  ON public.snp_artisan_ventes_or(numero_recu)
  WHERE numero_recu IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.snp_compteurs_ventes_or (
  annee integer PRIMARY KEY CHECK (annee BETWEEN 2000 AND 9999),
  dernier_numero integer NOT NULL CHECK (dernier_numero >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Le compteur reprend le maximum existant avant de commencer les réservations.
INSERT INTO public.snp_compteurs_ventes_or(annee, dernier_numero)
SELECT
  substring(numero_recu FROM '^VE-OR-([0-9]{4})-')::integer,
  max(substring(numero_recu FROM '([0-9]+)$')::integer)
FROM public.snp_artisan_ventes_or
WHERE numero_recu ~ '^VE-OR-[0-9]{4}-[0-9]{5}$'
GROUP BY substring(numero_recu FROM '^VE-OR-([0-9]{4})-')::integer
ON CONFLICT (annee) DO UPDATE
SET dernier_numero = greatest(
      public.snp_compteurs_ventes_or.dernier_numero,
      EXCLUDED.dernier_numero
    ),
    updated_at = now();

ALTER TABLE public.snp_compteurs_ventes_or ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snp_compteurs_ventes_or FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.snp_compteurs_ventes_or
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_numero_recu_vente_or()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
DECLARE
  annee_courante integer := extract(year FROM CURRENT_DATE)::integer;
  prochain integer;
BEGIN
  -- L'UPSERT verrouille la ligne de l'année et réserve définitivement le
  -- compteur. Une page abandonnée peut créer un trou, jamais un doublon.
  INSERT INTO public.snp_compteurs_ventes_or(annee, dernier_numero, updated_at)
  VALUES (annee_courante, 1, now())
  ON CONFLICT (annee) DO UPDATE
  SET dernier_numero = public.snp_compteurs_ventes_or.dernier_numero + 1,
      updated_at = now()
  RETURNING dernier_numero INTO prochain;

  RETURN 'VE-OR-' || annee_courante::text || '-' || lpad(prochain::text, 5, '0');
END;
$fn$;

REVOKE ALL ON FUNCTION public.generate_numero_recu_vente_or()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_numero_recu_vente_or()
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.snp_4h_calculer_vente_or_artisanale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.artisan_id IS NULL THEN
    RAISE EXCEPTION 'L''artisan vendeur est obligatoire.' USING ERRCODE = '23514';
  END IF;
  IF NEW.date_vente IS NULL OR NEW.date_vente > CURRENT_DATE THEN
    RAISE EXCEPTION 'La date de vente est obligatoire et ne peut pas être future.' USING ERRCODE = '23514';
  END IF;
  IF NEW.type_or IS NULL OR NEW.type_or NOT IN ('poudre', 'lingot', 'pepites', 'bijoux', 'autre') THEN
    RAISE EXCEPTION 'Le type d''or est invalide.' USING ERRCODE = '23514';
  END IF;
  IF NEW.quantite_grammes IS NULL OR NEW.quantite_grammes <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être strictement positive.' USING ERRCODE = '23514';
  END IF;
  IF NEW.purete_karat IS NULL OR NEW.purete_karat <= 0 OR NEW.purete_karat > 24 THEN
    RAISE EXCEPTION 'La pureté doit être comprise entre 0 et 24 carats.' USING ERRCODE = '23514';
  END IF;
  IF NEW.prix_kg_fcfa IS NULL OR NEW.prix_kg_fcfa <= 0 THEN
    RAISE EXCEPTION 'Le prix au kilogramme doit être strictement positif.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(NEW.tva_taux, 0) < 0 OR COALESCE(NEW.taxe_dev_comm_taux, 0) < 0 THEN
    RAISE EXCEPTION 'Les taux fiscaux ne peuvent pas être négatifs.' USING ERRCODE = '23514';
  END IF;
  IF NEW.statut IS NOT NULL AND NEW.statut NOT IN ('en_attente', 'validee', 'payee', 'annulee') THEN
    RAISE EXCEPTION 'Le statut de vente est invalide.' USING ERRCODE = '23514';
  END IF;

  NEW.numero_recu := COALESCE(NULLIF(btrim(NEW.numero_recu), ''), public.generate_numero_recu_vente_or());
  NEW.tva_taux := COALESCE(NEW.tva_taux, 0);
  NEW.taxe_dev_comm_taux := COALESCE(NEW.taxe_dev_comm_taux, 0);
  NEW.montant_brut_fcfa := round((NEW.quantite_grammes / 1000.0) * NEW.prix_kg_fcfa, 2);
  NEW.tva_montant_fcfa := round(NEW.montant_brut_fcfa * NEW.tva_taux / 100.0, 2);
  NEW.taxe_dev_comm_montant_fcfa := round(
    NEW.montant_brut_fcfa * NEW.taxe_dev_comm_taux / 100.0,
    2
  );
  NEW.montant_total_fcfa := round(
    NEW.montant_brut_fcfa
      + NEW.tva_montant_fcfa
      + NEW.taxe_dev_comm_montant_fcfa,
    2
  );

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_4h_calculer_vente_or_artisanale()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS snp_4h_calculer_vente_or ON public.snp_artisan_ventes_or;
CREATE TRIGGER snp_4h_calculer_vente_or
BEFORE INSERT OR UPDATE
ON public.snp_artisan_ventes_or
FOR EACH ROW EXECUTE FUNCTION public.snp_4h_calculer_vente_or_artisanale();

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.snp_artisan_ventes_or'::regclass
      AND tgname = 'snp_4h_calculer_vente_or'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Postflight : trigger de calcul de vente absent.';
  END IF;

  IF to_regclass('public.uq_snp_artisan_ventes_numero_recu') IS NULL THEN
    RAISE EXCEPTION 'Postflight : index unique des références absent.';
  END IF;
  IF to_regclass('public.snp_compteurs_ventes_or') IS NULL THEN
    RAISE EXCEPTION 'Postflight : compteur atomique des références absent.';
  END IF;
END;
$postflight$;

COMMIT;
