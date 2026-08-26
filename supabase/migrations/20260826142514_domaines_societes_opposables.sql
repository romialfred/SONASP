-- Deux domaines de plus que le code affirmait sans que la base les impose.
--
-- CONSTAT
-- transport_companies.company_type est declare cote code
-- « mine_to_airport | airport_to_refinery | both », et mining_companies.company_type
-- « production_mine | institution | parent_company ». En base, les deux colonnes
-- sont du texte libre.
--
-- ETAT VERIFIE AVANT D'AGIR
--   transport_companies : airport_to_refinery 2
--   mining_companies    : production_mine 6, institution 1, parent_company 1
-- Aucune valeur hors domaine.
--
-- REDONDANCE ASSUMEE SUR mining_companies
-- Constate apres coup : le contrat TypeScript type deja cette colonne par
-- l'enumeration company_type_enum, ce qui signifie que la base la contraint
-- deja. La contrainte ajoutee ici est donc redondante. Elle est inoffensive et
-- exprime la meme regle ; on ne la retire pas pour ne pas multiplier les
-- migrations, mais elle n'apporte rien.

BEGIN;

DO $$
DECLARE v_hors integer;
BEGIN
  SELECT count(*) INTO v_hors FROM public.transport_companies
  WHERE company_type IS NOT NULL
    AND company_type NOT IN ('mine_to_airport', 'airport_to_refinery', 'both');
  IF v_hors > 0 THEN
    RAISE EXCEPTION 'Preflight : % transporteur(s) hors domaine.', v_hors;
  END IF;

  SELECT count(*) INTO v_hors FROM public.mining_companies
  WHERE company_type IS NOT NULL
    AND company_type NOT IN ('production_mine', 'institution', 'parent_company');
  IF v_hors > 0 THEN
    RAISE EXCEPTION 'Preflight : % societe(s) miniere(s) hors domaine.', v_hors;
  END IF;
END;
$$;

ALTER TABLE public.transport_companies
  DROP CONSTRAINT IF EXISTS transport_companies_company_type_check;
ALTER TABLE public.transport_companies
  ADD CONSTRAINT transport_companies_company_type_check
  CHECK (company_type IN ('mine_to_airport', 'airport_to_refinery', 'both'));

ALTER TABLE public.mining_companies
  DROP CONSTRAINT IF EXISTS mining_companies_company_type_check;
ALTER TABLE public.mining_companies
  ADD CONSTRAINT mining_companies_company_type_check
  CHECK (company_type IN ('production_mine', 'institution', 'parent_company'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
                 WHERE c.relname='transport_companies' AND con.conname='transport_companies_company_type_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
                 WHERE c.relname='mining_companies' AND con.conname='mining_companies_company_type_check') THEN
    RAISE EXCEPTION 'Postflight : une contrainte de domaine est absente.';
  END IF;
END;
$$;

COMMIT;
