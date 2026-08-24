BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(13);

SELECT has_table(
  'public', 'snp_comptoir_ventes_sonasp',
  'les cessions nationales disposent de leur registre'
);
SELECT has_column(
  'public', 'snp_artisan_ventes_or', 'acheteur_comptoir_organization_id',
  'un achat artisanal identifie explicitement son comptoir acheteur'
);
SELECT has_check(
  'public', 'snp_artisan_ventes_or', 'snp_artisan_purchase_buyer_scope_check',
  'achat national et achat de comptoir ne peuvent pas mélanger leurs acheteurs'
);
SELECT has_column(
  'public', 'snp_comptoir_ventes_sonasp', 'sonasp_organization_id',
  'la destination SONASP est structurelle et non saisie librement'
);
SELECT has_function(
  'public', 'snp_submit_comptoir_sale_to_sonasp', ARRAY['numeric', 'numeric', 'text'],
  'la soumission passe par une RPC contrôlée'
);
SELECT has_function(
  'public', 'snp_transition_comptoir_sale_to_sonasp', ARRAY['uuid', 'text', 'text'],
  'la décision SONASP passe par une RPC contrôlée'
);
SELECT has_trigger(
  'public', 'snp_comptoir_ventes_sonasp', 'snp_comptoir_sale_guard',
  'les écritures directes du registre sont bloquées'
);
SELECT has_trigger(
  'public', 'snp_artisan_paiements', 'snp_a_require_dgi_before_payment',
  'la certification DGI précède la création du paiement'
);
SELECT has_trigger(
  'public', 'snp_artisan_paiements', 'snp_finalize_comptoir_purchase',
  'la clôture du paiement alimente stock et taxes'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.snp_comptoir_ventes_sonasp'::regclass),
  'RLS est activée sur les cessions'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.snp_comptoir_ventes_sonasp', 'SELECT'),
  'le portail peut lire les lignes autorisées par RLS'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.snp_comptoir_ventes_sonasp', 'INSERT'),
  'le navigateur ne peut pas insérer directement une cession'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'snp_comptoir_ventes_sonasp'
      AND column_name IN ('customer_id', 'international_buyer_id', 'destination_country')
  ),
  'aucune destination tierce ou internationale ne fait partie du contrat de données'
);

SELECT * FROM finish();
ROLLBACK;
