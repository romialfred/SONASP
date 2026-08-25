-- Contrat du referentiel fiscal versionne.
--
-- Ce que ce test garantit : deux regles ne peuvent jamais se disputer le meme
-- montant, un bareme progressif se resout par tranche, un changement de bareme
-- ne modifie pas une operation passee, et nul n'approuve sa propre regle.
--
-- La reproductibilite historique est l'exigence centrale : une facture de 2026
-- doit rester recalculable a l'identique apres modification du bareme en 2027.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

-- ---------------------------------------------------------------------------
-- 1. Structure
-- ---------------------------------------------------------------------------

SELECT has_table('public', 'snp_regles_fiscales', 'le referentiel fiscal existe');
SELECT has_table('public', 'snp_calculs_fiscaux', 'les instantanes de calcul existent');
SELECT has_function(
  'public', 'snp_resoudre_regle_fiscale', ARRAY['text', 'date', 'numeric', 'text'],
  'la regle applicable se resout par fonction'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'snp_regles_fiscales_pas_de_chevauchement'
  ),
  'le non-chevauchement est garanti par contrainte, non par code applicatif'
);

-- ---------------------------------------------------------------------------
-- 2. Un bareme progressif s'exprime par tranches contigues
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_regles_fiscales
  (id, code_taxe, libelle, assiette, mode_calcul, taux, seuil_min, seuil_max,
   unite_seuil, devise_seuil, date_effet, statut, approuve_par, approuve_le)
VALUES
  ('f0000000-0000-4000-8000-000000000001', 'royalties', 'Tranche A', 'produit_net',
   'tranche', 0.03, 0, 1000, 'USD/oz', 'USD', '2026-01-01', 'approuvee',
   (SELECT id FROM public.user_profiles LIMIT 1), now()),
  ('f0000000-0000-4000-8000-000000000002', 'royalties', 'Tranche B', 'produit_net',
   'tranche', 0.04, 1000, 1300, 'USD/oz', 'USD', '2026-01-01', 'approuvee',
   (SELECT id FROM public.user_profiles LIMIT 1), now()),
  ('f0000000-0000-4000-8000-000000000003', 'royalties', 'Tranche C', 'produit_net',
   'tranche', 0.05, 1300, NULL, 'USD/oz', 'USD', '2026-01-01', 'approuvee',
   (SELECT id FROM public.user_profiles LIMIT 1), now());

SELECT is(
  (SELECT count(*)::integer FROM public.snp_regles_fiscales WHERE code_taxe = 'royalties'),
  3,
  'trois tranches contigues coexistent sans se recouvrir'
);

-- ---------------------------------------------------------------------------
-- 3. Aucun chevauchement possible
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.snp_regles_fiscales
      (code_taxe, libelle, assiette, mode_calcul, taux, seuil_min, seuil_max,
       unite_seuil, devise_seuil, date_effet, statut)
    VALUES ('royalties', 'Tranche chevauchante', 'produit_net', 'tranche', 0.09,
            1200, 1400, 'USD/oz', 'USD', '2026-01-01', 'projet')$$,
  '23P01',
  NULL,
  'une tranche qui recouvre une autre est refusee'
);

INSERT INTO public.snp_regles_fiscales
  (code_taxe, libelle, assiette, mode_calcul, taux, date_effet, statut)
VALUES ('tva', 'TVA de reference', 'ca_ht', 'taux', 0.18, '2026-01-01', 'projet');

SELECT throws_ok(
  $$INSERT INTO public.snp_regles_fiscales
      (code_taxe, libelle, assiette, mode_calcul, taux, date_effet, statut)
    VALUES ('tva', 'TVA concurrente', 'ca_ht', 'taux', 0.15, '2026-06-01', 'projet')$$,
  '23P01',
  NULL,
  'deux taux d''une meme taxe ne peuvent couvrir la meme periode'
);

-- ---------------------------------------------------------------------------
-- 4. Resolution par tranche
-- ---------------------------------------------------------------------------

SELECT is(
  (SELECT taux FROM public.snp_resoudre_regle_fiscale('royalties', '2026-06-15', 800)),
  0.03::numeric,
  'un cours de 800 releve de la premiere tranche'
);

SELECT is(
  (SELECT taux FROM public.snp_resoudre_regle_fiscale('royalties', '2026-06-15', 1100)),
  0.04::numeric,
  'un cours de 1100 releve de la deuxieme tranche'
);

SELECT is(
  (SELECT taux FROM public.snp_resoudre_regle_fiscale('royalties', '2026-06-15', 2000)),
  0.05::numeric,
  'un cours au-dela du dernier seuil releve de la tranche ouverte'
);

-- ---------------------------------------------------------------------------
-- 5. Reproductibilite historique
-- ---------------------------------------------------------------------------
-- Le bareme change en 2027 ; une operation de 2026 doit continuer de resoudre
-- le taux qui lui etait applicable.

UPDATE public.snp_regles_fiscales
   SET date_fin = '2027-01-01'
 WHERE id = 'f0000000-0000-4000-8000-000000000002';

INSERT INTO public.snp_regles_fiscales
  (code_taxe, libelle, assiette, mode_calcul, taux, seuil_min, seuil_max,
   unite_seuil, devise_seuil, date_effet, statut, approuve_par, approuve_le)
VALUES
  ('royalties', 'Tranche B revisee', 'produit_net', 'tranche', 0.07, 1000, 1300,
   'USD/oz', 'USD', '2027-01-01', 'approuvee',
   (SELECT id FROM public.user_profiles LIMIT 1), now());

SELECT is(
  (SELECT taux FROM public.snp_resoudre_regle_fiscale('royalties', '2026-06-15', 1100)),
  0.04::numeric,
  'une operation de 2026 conserve le taux qui lui etait applicable'
);

SELECT is(
  (SELECT taux FROM public.snp_resoudre_regle_fiscale('royalties', '2027-06-15', 1100)),
  0.07::numeric,
  'une operation de 2027 applique le bareme revise'
);

-- ---------------------------------------------------------------------------
-- 6. Garde-fous de valeur et separation des taches
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.snp_regles_fiscales
      (code_taxe, libelle, assiette, mode_calcul, taux, date_effet, statut)
    VALUES ('fndl', 'FNDL aberrant', 'ca_ht', 'taux', 1.5, '2026-01-01', 'projet')$$,
  '23514',
  NULL,
  'un taux superieur ou egal a 1 est refuse'
);

SELECT throws_ok(
  $$INSERT INTO public.snp_regles_fiscales
      (code_taxe, libelle, assiette, mode_calcul, taux, date_effet, statut,
       cree_par, approuve_par, approuve_le)
    SELECT 'fndl', 'FNDL auto-approuve', 'ca_ht', 'taux', 0.01, '2026-01-01',
           'approuvee', id, id, now()
      FROM public.user_profiles LIMIT 1$$,
  '23514',
  NULL,
  'nul n''approuve sa propre regle fiscale'
);

SELECT * FROM finish();

ROLLBACK;
