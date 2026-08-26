-- Baremes fiscaux connus du metier, saisis au referentiel.
--
-- CONSTAT
-- Le referentiel portait cinq regles de demonstration, toutes marquees
-- « DEMO-20260826 : taux illustratif, sans valeur juridique » et « A confirmer » :
-- TVA a 18 %, redevance a 3/4/5 % sur des tranches de 0 a 1 300 USD/oz. Ces
-- valeurs contredisent le bareme que le metier a depuis precise. Les laisser en
-- vigueur ferait calculer la conciliation sur des taux faux.
--
-- POURQUOI CLORE PLUTOT QUE SUPPRIMER
-- Trois instantanes de calcul se rattachent deja a ces regles : un dossier de
-- demonstration a ete valide avec elles. Les effacer romprait la justification
-- de montants deja arretes, ce que la cle etrangere interdit d'ailleurs. Elles
-- recoivent donc une date de fin, mecanisme prevu par le modele : elles cessent
-- de s'appliquer sans cesser d'expliquer le passe. Le bareme confirme prend
-- effet le jour ou il est saisi ; les operations anterieures conservent la regle
-- qui leur etait applicable.
--
-- BAREME SAISI, a effet du 26 aout 2026
--   TVA        comptoir d'achat ......... 1,5 % du chiffre d'affaires HT
--   TVA        mine industrielle ........ 0 % du chiffre d'affaires HT
--   FNDL       tous vendeurs ............ 1 % du chiffre d'affaires HT
--   Redevance  4 000 a 4 500 USD/oz ..... 3 % du produit net
--   Redevance  4 500 a 5 000 USD/oz ..... 5 % du produit net
--   Redevance  au-dela de 5 000 USD/oz .. 6 % du produit net
--
-- Les deux regimes de TVA visent indifferemment une cession a la SONASP ou a
-- l'international : c'est le vendeur qui les distingue, non l'acheteur. D'ou
-- profil_vendeur, et categorie_acheteur laissee a 'standard'.
--
-- RESERVE ASSUMEE
-- Le bareme de redevance commence a 4 000 USD/oz. En deca, aucune regle n'existe :
-- la conciliation signalera la redevance comme non calculee plutot que de
-- supposer un taux. Aucune tranche basse n'est inventee ici.
--
-- STATUT
-- Les regles naissent en projet, sans auteur. Un acteur habilite les approuve
-- depuis l'ecran, ce qui inscrit son nom et la date au dossier. Attribuer ici une
-- approbation a un compte qui ne l'a pas donnee falsifierait cette trace.
--
-- RETOUR ARRIERE
--   DELETE FROM public.snp_regles_fiscales WHERE commentaire LIKE 'BAREME-2026%';
--   UPDATE public.snp_regles_fiscales SET date_fin = NULL
--    WHERE commentaire LIKE 'DEMO-20260826%';

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Cloture des taux de demonstration
-- ---------------------------------------------------------------------------

UPDATE public.snp_regles_fiscales
   SET date_fin = DATE '2026-08-26',
       updated_at = now()
 WHERE commentaire LIKE 'DEMO-20260826%'
   AND statut = 'approuvee'
   AND date_fin IS NULL
   AND date_effet < DATE '2026-08-26';

-- ---------------------------------------------------------------------------
-- 2. Bareme confirme
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_regles_fiscales (
  code_taxe, libelle, assiette, mode_calcul, taux,
  seuil_min, seuil_max, unite_seuil, devise_seuil,
  profil_vendeur, categorie_acheteur, date_effet, commentaire, statut
)
SELECT v.code_taxe, v.libelle, v.assiette, v.mode_calcul, v.taux,
       v.seuil_min, v.seuil_max, v.unite_seuil, v.devise_seuil,
       v.profil_vendeur, 'standard', DATE '2026-08-26', v.commentaire, 'projet'
FROM (VALUES
  ('tva', 'TVA des comptoirs d''achat', 'ca_ht', 'taux', 0.015,
   NULL::numeric, NULL::numeric, NULL::text, NULL::text, 'comptoir',
   'BAREME-2026 : ventes a la SONASP comme a l''international.'),
  ('tva', 'TVA des mines industrielles', 'ca_ht', 'taux', 0.000,
   NULL, NULL, NULL, NULL, 'mine_industrielle',
   'BAREME-2026 : ventes a la SONASP comme a l''international.'),
  ('fndl', 'FNDL sur le chiffre d''affaires', 'ca_ht', 'taux', 0.01,
   NULL, NULL, NULL, NULL, 'tous',
   'BAREME-2026 : 1 % du chiffre d''affaires.'),
  ('royalties', 'Redevance de 4 000 a 4 500 USD/oz', 'produit_net', 'tranche', 0.03,
   4000, 4500, 'USD/oz', 'USD', 'tous',
   'BAREME-2026 : premiere tranche du bareme progressif.'),
  ('royalties', 'Redevance de 4 500 a 5 000 USD/oz', 'produit_net', 'tranche', 0.05,
   4500, 5000, 'USD/oz', 'USD', 'tous',
   'BAREME-2026 : deuxieme tranche du bareme progressif.'),
  ('royalties', 'Redevance au-dela de 5 000 USD/oz', 'produit_net', 'tranche', 0.06,
   5000, NULL, 'USD/oz', 'USD', 'tous',
   'BAREME-2026 : tranche ouverte du bareme progressif.')
) AS v(code_taxe, libelle, assiette, mode_calcul, taux,
       seuil_min, seuil_max, unite_seuil, devise_seuil, profil_vendeur, commentaire)
WHERE NOT EXISTS (
  SELECT 1 FROM public.snp_regles_fiscales r WHERE r.libelle = v.libelle
);

-- ---------------------------------------------------------------------------
-- Postflight
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_demo_ouvertes integer;
  v_bareme integer;
  v_calculs integer;
BEGIN
  SELECT count(*) INTO v_demo_ouvertes
  FROM public.snp_regles_fiscales
  WHERE commentaire LIKE 'DEMO-20260826%' AND statut = 'approuvee' AND date_fin IS NULL;
  IF v_demo_ouvertes > 0 THEN
    RAISE EXCEPTION 'Postflight : % regle(s) de demonstration restent sans date de fin.', v_demo_ouvertes;
  END IF;

  -- Les justificatifs de calcul deja produits doivent survivre a la cloture.
  SELECT count(*) INTO v_calculs FROM public.snp_calculs_fiscaux;
  IF v_calculs = 0 THEN
    RAISE EXCEPTION 'Postflight : les instantanes de calcul ont disparu.';
  END IF;

  SELECT count(*) INTO v_bareme
  FROM public.snp_regles_fiscales WHERE commentaire LIKE 'BAREME-2026%';
  IF v_bareme <> 6 THEN
    RAISE EXCEPTION 'Postflight : 6 regles attendues au bareme, % presentes.', v_bareme;
  END IF;

  -- Les trois tranches de redevance doivent se suivre sans trou ni recouvrement.
  IF EXISTS (
    SELECT 1 FROM (
      SELECT seuil_max, lead(seuil_min) OVER (ORDER BY seuil_min) AS suivant
      FROM public.snp_regles_fiscales
      WHERE code_taxe = 'royalties' AND commentaire LIKE 'BAREME-2026%'
    ) t
    WHERE t.suivant IS NOT NULL AND t.suivant IS DISTINCT FROM t.seuil_max
  ) THEN
    RAISE EXCEPTION 'Postflight : le bareme de redevance presente un trou ou un recouvrement.';
  END IF;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
