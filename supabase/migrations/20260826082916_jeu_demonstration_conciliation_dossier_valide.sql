-- Complete le jeu de demonstration : un dossier parcouru jusqu'a la validation,
-- pour que les ecarts, les ajustements fiscaux et les grands livres aient
-- quelque chose a montrer. Le second dossier reste en attente d'analyse, afin
-- que la file de travail presente les deux etats.
--
-- Marque « DEMO-20260826 », comme le reste du jeu de demonstration.
--
-- POURQUOI CETTE MIGRATION EXISTE
-- La procedure de validation refuse qu'un acteur valide ce qu'il a prepare.
-- Les dossiers de demonstration etaient portes par le proprietaire, seul compte
-- habilite a valider aujourd'hui : le parcours ne pouvait donc pas aboutir. On
-- les rattache a un administrateur comme preparateur, ce qui rend la validation
-- par le proprietaire possible sans relacher la separation des taches.
--
-- CE QUE CELA REVELE, ET QUI RESTE A TRAITER
-- Aucun compte de role « management » n'existe en production. Hors
-- demonstration, tout dossier ouvert par le proprietaire sera donc impossible a
-- valider, faute d'un second acteur habilite. La creation de ce compte revient
-- au commanditaire.

-- ---------------------------------------------------------------------------
-- 1. Le preparateur devient un administrateur
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_admin uuid;
BEGIN
  SELECT id INTO v_admin
  FROM public.user_profiles WHERE role = 'admin' AND is_active ORDER BY created_at LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE NOTICE 'Aucun administrateur actif : le dossier reste en attente d''analyse.';
    RETURN;
  END IF;

  UPDATE public.snp_conciliations
  SET soumis_par = v_admin
  WHERE observations LIKE 'DEMO-20260826%';
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Parcours du premier dossier, par les procedures reelles
-- ---------------------------------------------------------------------------
-- On emprunte l'identite du proprietaire plutot que d'ecrire directement dans
-- les tables : les grands livres, les calculs fiscaux et les ecarts doivent
-- naitre de la procedure, sans quoi la demonstration montrerait un etat que le
-- moteur n'aurait pas produit.

DO $$
DECLARE
  v_owner uuid;
  v_certificat uuid;
  v_dossier uuid;
  v_resultat jsonb;
BEGIN
  SELECT id INTO v_owner FROM public.user_profiles WHERE role = 'owner' AND is_active LIMIT 1;
  SELECT id INTO v_certificat FROM public.assay_certificates ORDER BY created_at LIMIT 1;
  SELECT id INTO v_dossier
  FROM public.snp_conciliations
  WHERE observations LIKE 'DEMO-20260826%' AND statut = 'en_attente_analyse'
  ORDER BY reference LIMIT 1;

  IF v_owner IS NULL OR v_certificat IS NULL OR v_dossier IS NULL THEN
    RAISE NOTICE 'Elements insuffisants : parcours de demonstration non joue.';
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  -- Resultat de l'acheteur : poids et teneur legerement inferieurs au declare,
  -- prix de fixing legerement superieur. L'ecart qui en resulte est realiste.
  PERFORM public.snp_conciliation_enregistrer_analyse(
    v_dossier, 'certificat_acheteur', v_certificat,
    18950.000, 99.62, 4548.30, DATE '2026-08-20', gen_random_uuid()
  );

  v_resultat := public.snp_conciliation_valider(v_dossier, gen_random_uuid());

  RAISE NOTICE 'Dossier % valide : ecart % , taxes ajustees %.',
    v_resultat ->> 'reference',
    v_resultat ->> 'ecart_commercial',
    v_resultat ->> 'taxes_ajustees';

  IF jsonb_array_length(v_resultat -> 'taxes_sans_regle') > 0 THEN
    RAISE EXCEPTION
      'Postflight : des taxes n''ont trouve aucune regle applicable (%). Le referentiel fiscal est incomplet.',
      v_resultat ->> 'taxes_sans_regle';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Controle
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_valides integer;
  v_ecarts integer;
  v_commercial integer;
  v_fiscal integer;
BEGIN
  SELECT count(*) INTO v_valides
  FROM public.snp_conciliations WHERE observations LIKE 'DEMO-20260826%' AND statut = 'validee';

  SELECT count(*) INTO v_ecarts
  FROM public.snp_conciliations_ecarts e
  JOIN public.snp_conciliations c ON c.id = e.conciliation_id
  WHERE c.observations LIKE 'DEMO-20260826%';

  SELECT count(*) INTO v_commercial FROM public.snp_grand_livre_commercial
  WHERE conciliation_id IN (SELECT id FROM public.snp_conciliations WHERE observations LIKE 'DEMO-20260826%');

  SELECT count(*) INTO v_fiscal FROM public.snp_grand_livre_fiscal
  WHERE conciliation_id IN (SELECT id FROM public.snp_conciliations WHERE observations LIKE 'DEMO-20260826%');

  RAISE NOTICE 'Demonstration : % dossier(s) valide(s), % ecart(s), % ecriture(s) commerciale(s), % fiscale(s).',
    v_valides, v_ecarts, v_commercial, v_fiscal;

  IF v_valides = 0 THEN
    RAISE EXCEPTION 'Postflight : aucun dossier de demonstration n''a ete valide.';
  END IF;
  IF v_ecarts = 0 THEN
    RAISE EXCEPTION 'Postflight : la validation n''a produit aucun ecart.';
  END IF;
END;
$$;
