-- La taxe de developpement communal entre au referentiel.
--
-- POURQUOI
-- Deux ecrans d'achat — achat aux mines et achat d'or aux artisans — appliquent
-- une taxe de developpement communal de 1 %, ecrite en dur dans le code
-- (TAXE_DEV_COMM_TAUX_DEFAUT). Pour que ces achats lisent le bareme comme le
-- fait la conciliation, il faut que cette taxe existe dans le referentiel.
--
-- CE TAUX N'EST PAS UNE DECISION NOUVELLE
-- 1 % est exactement ce que la plateforme applique aujourd'hui. On transcrit
-- l'existant pour le rendre modifiable, sans rien changer au calcul. Si le
-- bareme opposable dit autre chose, il se corrige depuis l'ecran.
--
-- ASSIETTE
-- 'ca_ht', comme la TVA de ces memes achats : les deux taxes s'appliquent au
-- montant brut et s'ajoutent au prix verse au vendeur, la SONASP les acquittant
-- en sus. C'est le calcul en vigueur, transcrit tel quel.
--
-- STATUT : PROJET
-- La regle nait sans auteur. Un acteur habilite l'approuve depuis l'ecran, ce
-- qui inscrit son nom et la date au dossier — meme regle que pour le bareme.
--
-- RETOUR ARRIERE
--   DELETE FROM public.snp_regles_fiscales WHERE commentaire LIKE 'BAREME-2026-COMMUNALE%';

BEGIN;

INSERT INTO public.snp_regles_fiscales (
  code_taxe, libelle, assiette, mode_calcul, taux,
  profil_vendeur, categorie_acheteur, date_effet, commentaire, statut
)
SELECT 'taxe_communale', 'Taxe de developpement communal', 'ca_ht', 'taux', 0.01,
       'tous', 'standard', DATE '2026-08-26',
       'BAREME-2026-COMMUNALE : transcription du taux applique en dur par les ecrans d''achat, pour le rendre modifiable. Aucun changement de calcul.',
       'projet'
WHERE NOT EXISTS (
  SELECT 1 FROM public.snp_regles_fiscales WHERE commentaire LIKE 'BAREME-2026-COMMUNALE%'
);

DO $$
DECLARE v_creee integer;
BEGIN
  SELECT count(*) INTO v_creee FROM public.snp_regles_fiscales
  WHERE commentaire LIKE 'BAREME-2026-COMMUNALE%' AND statut = 'projet';
  IF v_creee <> 1 THEN
    RAISE EXCEPTION 'Postflight : % regle communale en projet au lieu de 1.', v_creee;
  END IF;
END;
$$;

COMMIT;
