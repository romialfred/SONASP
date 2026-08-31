BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(9);

SELECT is(
  (SELECT display_name FROM public.modules WHERE name = 'gold_inventory'),
  'Suivi des stocks',
  'le registre opérationnel conserve un module Stock explicite'
);

SELECT is(
  (SELECT display_name FROM public.modules WHERE name = 'national_reserve'),
  'Réserve nationale',
  'la Réserve nationale possède une habilitation canonique distincte'
);

SELECT is(
  (SELECT count(*) FROM public.snp_modules WHERE code IN ('gold_inventory', 'national_reserve') AND parent_id IS NULL),
  2::bigint,
  'Stock et Réserve sont deux racines de navigation'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.snp_modules child
    JOIN public.snp_modules parent ON parent.id = child.parent_id
    WHERE parent.code = 'national_reserve'
      AND child.code IN (
        'reserve-overview', 'inventory-allocations', 'inventory-physical',
        'inventory-controls', 'inventory-valuation', 'inventory-audit'
      )
  ),
  6::bigint,
  'les six écrans patrimoniaux dépendent de la Réserve nationale'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.snp_modules child
    JOIN public.snp_modules parent ON parent.id = child.parent_id
    WHERE parent.code = 'national_reserve'
      AND child.est_actif
      AND child.est_visible_menu
  ),
  6::bigint,
  'les six écrans de Réserve sont actifs et visibles'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.snp_modules child
    JOIN public.snp_modules parent ON parent.id = child.parent_id
    WHERE parent.code = 'gold_inventory'
      AND child.code IN ('inventory-overview', 'inventory-silver', 'inventory-new-entry')
      AND child.est_actif
      AND child.est_visible_menu
  ),
  3::bigint,
  'les trois fonctions du Stock opérationnel restent administrables'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.snp_modules child
    JOIN public.snp_modules parent ON parent.id = child.parent_id
    WHERE parent.code = 'gold_inventory'
      AND child.route LIKE '/national-reserve%'
  ),
  0::bigint,
  'aucune route Réserve ne demeure sous le module Stock'
);

SELECT is(
  (SELECT sort_order FROM public.modules WHERE name = 'international_markets'),
  27,
  'le rang du module suivant est décalé sans collision'
);

SELECT is(
  (SELECT count(*) FROM public.modules WHERE sort_order = 26 AND is_active),
  1::bigint,
  'la Réserve nationale est l’unique module actif au rang 26'
);

SELECT * FROM finish();
ROLLBACK;
