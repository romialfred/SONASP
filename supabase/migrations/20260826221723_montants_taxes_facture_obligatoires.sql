-- Les montants de taxe d'une facture definitive ne peuvent pas etre inconnus.
--
-- CONSTAT
-- Cinq colonnes de snp_artisan_factures_definitives portent un defaut a zero
-- mais restent nullables : montant_taxe_tva, montant_taxe_retenue_source,
-- montant_autres_taxes, taux_tva, taux_retenue_source. Le contrat TypeScript en
-- heritait « number | null », et le generateur de PDF appelait
-- .toLocaleString() directement dessus :
--
--   facture.montant_taxe_tva.toLocaleString('fr-FR')
--
-- Sur une valeur absente, c'est un TypeError et la facture n'est pas produite —
-- le meme mecanisme que le crash survenu en presentation cette semaine.
--
-- ETAT VERIFIE AVANT D'AGIR
--   32 factures, aucune valeur nulle sur ces cinq colonnes, defaut 0 en place.
-- Rendre les colonnes obligatoires ne rejette donc aucune ligne existante et
-- n'exige rien de nouveau a l'ecriture.
--
-- POURQUOI CORRIGER LE SCHEMA PLUTOT QUE LE GENERATEUR
-- Garder l'absence dans le PDF aurait fait ecrire « — » sur une facture la ou un
-- montant est attendu. Une taxe non due vaut zero ; elle n'est pas inconnue.
-- Un montant absent sur une piece fiscale n'est pas un cas legitime.

BEGIN;

DO $$
DECLARE v_nuls integer;
BEGIN
  SELECT count(*) INTO v_nuls FROM public.snp_artisan_factures_definitives
  WHERE montant_taxe_tva IS NULL
     OR montant_taxe_retenue_source IS NULL
     OR montant_autres_taxes IS NULL
     OR taux_tva IS NULL
     OR taux_retenue_source IS NULL;
  IF v_nuls > 0 THEN
    RAISE EXCEPTION
      'Preflight : % facture(s) portent un montant ou un taux de taxe absent. Les renseigner avant de rendre les colonnes obligatoires.',
      v_nuls;
  END IF;
END;
$$;

ALTER TABLE public.snp_artisan_factures_definitives
  ALTER COLUMN montant_taxe_tva SET DEFAULT 0,
  ALTER COLUMN montant_taxe_tva SET NOT NULL,
  ALTER COLUMN montant_taxe_retenue_source SET DEFAULT 0,
  ALTER COLUMN montant_taxe_retenue_source SET NOT NULL,
  ALTER COLUMN montant_autres_taxes SET DEFAULT 0,
  ALTER COLUMN montant_autres_taxes SET NOT NULL,
  ALTER COLUMN taux_tva SET DEFAULT 0,
  ALTER COLUMN taux_tva SET NOT NULL,
  ALTER COLUMN taux_retenue_source SET DEFAULT 0,
  ALTER COLUMN taux_retenue_source SET NOT NULL;

DO $$
DECLARE v_restantes integer;
BEGIN
  SELECT count(*) INTO v_restantes FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'snp_artisan_factures_definitives'
    AND is_nullable = 'YES'
    AND column_name IN ('montant_taxe_tva', 'montant_taxe_retenue_source',
                        'montant_autres_taxes', 'taux_tva', 'taux_retenue_source');
  IF v_restantes > 0 THEN
    RAISE EXCEPTION 'Postflight : % colonne(s) restent nullables.', v_restantes;
  END IF;
END;
$$;

COMMIT;
