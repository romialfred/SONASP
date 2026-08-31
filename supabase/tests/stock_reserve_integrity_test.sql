BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;

SELECT plan(17);

SELECT is(
  (SELECT count(*) FROM pg_trigger
   WHERE tgrelid='public.gold_inventory'::regclass
     AND NOT tgisinternal AND tgname IN(
       'trigger_create_inventory_transaction','trigger_log_inventory_transaction'
     )),
  1::bigint,
  'une seule fabrique de mouvements journalise une entrée de stock'
);
SELECT has_index('public','inventory_transactions','inventory_transactions_one_entry_uidx',
  'une entrée de grand livre est unique par inventaire');
SELECT ok(
  EXISTS(SELECT 1 FROM pg_constraint
    WHERE conrelid='public.gold_inventory'::regclass
      AND conname='gold_inventory_conservation_check' AND contype='c'),
  'la conservation locale inclut la réserve nationale'
);
SELECT has_function('public','snp_register_gold_inventory_entry',
  ARRAY['uuid','numeric','numeric','numeric','numeric','numeric','text','text','text'],
  'l’entrée de stock atomique existe');
SELECT ok(
  NOT has_table_privilege('authenticated','public.gold_inventory','INSERT')
  AND NOT has_table_privilege('authenticated','public.gold_inventory','UPDATE')
  AND NOT has_table_privilege('authenticated','public.gold_inventory','DELETE'),
  'le navigateur ne modifie pas directement le stock'
);
SELECT ok(
  NOT has_table_privilege('authenticated','public.inventory_transactions','INSERT')
  AND NOT has_table_privilege('authenticated','public.inventory_transactions','UPDATE')
  AND NOT has_table_privilege('authenticated','public.inventory_transactions','DELETE'),
  'le grand livre est append-only pour le navigateur'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM pg_constraint constraint_row
    JOIN unnest(constraint_row.conkey) WITH ORDINALITY key(attnum,position) ON true
    JOIN pg_attribute attribute ON attribute.attrelid=constraint_row.conrelid
      AND attribute.attnum=key.attnum
    WHERE constraint_row.conrelid='public.snp_ventes_lots'::regclass
      AND constraint_row.contype='f' AND attribute.attname='comptoir_cession_id'
  ),
  'une cession de comptoir est une source référentielle'
);
SELECT has_index('public','snp_ventes_lots','idx_snp_ventes_lots_active_cession',
  'les consommations actives d’une cession sont indexées');
SELECT ok(
  position('cession_comptoir' IN pg_get_functiondef(
    'public.snp_creer_vente_export(uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb)'::regprocedure
  ))>0,
  'la création export accepte la cession contrôlée'
);
SELECT ok(
  position('comptoir_organization_id IS NULL' IN pg_get_functiondef(
    'public.snp_creer_vente_export(uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb)'::regprocedure
  ))>0,
  'un achat artisanal de comptoir ne peut pas être exporté directement'
);
SELECT has_table('public','snp_export_sale_idempotency',
  'les reprises de création export sont mémorisées');
SELECT has_function('public','snp_creer_vente_export_idempotent',
  ARRAY['uuid','uuid','uuid','numeric','numeric','numeric','numeric','text','uuid','jsonb'],
  'le point d’entrée export idempotent existe');
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.snp_creer_vente_export(uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb)',
    'EXECUTE'
  ),
  'le noyau export non idempotent n’est pas exposé au navigateur'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.snp_creer_vente_export_idempotent(uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,uuid,jsonb)',
    'EXECUTE'
  ),
  'le point d’entrée idempotent est le seul exposé'
);
SELECT has_trigger('public','reserve_allocation_items','snp_reserve_allocation_item_guard',
  'chaque lingot réservé est verrouillé et photographié par SQL');
SELECT has_trigger('public','reserve_allocations','snp_reserve_depository_guard',
  'le dépositaire est vérifié par le serveur');
SELECT has_trigger('public','reserve_allocations','snp_reserve_stock_capacity_guard',
  'l’activation de la réserve partage la capacité du stock exportable');

SELECT * FROM finish();
ROLLBACK;
