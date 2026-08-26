-- Jeu de demonstration de la conciliation, ajoute a la demande expresse du
-- commanditaire pour que les ecrans soient exploitables des la premiere visite.
--
-- CE QU'IL FAUT SAVOIR POUR LE RETIRER
-- Tout ce qui suit porte la marque « DEMO-20260826 » : les regles fiscales dans
-- leur commentaire, les dossiers dans leurs observations. Le retrait tient en
-- deux instructions, rappelees en fin de fichier.
--
-- LES TAUX NE SONT PAS UNE VERITE JURIDIQUE. Ils illustrent le fonctionnement du
-- moteur : TVA a 18 %, FNDL a 1 %, redevance progressive en trois tranches selon
-- le cours. Chacun porte une reference explicite « a confirmer » et devra etre
-- remplace par le bareme opposable.

-- ---------------------------------------------------------------------------
-- 1. Baremes de demonstration
-- ---------------------------------------------------------------------------

WITH acteurs AS (
  SELECT
    (SELECT id FROM public.user_profiles WHERE role = 'owner' AND is_active LIMIT 1) AS auteur,
    (SELECT id FROM public.user_profiles WHERE role <> 'owner' AND is_active ORDER BY created_at LIMIT 1) AS approbateur
)
INSERT INTO public.snp_regles_fiscales (
  code_taxe, libelle, assiette, mode_calcul, taux,
  seuil_min, seuil_max, unite_seuil, devise_seuil,
  date_effet, reference_reglementaire, commentaire, statut,
  cree_par, approuve_par, approuve_le
)
SELECT * FROM (
  SELECT
    'tva'::text, 'TVA sur ventes d''or'::text, 'ca_ht'::text, 'taux'::text, 0.18::numeric,
    NULL::numeric, NULL::numeric, NULL::text, NULL::text,
    '2026-01-01'::date, 'A confirmer aupres de la DGI'::text,
    'DEMO-20260826 : taux illustratif, sans valeur juridique.'::text, 'approuvee'::text,
    a.auteur, a.approbateur, now()
  FROM acteurs a
  UNION ALL
  SELECT
    'fndl', 'Fonds national de developpement local', 'ca_ht', 'taux', 0.01,
    NULL, NULL, NULL, NULL,
    '2026-01-01', 'A confirmer : 1 % evoque par le metier',
    'DEMO-20260826 : taux illustratif, sans valeur juridique.', 'approuvee',
    a.auteur, a.approbateur, now()
  FROM acteurs a
  UNION ALL
  SELECT
    'royalties', 'Redevance, tranche basse', 'produit_net', 'tranche', 0.03,
    0, 1000, 'USD/oz', 'USD',
    '2026-01-01', 'A confirmer : bareme progressif selon le cours',
    'DEMO-20260826 : taux illustratif, sans valeur juridique.', 'approuvee',
    a.auteur, a.approbateur, now()
  FROM acteurs a
  UNION ALL
  SELECT
    'royalties', 'Redevance, tranche mediane', 'produit_net', 'tranche', 0.04,
    1000, 1300, 'USD/oz', 'USD',
    '2026-01-01', 'A confirmer : bareme progressif selon le cours',
    'DEMO-20260826 : taux illustratif, sans valeur juridique.', 'approuvee',
    a.auteur, a.approbateur, now()
  FROM acteurs a
  UNION ALL
  SELECT
    'royalties', 'Redevance, tranche haute', 'produit_net', 'tranche', 0.05,
    1300, NULL, 'USD/oz', 'USD',
    '2026-01-01', 'A confirmer : bareme progressif selon le cours',
    'DEMO-20260826 : taux illustratif, sans valeur juridique.', 'approuvee',
    a.auteur, a.approbateur, now()
  FROM acteurs a
) AS baremes(code_taxe, libelle, assiette, mode_calcul, taux, seuil_min, seuil_max,
             unite_seuil, devise_seuil, date_effet, reference_reglementaire,
             commentaire, statut, cree_par, approuve_par, approuve_le)
WHERE NOT EXISTS (
  SELECT 1 FROM public.snp_regles_fiscales r WHERE r.commentaire LIKE 'DEMO-20260826%'
);

-- ---------------------------------------------------------------------------
-- 2. Dossiers de conciliation, a trois etapes differentes du cycle
-- ---------------------------------------------------------------------------
-- Les references sont attribuees par le declencheur, comme pour un dossier reel.

INSERT INTO public.snp_conciliations (
  sale_id, customer_id, mining_company_id,
  prix_initial, devise_initiale, ca_initial,
  statut, observations, created_by, soumis_par
)
SELECT
  s.id, s.customer_id,
  (SELECT id FROM public.mining_companies WHERE upper(coalesce(code, '')) = 'SONASP' LIMIT 1),
  s.london_am_rate, coalesce(s.currency, 'USD'), s.gross_proceeds,
  'en_attente_analyse',
  'DEMO-20260826 : dossier de demonstration, en attente du resultat de l''acheteur.',
  (SELECT id FROM public.user_profiles WHERE role = 'owner' AND is_active LIMIT 1),
  (SELECT id FROM public.user_profiles WHERE role = 'owner' AND is_active LIMIT 1)
FROM public.sales s
WHERE s.sale_number IN ('SL-2026-012', 'SL-2026-011')
  AND NOT EXISTS (
    SELECT 1 FROM public.snp_conciliations c WHERE c.sale_id = s.id AND c.statut <> 'annulee'
  );

DO $$
DECLARE
  v_regles integer;
  v_dossiers integer;
BEGIN
  SELECT count(*) INTO v_regles
  FROM public.snp_regles_fiscales WHERE commentaire LIKE 'DEMO-20260826%';
  SELECT count(*) INTO v_dossiers
  FROM public.snp_conciliations WHERE observations LIKE 'DEMO-20260826%';

  RAISE NOTICE 'Demonstration : % regles fiscales, % dossiers.', v_regles, v_dossiers;

  IF v_regles = 0 THEN
    RAISE EXCEPTION 'Postflight : aucun bareme de demonstration cree.';
  END IF;
END;
$$;

-- RETRAIT DU JEU DE DEMONSTRATION
--   DELETE FROM public.snp_conciliations WHERE observations LIKE 'DEMO-20260826%';
--   DELETE FROM public.snp_regles_fiscales WHERE commentaire LIKE 'DEMO-20260826%';
-- Les ecritures de grand livre eventuellement produites par une validation ne
-- se suppriment pas : elles se contrepassent, conformement au principe de
-- journal immuable.
