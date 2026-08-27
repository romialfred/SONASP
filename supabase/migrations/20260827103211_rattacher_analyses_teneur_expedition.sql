-- Les analyses de teneur peuvent desormais se rattacher a une expedition
-- et a un certificat de raffinerie.
--
-- CONSTAT (reconnaissance du 27 aout, R-25)
-- snp_analyses_teneur ne connaissait que le contrat, la requisition, l'achat et
-- la societe : une analyse portant sur l'or d'une expedition ne pouvait pas le
-- dire. Et snp_analyses_resultats.certificat_reference etait un texte libre :
-- aucune cle ne reliait un resultat au certificat qu'il cite.
--
-- CE QUI EST AJOUTE, additif et nullable
-- - snp_analyses_teneur.shipping_preparation_id -> shipping_preparations ;
--   la contrainte de rattachement l'admet comme ancre valide.
-- - snp_analyses_resultats.assay_certificate_id -> assay_certificates ;
--   le texte libre subsiste pour l'historique, la cle fait foi desormais.
--
-- PORTEE ASSUMEE
-- Aucune donnee n'existe encore dans ces tables (0 ligne chacune) : pas de
-- reprise. L'affichage de ces analyses dans le dossier complet suivra quand la
-- branche locale portera des donnees ; les cles posees ici l'y preparent.

BEGIN;

ALTER TABLE public.snp_analyses_teneur
  ADD COLUMN IF NOT EXISTS shipping_preparation_id uuid
  REFERENCES public.shipping_preparations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.snp_analyses_teneur.shipping_preparation_id IS
  'Expedition dont provient l''or analyse, lorsque l''analyse porte sur un lot expedie.';

CREATE INDEX IF NOT EXISTS snp_analyses_teneur_expedition_idx
  ON public.snp_analyses_teneur (shipping_preparation_id)
  WHERE shipping_preparation_id IS NOT NULL;

ALTER TABLE public.snp_analyses_teneur DROP CONSTRAINT IF EXISTS snp_analyse_rattachee;
ALTER TABLE public.snp_analyses_teneur ADD CONSTRAINT snp_analyse_rattachee
  CHECK (contrat_id IS NOT NULL OR requisition_id IS NOT NULL
      OR achat_id IS NOT NULL OR mining_company_id IS NOT NULL
      OR shipping_preparation_id IS NOT NULL);

ALTER TABLE public.snp_analyses_resultats
  ADD COLUMN IF NOT EXISTS assay_certificate_id uuid
  REFERENCES public.assay_certificates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.snp_analyses_resultats.assay_certificate_id IS
  'Certificat de raffinerie cite par ce resultat. Remplace le texte libre certificat_reference comme reference faisant foi.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='snp_analyses_teneur'
      AND column_name='shipping_preparation_id') THEN
    RAISE EXCEPTION 'Postflight : le lien analyse -> expedition est absent.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='snp_analyses_resultats'
      AND column_name='assay_certificate_id') THEN
    RAISE EXCEPTION 'Postflight : le lien resultat -> certificat est absent.';
  END IF;
END;
$$;

COMMIT;
