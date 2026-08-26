-- Un paiement d'artisan a toujours un statut ; la colonne ne le disait pas.
--
-- CONSTAT
-- snp_artisan_paiements.statut porte une contrainte de domaine et un defaut
-- 'en_attente', mais reste declaree nullable. Le contrat TypeScript en heritait
-- « union | null », ce qui obligeait chaque ecran a garder l'absence — et
-- plusieurs indexaient leurs libelles par ce statut, ce qui aurait donne un
-- libelle vide plutot qu'une erreur franche.
--
-- ETAT VERIFIE AVANT D'AGIR
--   26 paiements, aucun sans statut, defaut 'en_attente' deja en place.
-- Rendre la colonne obligatoire ne rejette donc aucune ligne existante et
-- n'exige rien de nouveau a l'ecriture : le defaut s'applique.
--
-- POURQUOI CORRIGER LE SCHEMA PLUTOT QUE LES ECRANS
-- Garder l'absence a dix endroits aurait fait taire le compilateur en laissant
-- croire qu'un paiement sans statut est un cas legitime. Il ne l'est pas.

BEGIN;

DO $$
DECLARE v_nuls integer;
BEGIN
  SELECT count(*) INTO v_nuls FROM public.snp_artisan_paiements WHERE statut IS NULL;
  IF v_nuls > 0 THEN
    RAISE EXCEPTION
      'Preflight : % paiement(s) sans statut. Les renseigner avant de rendre la colonne obligatoire.',
      v_nuls;
  END IF;
END;
$$;

ALTER TABLE public.snp_artisan_paiements
  ALTER COLUMN statut SET DEFAULT 'en_attente',
  ALTER COLUMN statut SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'snp_artisan_paiements'
      AND column_name = 'statut' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Postflight : la colonne statut reste nullable.';
  END IF;
END;
$$;

COMMIT;
