-- Contrat des grands livres commercial et fiscal.
--
-- Ce que ce test garantit : un solde se reconstruit toujours depuis les
-- ecritures, une ecriture validee ne se modifie ni ne se supprime, une erreur se
-- corrige par contrepassation motivee, et une operation en devise etrangere
-- conserve la trace de sa conversion.
--
-- Ces invariants etaient jusqu'ici eprouves par script jetable sur le miroir.
-- Les inscrire ici les rend rejouables et opposables.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures, annulees par le ROLLBACK final
-- ---------------------------------------------------------------------------

INSERT INTO public.mining_companies (id, name, code, country)
VALUES ('a0000000-0000-4000-8000-000000000001', 'Mine de contrat', 'TESTGL', 'Burkina Faso')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, name, email, country)
VALUES ('c0000000-0000-4000-8000-000000000001', 'Client de contrat', 'client.contrat@test.invalid', 'Suisse')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. Structure
-- ---------------------------------------------------------------------------

SELECT has_table('public', 'snp_grand_livre_commercial', 'le grand livre commercial existe');
SELECT has_table('public', 'snp_grand_livre_fiscal', 'le grand livre fiscal existe');
SELECT has_function(
  'public', 'snp_solde_commercial', ARRAY['text', 'uuid'],
  'le solde commercial se reconstruit par fonction'
);
SELECT has_function(
  'public', 'snp_solde_fiscal', ARRAY['uuid', 'text'],
  'le solde fiscal se reconstruit par fonction'
);

-- ---------------------------------------------------------------------------
-- 2. Le solde est la somme signee des ecritures
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_grand_livre_commercial (
  contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
  type_mouvement, source_type, source_id, idempotency_key
) VALUES (
  'customer', 'c0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001', 'credit', 1000000,
  'facture_provisoire', 'sale', gen_random_uuid(), 'test-gl-facture'
);

SELECT is(
  public.snp_solde_commercial('customer', 'c0000000-0000-4000-8000-000000000001'),
  1000000::numeric,
  'une facture porte le solde a son montant'
);

INSERT INTO public.snp_grand_livre_commercial (
  contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
  type_mouvement, source_type, source_id, idempotency_key
) VALUES (
  'customer', 'c0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001', 'debit', 900000,
  'paiement', 'payment', gen_random_uuid(), 'test-gl-paiement'
);

SELECT is(
  public.snp_solde_commercial('customer', 'c0000000-0000-4000-8000-000000000001'),
  100000::numeric,
  'un paiement partiel laisse la creance ouverte'
);

-- ---------------------------------------------------------------------------
-- 3. Idempotence
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.snp_grand_livre_commercial (
      contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
      type_mouvement, source_type, source_id, idempotency_key
    ) VALUES (
      'customer', 'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000001', 'debit', 900000,
      'paiement', 'payment', gen_random_uuid(), 'test-gl-paiement'
    )$$,
  '23505',
  NULL,
  'une cle d''idempotence rejouee ne cree pas de doublon'
);

-- ---------------------------------------------------------------------------
-- 4. Immuabilite
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$UPDATE public.snp_grand_livre_commercial
      SET montant = 1 WHERE idempotency_key = 'test-gl-facture'$$,
  '42501',
  NULL,
  'une ecriture ne se modifie pas'
);

SELECT throws_ok(
  $$DELETE FROM public.snp_grand_livre_commercial
     WHERE idempotency_key = 'test-gl-facture'$$,
  '42501',
  NULL,
  'une ecriture ne se supprime pas'
);

-- ---------------------------------------------------------------------------
-- 5. Contrepassation
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.snp_grand_livre_commercial (
      contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
      type_mouvement, source_type, source_id, idempotency_key, reverses_entry_id
    )
    SELECT 'customer', 'c0000000-0000-4000-8000-000000000001',
           'a0000000-0000-4000-8000-000000000001', 'debit', 1000000,
           'contrepassation', 'sale', gen_random_uuid(), 'test-gl-rev-sans-motif', id
      FROM public.snp_grand_livre_commercial
     WHERE idempotency_key = 'test-gl-facture'$$,
  '23514',
  NULL,
  'une contrepassation sans motif est refusee'
);

INSERT INTO public.snp_grand_livre_commercial (
  contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
  type_mouvement, source_type, source_id, idempotency_key, reverses_entry_id, motif
)
SELECT 'customer', 'c0000000-0000-4000-8000-000000000001',
       'a0000000-0000-4000-8000-000000000001', 'debit', 1000000,
       'contrepassation', 'sale', gen_random_uuid(), 'test-gl-rev', id,
       'Facture emise par erreur'
  FROM public.snp_grand_livre_commercial
 WHERE idempotency_key = 'test-gl-facture';

SELECT is(
  public.snp_solde_commercial('customer', 'c0000000-0000-4000-8000-000000000001'),
  -900000::numeric,
  'la contrepassation annule la facture sans effacer sa trace'
);

SELECT is(
  (SELECT count(*)::integer FROM public.snp_grand_livre_commercial
    WHERE idempotency_key IN ('test-gl-facture', 'test-gl-rev')),
  2,
  'l''ecriture fautive et sa contrepassation coexistent'
);

SELECT throws_ok(
  $$INSERT INTO public.snp_grand_livre_commercial (
      contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
      type_mouvement, source_type, source_id, idempotency_key, reverses_entry_id, motif
    )
    SELECT 'customer', 'c0000000-0000-4000-8000-000000000001',
           'a0000000-0000-4000-8000-000000000001', 'debit', 1000000,
           'contrepassation', 'sale', gen_random_uuid(), 'test-gl-rev-double', id,
           'Seconde contrepassation'
      FROM public.snp_grand_livre_commercial
     WHERE idempotency_key = 'test-gl-facture'$$,
  '23505',
  NULL,
  'une ecriture ne se contrepasse qu''une fois'
);

-- ---------------------------------------------------------------------------
-- 6. Devises
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$INSERT INTO public.snp_grand_livre_commercial (
      contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
      devise, type_mouvement, source_type, source_id, idempotency_key
    ) VALUES (
      'customer', 'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000001', 'credit', 5000,
      'USD', 'paiement', 'payment', gen_random_uuid(), 'test-gl-usd-nu'
    )$$,
  '23514',
  NULL,
  'une devise etrangere sans taux ni horodatage est refusee'
);

INSERT INTO public.snp_grand_livre_commercial (
  contrepartie_type, contrepartie_id, mining_company_id, sens, montant,
  devise, montant_xof, taux_change, source_taux, taux_horodate,
  type_mouvement, source_type, source_id, idempotency_key
) VALUES (
  'customer', 'c0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001', 'credit', 5000,
  'USD', 3000000, 600, 'BCEAO', now(),
  'paiement', 'payment', gen_random_uuid(), 'test-gl-usd'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.snp_grand_livre_commercial
     WHERE idempotency_key = 'test-gl-usd' AND taux_change IS NOT NULL
  ),
  'une devise etrangere accompagnee de sa conversion est acceptee'
);

-- ---------------------------------------------------------------------------
-- 7. Grand livre fiscal
-- ---------------------------------------------------------------------------

INSERT INTO public.snp_grand_livre_fiscal (
  mining_company_id, code_taxe, sens, montant, type_mouvement, idempotency_key
) VALUES (
  'a0000000-0000-4000-8000-000000000001', 'royalties', 'debit', 55000000,
  'taxe_provisoire', 'test-glf-provisoire'
);

INSERT INTO public.snp_grand_livre_fiscal (
  mining_company_id, code_taxe, sens, montant, type_mouvement,
  statut_credit, idempotency_key
) VALUES (
  'a0000000-0000-4000-8000-000000000001', 'royalties', 'credit', 5000000,
  'ajustement_conciliation', 'constate', 'test-glf-ajustement'
);

SELECT is(
  public.snp_solde_fiscal('a0000000-0000-4000-8000-000000000001', 'royalties'),
  -50000000::numeric,
  'le solde fiscal reflete la taxe definitive apres ajustement'
);

SELECT is(
  (SELECT statut_credit FROM public.snp_grand_livre_fiscal
    WHERE idempotency_key = 'test-glf-ajustement'),
  'constate',
  'un trop-verse est constate et non repute compensable'
);

SELECT throws_ok(
  $$UPDATE public.snp_grand_livre_fiscal
      SET statut_credit = 'approuve' WHERE idempotency_key = 'test-glf-ajustement'$$,
  '42501',
  NULL,
  'un credit fiscal ne change pas de statut par modification directe'
);

SELECT * FROM finish();

ROLLBACK;
