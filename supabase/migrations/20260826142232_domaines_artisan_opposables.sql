-- Le code affirme un domaine que la base n'imposait pas.
--
-- CONSTAT
-- L'interface ArtisanMinier declare type_personne comme « physique | morale » et
-- type_artisan comme « exploitant | collecteur | intermediaire | fournisseur ».
-- En base, les deux colonnes sont du texte libre, sans aucune contrainte : rien
-- n'empechait d'y ecrire n'importe quoi, et le compilateur signalait a juste
-- titre que la promesse du code n'etait pas tenue.
--
-- ETAT VERIFIE AVANT D'AGIR
--   type_personne : physique 51, morale 13
--   type_artisan  : exploitant 29, collecteur 15, intermediaire 12, fournisseur 8
-- Aucune valeur hors domaine. La contrainte peut donc etre posee sans rien
-- rejeter de l'existant.
--
-- POURQUOI CONTRAINDRE PLUTOT QU'ELARGIR LE TYPE
-- Elargir l'union TypeScript a « string » aurait fait taire le compilateur en
-- abandonnant le sens : un ecran ne saurait plus quelles valeurs afficher, et
-- une faute de frappe passerait jusqu'en base. On rend au contraire la promesse
-- vraie la ou elle doit l'etre, dans la base.

BEGIN;

DO $$
DECLARE
  v_hors_domaine integer;
BEGIN
  SELECT count(*) INTO v_hors_domaine FROM public.snp_artisans_miniers
  WHERE type_personne NOT IN ('physique', 'morale');
  IF v_hors_domaine > 0 THEN
    RAISE EXCEPTION
      'Preflight : % artisan(s) portent un type_personne hors domaine. La contrainte les rejetterait.',
      v_hors_domaine;
  END IF;

  SELECT count(*) INTO v_hors_domaine FROM public.snp_artisans_miniers
  WHERE type_artisan NOT IN ('exploitant', 'collecteur', 'intermediaire', 'fournisseur');
  IF v_hors_domaine > 0 THEN
    RAISE EXCEPTION
      'Preflight : % artisan(s) portent un type_artisan hors domaine.',
      v_hors_domaine;
  END IF;
END;
$$;

ALTER TABLE public.snp_artisans_miniers
  DROP CONSTRAINT IF EXISTS snp_artisans_miniers_type_personne_check;
ALTER TABLE public.snp_artisans_miniers
  ADD CONSTRAINT snp_artisans_miniers_type_personne_check
  CHECK (type_personne IN ('physique', 'morale'));

ALTER TABLE public.snp_artisans_miniers
  DROP CONSTRAINT IF EXISTS snp_artisans_miniers_type_artisan_check;
ALTER TABLE public.snp_artisans_miniers
  ADD CONSTRAINT snp_artisans_miniers_type_artisan_check
  CHECK (type_artisan IN ('exploitant', 'collecteur', 'intermediaire', 'fournisseur'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
    WHERE c.relname = 'snp_artisans_miniers'
      AND con.conname = 'snp_artisans_miniers_type_personne_check'
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte sur type_personne est absente.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
    WHERE c.relname = 'snp_artisans_miniers'
      AND con.conname = 'snp_artisans_miniers_type_artisan_check'
  ) THEN
    RAISE EXCEPTION 'Postflight : la contrainte sur type_artisan est absente.';
  END IF;
END;
$$;

COMMIT;
