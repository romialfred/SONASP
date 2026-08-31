-- Disposable local database only. No helper override, no disabled RLS, rollback.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT IN ('sonasp_seed_validation_live_20260830','sonasp_iam_audit_20260830','sonasp_release_20260830','sonasp_iam_audit_full_release_20260830') THEN
    RAISE EXCEPTION 'Run only in an isolated SONASP test database.';
  END IF;
END $$;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
CREATE FUNCTION pg_temp.sales_test_claims(p_id uuid,p_aal text DEFAULT 'aal2') RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_id,'role','authenticated','aal',p_aal,'session_id','sales-test-'||p_id::text,'exp',extract(epoch from now()+interval '1 hour'))::text,true);
END $$;

-- Minimal declarative catalog fixture (schema mirrors do not copy reference data).
INSERT INTO public.snp_capability_catalog(code,label,sensitive,domain,description)
SELECT code,label,sensitive,'sales','International sales scope regression fixture' FROM (VALUES
 ('sonasp.prepare','Prepare',true),('sonasp.approve','Approve',true),
 ('sonasp.finance.execute','Execute',true),('sonasp.finance.reconcile','Reconcile',true),
 ('sonasp.workflow.read','Read',true),('reports.read','Reports',true)) AS fixture(code,label,sensitive)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.mining_companies(id,name,code,country,is_active) VALUES
 ('5a1e0000-0000-4000-8000-000000000101','Scope Mine A','TEST-SALES-A','Burkina Faso',true),
 ('5a1e0000-0000-4000-8000-000000000102','Scope Mine B','TEST-SALES-B','Burkina Faso',true);
INSERT INTO auth.users(id,email) VALUES
 ('5a1e0000-0000-4000-8000-000000000001','sales-mine-a@example.invalid'),
 ('5a1e0000-0000-4000-8000-000000000002','sales-mine-b@example.invalid'),
 ('5a1e0000-0000-4000-8000-000000000003','sales-owner@example.invalid'),
 ('5a1e0000-0000-4000-8000-000000000004','sales-buyer@example.invalid');
INSERT INTO public.user_profiles(id,email,role,mining_company_id,is_active,mfa_enrolled_at) VALUES
 ('5a1e0000-0000-4000-8000-000000000001','sales-mine-a@example.invalid','mine','5a1e0000-0000-4000-8000-000000000101',true,now()),
 ('5a1e0000-0000-4000-8000-000000000002','sales-mine-b@example.invalid','mine','5a1e0000-0000-4000-8000-000000000102',true,now()),
 ('5a1e0000-0000-4000-8000-000000000003','sales-owner@example.invalid','owner',NULL,true,now()),
 ('5a1e0000-0000-4000-8000-000000000004','sales-buyer@example.invalid','customer',NULL,true,now());
INSERT INTO public.user_sessions(user_id,token_hash,expires_at)
SELECT id,extensions.digest('sales-test-'||id::text,'sha256'),now()+interval '1 hour'
FROM public.user_profiles WHERE id::text LIKE '5a1e0000-%';
INSERT INTO public.customers(id,name,email,country) VALUES
 ('5a1e0000-0000-4000-8000-000000000201','Buyer A','sales-buyer@example.invalid','Suisse'),
 ('5a1e0000-0000-4000-8000-000000000202','Buyer B','other-buyer@example.invalid','Suisse');
INSERT INTO public.sales(id,sale_number,customer_id,seller_id,seller_type,status,quantity_oz,london_am_rate,gross_proceeds,net_proceeds,royalty_amount,final_proceeds,total_amount,currency) VALUES
 ('5a1e0000-0000-4000-8000-000000000301','TEST-SALES-A','5a1e0000-0000-4000-8000-000000000201','5a1e0000-0000-4000-8000-000000000101','mining_company','create_sales',10,2500,25000,25000,0,25000,25000,'USD'),
 ('5a1e0000-0000-4000-8000-000000000302','TEST-SALES-B','5a1e0000-0000-4000-8000-000000000202','5a1e0000-0000-4000-8000-000000000102','mining_company','create_sales',10,2500,25000,25000,0,25000,25000,'USD'),
 ('5a1e0000-0000-4000-8000-000000000303','TEST-SALES-SONASP','5a1e0000-0000-4000-8000-000000000202',NULL,'sonasp','create_sales',10,2500,25000,25000,0,25000,25000,'USD');
-- Seed guarded payment rows; restore the guard before ALL assertions.
SELECT set_config('sonasp.payment_4h_rpc','1',true);
INSERT INTO public.payments(id,sale_id,amount,currency,expected_date,status,is_virtual) VALUES
 ('5a1e0000-0000-4000-8000-000000000401','5a1e0000-0000-4000-8000-000000000301',12500,'USD',current_date,'pending',false),
 ('5a1e0000-0000-4000-8000-000000000402','5a1e0000-0000-4000-8000-000000000302',25000,'USD',current_date,'pending',false);
SELECT set_config('sonasp.payment_4h_rpc','0',true);
INSERT INTO public.sales_documents(id,sale_id,document_name,document_type,file_url) VALUES
 ('5a1e0000-0000-4000-8000-000000000501','5a1e0000-0000-4000-8000-000000000301','Invoice A','invoice','test-only/invoice-a'),
 ('5a1e0000-0000-4000-8000-000000000502','5a1e0000-0000-4000-8000-000000000302','Invoice B','invoice','test-only/invoice-b');

SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),1::bigint,'Mine A: only its own sale');
SELECT is((SELECT count(*) FROM sales WHERE seller_id='5a1e0000-0000-4000-8000-000000000102'),0::bigint,'forged Mine B filter cannot widen RLS');
SELECT is((SELECT count(*) FROM sales WHERE id='5a1e0000-0000-4000-8000-000000000302'),0::bigint,'direct foreign sale ID is invisible');
SELECT is((SELECT count(*) FROM payments WHERE id::text LIKE '5a1e0000-%'),1::bigint,'payments inherit parent scope');
SELECT is((SELECT count(*) FROM sales_documents WHERE id::text LIKE '5a1e0000-%'),1::bigint,'invoices inherit parent scope');
SELECT ok(NOT public.snp_peut_consulter_vente('5a1e0000-0000-4000-8000-000000000302'),'direct helper refuses foreign sale');
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000002');
SELECT is((SELECT count(*) FROM sales WHERE id='5a1e0000-0000-4000-8000-000000000301'),0::bigint,'Mine B cannot read Mine A');
SELECT is((SELECT count(*) FROM sales WHERE id='5a1e0000-0000-4000-8000-000000000302'),1::bigint,'Mine B can read its sale');
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000003');
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),3::bigint,'active Owner keeps consolidated access');
SELECT is((SELECT count(*) FROM payments WHERE id::text LIKE '5a1e0000-%'),2::bigint,'Owner reads all related payments');
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000004');
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),1::bigint,'buyer reads only sales addressed to it');
SELECT is((SELECT count(*) FROM payments WHERE id='5a1e0000-0000-4000-8000-000000000402'),0::bigint,'buyer cannot read another buyer payment');
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000001','aal1');
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),0::bigint,'enrolled Mine requires AAL2');
RESET ROLE;
UPDATE public.user_sessions SET is_active=false WHERE user_id='5a1e0000-0000-4000-8000-000000000001';
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),0::bigint,'revoked Mine session cannot read sales');
SELECT is((SELECT count(*) FROM payments WHERE id::text LIKE '5a1e0000-%'),0::bigint,'revoked Mine session cannot read payments');
RESET ROLE;
UPDATE public.user_sessions SET is_active=false WHERE user_id='5a1e0000-0000-4000-8000-000000000004';
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000004');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),0::bigint,'revoked buyer session cannot read sales');
SELECT is((SELECT count(*) FROM sales_documents WHERE id::text LIKE '5a1e0000-%'),0::bigint,'revoked buyer session cannot read invoices');
RESET ROLE;
-- Trusted fixture update, never used during access assertions.
SELECT set_config('snp.account_status_rpc','on',true);
UPDATE public.user_profiles SET is_active=false WHERE id='5a1e0000-0000-4000-8000-000000000002';
SELECT set_config('snp.account_status_rpc','off',true);
SELECT pg_temp.sales_test_claims('5a1e0000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM sales WHERE id::text LIKE '5a1e0000-%'),0::bigint,'inactive Mine is denied');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.snp_peut_consulter_vente(uuid)','EXECUTE'),'anonymous cannot call the sales scope helper');
SELECT * FROM finish();
ROLLBACK;
