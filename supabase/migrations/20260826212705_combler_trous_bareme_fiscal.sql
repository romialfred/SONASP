-- Comble les deux trous de couverture mesures apres l'approbation du bareme.
--
-- DECISIONS PRISES PAR LE COMMANDITAIRE, LE 26 AOUT 2026
--
-- 1. REDEVANCE SOUS 4 000 USD/oz
-- Le bareme approuve commencait a 4 000 USD/oz ; en deca, aucune regle ne
-- s'appliquait et la conciliation signalait la redevance comme non calculee.
-- Deux ventes sur dix-neuf sont concernees, le cours minimum en base etant
-- 2 365 USD/oz. La tranche basse est prolongee au meme taux, 3 %, ce qui rend le
-- bareme continu de zero a l'infini.
--
-- 2. TVA DES VENTES SONASP
-- La TVA n'existait que pour les profils 'comptoir' (1,5 %) et
-- 'mine_industrielle' (0 %). Douze ventes sur dix-neuf portent seller_type
-- 'sonasp' et sont donc resolues sous le profil 'tous', pour lequel aucune regle
-- n'existait. L'origine de l'or n'est pas enregistree sur la vente — la seule
-- table qui pourrait la porter, snp_ventes_lots, est vide — le taux ne peut donc
-- pas s'en deduire. La SONASP est traitee comme un vendeur industriel : 0 %.
--
-- POURQUOI LE PROFIL 'tous' NE PERTURBE PAS LES DEUX AUTRES
-- snp_resoudre_regle_fiscale ordonne par
-- « (profil_vendeur = p_profil) DESC » : une regle portant le profil exact
-- l'emporte toujours sur une regle 'tous'. Un comptoir garde donc ses 1,5 % et
-- une mine ses 0 %. La regle 'tous' ne sert qu'aux ventes non qualifiees.
-- Verifie par simulation avant application, sur trois profils et cinq cours.
--
-- STATUT : PROJET
-- Les deux regles naissent en projet, sans auteur. Un acteur habilite les
-- approuve depuis l'ecran, ce qui inscrit son nom et la date au dossier.
-- Attribuer ici une approbation a un compte qui ne l'a pas donnee falsifierait
-- cette trace — meme raison que pour le bareme lui-meme.
--
-- RETOUR ARRIERE
--   DELETE FROM public.snp_regles_fiscales WHERE commentaire LIKE 'BAREME-2026-COMPLEMENT%';

BEGIN;

INSERT INTO public.snp_regles_fiscales (
  code_taxe, libelle, assiette, mode_calcul, taux,
  seuil_min, seuil_max, unite_seuil, devise_seuil,
  profil_vendeur, categorie_acheteur, date_effet, commentaire, statut
)
SELECT v.code_taxe, v.libelle, v.assiette, v.mode_calcul, v.taux,
       v.seuil_min, v.seuil_max, v.unite_seuil, v.devise_seuil,
       v.profil_vendeur, 'standard', DATE '2026-08-26', v.commentaire, 'projet'
FROM (VALUES
  ('royalties', 'Redevance jusqu''a 4 000 USD/oz', 'produit_net', 'tranche', 0.03,
   0::numeric, 4000::numeric, 'USD/oz'::text, 'USD'::text, 'tous',
   'BAREME-2026-COMPLEMENT : prolongement de la tranche basse, decide le 26 aout 2026.'),
  ('tva', 'TVA des ventes SONASP', 'ca_ht', 'taux', 0.000,
   NULL, NULL, NULL, NULL, 'tous',
   'BAREME-2026-COMPLEMENT : la SONASP est traitee comme un vendeur industriel. L''origine de l''or n''etant pas enregistree, le taux ne peut s''en deduire.')
) AS v(code_taxe, libelle, assiette, mode_calcul, taux, seuil_min, seuil_max,
       unite_seuil, devise_seuil, profil_vendeur, commentaire)
WHERE NOT EXISTS (
  SELECT 1 FROM public.snp_regles_fiscales r
  WHERE r.commentaire LIKE 'BAREME-2026-COMPLEMENT%' AND r.code_taxe = v.code_taxe
);

DO $$
DECLARE v_creees integer;
BEGIN
  SELECT count(*) INTO v_creees FROM public.snp_regles_fiscales
  WHERE commentaire LIKE 'BAREME-2026-COMPLEMENT%';
  IF v_creees <> 2 THEN
    RAISE EXCEPTION 'Postflight : % regle(s) creee(s) au lieu de 2.', v_creees;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.snp_regles_fiscales
    WHERE commentaire LIKE 'BAREME-2026-COMPLEMENT%' AND statut <> 'projet'
  ) THEN
    RAISE EXCEPTION 'Postflight : une regle de complement n''est pas en projet.';
  END IF;
END;
$$;

COMMIT;
