BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;

SELECT plan(25);

SELECT has_table('public','snp_reserve_valuation_gaps',
  'historical valuation gaps are explicit');
SELECT has_table('public','snp_reserve_activation_requests',
  'activation idempotency has a durable ledger');
SELECT has_column('public','reserve_allocations','usd_xof_currency_pair',
  'the USD/XOF pair used by the snapshot is persisted');
SELECT has_column('public','reserve_allocations','eur_xof_currency_pair',
  'the EUR/XOF pair used by the snapshot is persisted');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.reserve_allocations'::regclass
    AND conname='reserve_allocations_usd_xof_pair_check'
), 'USD valuation rows cannot claim another currency pair');
SELECT ok(EXISTS(
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.reserve_allocations'::regclass
    AND conname='reserve_allocations_eur_xof_pair_check'
), 'EUR valuation rows cannot claim another currency pair');
SELECT has_function('public','snp_snapshot_reserve_valuation',ARRAY[]::text[],
  'the authoritative valuation snapshot trigger exists');
SELECT has_trigger('public','reserve_allocations','snp_reserve_valuation_snapshot_guard',
  'all reserve allocation writes cross the valuation guard');
SELECT has_function('public','snp_activate_reserve_allocation',ARRAY['uuid','uuid','text'],
  'the dedicated activation RPC exists');

SELECT ok(
  position('XAF' IN pg_get_functiondef(
    'public.snp_snapshot_reserve_valuation()'::regprocedure
  ))=0,
  'the snapshot never accepts XAF as an XOF fallback'
);
SELECT ok(
  position('=''USD/XOF''' IN pg_get_functiondef(
    'public.snp_snapshot_reserve_valuation()'::regprocedure
  ))>0
  AND position('=''EUR/XOF''' IN pg_get_functiondef(
    'public.snp_snapshot_reserve_valuation()'::regprocedure
  ))>0,
  'only the exact XOF currency pairs are selected'
);
SELECT ok(
  position('price.price_date<=v_reference_date' IN pg_get_functiondef(
    'public.snp_snapshot_reserve_valuation()'::regprocedure
  ))>0
  AND position('rate.rate_date<=v_reference_date' IN pg_get_functiondef(
    'public.snp_snapshot_reserve_valuation()'::regprocedure
  ))>0,
  'future market data cannot enter a historical valuation snapshot'
);
SELECT ok(
  position('valuation_frozen_at:=clock_timestamp()' IN pg_get_functiondef(
    'public.snp_snapshot_reserve_valuation()'::regprocedure
  ))>0,
  'submission freezes the valuation timestamp'
);
SELECT ok(
  position('NEW.indicative_value_fcfa IS DISTINCT FROM OLD.indicative_value_fcfa'
    IN pg_get_functiondef('public.snp_snapshot_reserve_valuation()'::regprocedure))>0
  AND position('NEW.usd_xof_currency_pair IS DISTINCT FROM OLD.usd_xof_currency_pair'
    IN pg_get_functiondef('public.snp_snapshot_reserve_valuation()'::regprocedure))>0,
  'submitted valuation amounts, sources and currency pairs are immutable'
);
SELECT ok(
  position('Utilisez l activation dediee' IN pg_get_functiondef(
    'public.snp_transition_reserve_allocation(uuid,text,text)'::regprocedure
  ))>0,
  'the generic transition RPC refuses ACTIVE'
);
SELECT ok(
  position('snp_sec_aal2' IN pg_get_functiondef(
    'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
  ))>0,
  'dedicated activation explicitly requires AAL2'
);
SELECT ok(
  position('reserve.allocations.activate' IN pg_get_functiondef(
    'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
  ))>0
  AND position('snp_actor_can_module_action(''national_reserve'',''approve'')'
    IN pg_get_functiondef(
      'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
    ))>0,
  'activation requires both the sensitive capability and module approval'
);
SELECT ok(
  position('FOR UPDATE' IN pg_get_functiondef(
    'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
  ))>0
  AND position('reserve-activation:' IN pg_get_functiondef(
    'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
  ))>0
  AND position('SONASP:exportable-stock' IN pg_get_functiondef(
    'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
  ))>0,
  'activation serializes idempotency, sale and reserve contenders'
);
SELECT ok(
  position('snp_transition_reserve_allocation_core' IN pg_get_functiondef(
    'public.snp_activate_reserve_allocation(uuid,uuid,text)'::regprocedure
  ))>0,
  'the dedicated RPC preserves the canonical transition side effects'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.snp_capability_catalog
    WHERE code='reserve.allocations.activate' AND sensitive
  ),
  'activation is registered as a sensitive capability'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.snp_role_capabilities
    WHERE role='management' AND capability_code='reserve.allocations.activate'
  ),
  'management receives the capability ceiling but still needs module approval'
);
SELECT ok(
  NOT has_function_privilege(
    'anon','public.snp_activate_reserve_allocation(uuid,uuid,text)','EXECUTE'
  )
  AND has_function_privilege(
    'authenticated','public.snp_activate_reserve_allocation(uuid,uuid,text)','EXECUTE'
  )
  AND NOT has_function_privilege(
    'service_role','public.snp_activate_reserve_allocation(uuid,uuid,text)','EXECUTE'
  ),
  'only authenticated browser sessions can invoke dedicated activation'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated','public.snp_transition_reserve_allocation_core(uuid,text,text)','EXECUTE'
  )
  AND NOT has_function_privilege(
    'service_role','public.snp_transition_reserve_allocation_core(uuid,text,text)','EXECUTE'
  ),
  'the canonical core remains private'
);
SELECT ok(
  NOT has_table_privilege(
    'authenticated','public.snp_reserve_activation_requests','INSERT'
  )
  AND NOT has_table_privilege(
    'authenticated','public.snp_reserve_activation_requests','UPDATE'
  )
  AND NOT has_table_privilege(
    'service_role','public.snp_reserve_activation_requests','INSERT'
  ),
  'browser sessions cannot forge idempotency results'
);
SELECT ok(
  EXISTS(
    SELECT 1 FROM public.snp_rpc_execution_allowlist
    WHERE function_signature='public.snp_activate_reserve_allocation(uuid,uuid,text)'
      AND grantee='authenticated'
      AND purpose='runtime-browser'
  ),
  'the exposed activation RPC is explicitly allowlisted'
);

SELECT * FROM finish();
ROLLBACK;
