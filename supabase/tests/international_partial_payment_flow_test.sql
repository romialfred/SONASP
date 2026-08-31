-- Local schema mirror ONLY. Fixtures and assertions are rolled back together.
-- Storage metadata models the private gateway; this does not upload a real file.
BEGIN;
DO $$ BEGIN
  IF current_database() NOT IN ('sonasp_seed_validation_live_20260830','sonasp_release_20260830','sonasp_iam_audit_full_release_20260830') THEN
    RAISE EXCEPTION 'Run only in the isolated SONASP schema mirror.';
  END IF;
END $$;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
CREATE FUNCTION pg_temp.payment_claims(p_id uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub',p_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_id,'role','authenticated','aal','aal2','session_id','partial-test-'||p_id::text,'exp',extract(epoch FROM now()+interval '1 hour'))::text,true);
END $$;
CREATE FUNCTION pg_temp.try_payment(p_amount numeric,p_state text,p_version bigint,p_key uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
  RETURN public.snp_paiement_international_executer(
    '5a2e0000-0000-4000-8000-000000000301',p_state,p_version,p_amount,'USD',
    '5a2e0000-0000-4000-8000-000000000401','5a2e0000-0000-4000-8000-000000000402',
    current_date,'BANK-'||p_key::text,NULL,NULL,'Partial payment regression',p_key);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error',SQLSTATE,'message',SQLERRM); END $$;
CREATE FUNCTION pg_temp.try_decision(p_payment uuid,p_key uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE v_version bigint; BEGIN
  SELECT version INTO v_version FROM public.payments WHERE id=p_payment;
  RETURN public.snp_paiement_international_decider(p_payment,'processing',v_version,'approve','Rapprochement bancaire conforme',p_key);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error',SQLSTATE,'message',SQLERRM); END $$;
CREATE TEMP TABLE payment_results(name text PRIMARY KEY,payload jsonb);
GRANT ALL ON payment_results TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated;

INSERT INTO snp_capability_catalog(code,label,sensitive,domain,description) VALUES
 ('sonasp.finance.execute','Execute',true,'sales','Partial payment test'),
 ('sonasp.finance.reconcile','Reconcile',true,'sales','Partial payment test'),
 ('sonasp.workflow.read','Read',true,'sales','Partial payment test') ON CONFLICT(code) DO NOTHING;
INSERT INTO mining_companies(id,name,code,country,is_active) VALUES
 ('5a2e0000-0000-4000-8000-000000000101','SONASP payment test','SONASP','Burkina Faso',true);
INSERT INTO auth.users(id,email) VALUES
 ('5a2e0000-0000-4000-8000-000000000001','partial-executor@example.invalid'),
 ('5a2e0000-0000-4000-8000-000000000002','partial-reviewer@example.invalid');
INSERT INTO user_profiles(id,email,role,is_active,mfa_enrolled_at) VALUES
 ('5a2e0000-0000-4000-8000-000000000001','partial-executor@example.invalid','owner',true,now()),
 ('5a2e0000-0000-4000-8000-000000000002','partial-reviewer@example.invalid','owner',true,now());
INSERT INTO user_sessions(user_id,token_hash,expires_at)
SELECT id,extensions.digest('partial-test-'||id::text,'sha256'),now()+interval '1 hour' FROM user_profiles WHERE id::text LIKE '5a2e0000-%';
INSERT INTO customers(id,name,email,country) VALUES
 ('5a2e0000-0000-4000-8000-000000000201','Partial Buyer','partial-buyer@example.invalid','Suisse');
INSERT INTO customer_banks(id,customer_id,bank_name,country,city,currency,account_number,is_active) VALUES
 ('5a2e0000-0000-4000-8000-000000000401','5a2e0000-0000-4000-8000-000000000201','Buyer bank','Suisse','Genève','USD','TEST-BUYER',true);
INSERT INTO stakeholder_bank_accounts(id,stakeholder_type,stakeholder_id,account_name,bank_name,bank_country,account_number,account_currency,is_active,verification_status,valid_from) VALUES
 ('5a2e0000-0000-4000-8000-000000000402','mining_company','5a2e0000-0000-4000-8000-000000000101','SONASP','Receiver bank','Burkina Faso','TEST-RECEIVER','USD',true,'verifie',current_date-365);
INSERT INTO sales(id,sale_number,customer_id,seller_id,seller_type,status,quantity_oz,london_am_rate,gross_proceeds,net_proceeds,royalty_amount,final_proceeds,total_amount,currency) VALUES
 ('5a2e0000-0000-4000-8000-000000000301','TEST-PARTIAL-001','5a2e0000-0000-4000-8000-000000000201','5a2e0000-0000-4000-8000-000000000101','sonasp','waiting_for_payment',1,1000,1000,1000,0,1000,1000,'USD');
SELECT set_config('sonasp.payment_4h_rpc','1',true);
INSERT INTO payments(id,sale_id,customer_id,amount,currency,expected_date,status,is_virtual,payment_type,version) VALUES
 ('5a2e0000-0000-4000-8000-000000000501','5a2e0000-0000-4000-8000-000000000301','5a2e0000-0000-4000-8000-000000000201',1000,'USD',current_date,'pending',true,'virtual',0);
UPDATE sales SET status='waiting_for_payment' WHERE id='5a2e0000-0000-4000-8000-000000000301';
SELECT set_config('sonasp.payment_4h_rpc','0',true);

SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
INSERT INTO payment_results VALUES ('first',pg_temp.try_payment(400,'waiting_for_payment',0,'5a2e0000-0000-4000-8000-000000000601'));
SELECT diag(payload::text) FROM payment_results WHERE name='first' AND payload ? 'error';
SELECT is((SELECT payload->>'payment_status' FROM payment_results WHERE name='first'),'processing','first partial receipt is under review');
SELECT is((SELECT amount FROM payments WHERE id='5a2e0000-0000-4000-8000-000000000501'),600::numeric,'remaining commitment reduced to 600');
SELECT is((SELECT status::text FROM sales WHERE id='5a2e0000-0000-4000-8000-000000000301'),'virtual_payment','partial receipt keeps sale open');
SELECT is(pg_temp.try_payment(400,'waiting_for_payment',0,'5a2e0000-0000-4000-8000-000000000601')->>'replayed','true','replay does not duplicate receipt');
SELECT is((SELECT count(*) FROM payments WHERE sale_id='5a2e0000-0000-4000-8000-000000000301' AND NOT is_virtual),1::bigint,'exactly one actual receipt after replay');
SELECT is(pg_temp.try_payment(700,'virtual_payment',1,'5a2e0000-0000-4000-8000-000000000602')->>'error','23514','server rejects cumulative excess including processing funds');
SELECT is(pg_temp.try_payment(600,'virtual_payment',0,'5a2e0000-0000-4000-8000-000000000603')->>'error','40001','stale commitment version rejected');
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000002');
SELECT is(pg_temp.try_decision((SELECT (payload->>'payment_id')::uuid FROM payment_results WHERE name='first'),'5a2e0000-0000-4000-8000-000000000604')->>'error','23514','receipt cannot be approved without exact private proof');
RESET ROLE;

-- Trusted storage-service fixture; no public URL and one distinct proof per receipt.
INSERT INTO storage.buckets(id,name,public) VALUES('payment-proofs','payment-proofs',false) ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata)
SELECT 'payment-proofs',(payload->>'payment_id')||'/5a2e0000-0000-4000-8000-000000000701.pdf',
 '{"size":24,"mimetype":"application/pdf"}'::jsonb,
 jsonb_build_object('sha256',repeat('a',64),'safe_file_name','preuve.pdf','payment_id',payload->>'payment_id','idempotency_key','5a2e0000-0000-4000-8000-000000000701','uploaded_by','5a2e0000-0000-4000-8000-000000000001') FROM payment_results WHERE name='first';
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($q$SELECT public.snp_paiement_preuve_rattacher((payload->>'payment_id')::uuid,'payment-proofs/'||(payload->>'payment_id')||'/5a2e0000-0000-4000-8000-000000000701.pdf','preuve.pdf',24,'application/pdf',repeat('a',64),'5a2e0000-0000-4000-8000-000000000701') FROM payment_results WHERE name='first'$q$,'private proof attached to first receipt');
SELECT is(pg_temp.try_decision((SELECT (payload->>'payment_id')::uuid FROM payment_results WHERE name='first'),'5a2e0000-0000-4000-8000-000000000605')->>'error','42501','even Owner cannot approve own receipt');
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000002');
SELECT is(pg_temp.try_decision((SELECT (payload->>'payment_id')::uuid FROM payment_results WHERE name='first'),'5a2e0000-0000-4000-8000-000000000606')->>'payment_status','approved','independent reviewer confirms first partial receipt');
SELECT is((SELECT status::text FROM sales WHERE id='5a2e0000-0000-4000-8000-000000000301'),'virtual_payment','partial approval does not close the sale');
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000001');
INSERT INTO payment_results VALUES ('second',pg_temp.try_payment(600,'virtual_payment',1,'5a2e0000-0000-4000-8000-000000000607'));
SELECT diag(payload::text) FROM payment_results WHERE name='second' AND payload ? 'error';
SELECT is((SELECT payload->>'payment_status' FROM payment_results WHERE name='second'),'processing','second installment is accepted after the first');
SELECT is((SELECT sum(amount) FROM payments WHERE sale_id='5a2e0000-0000-4000-8000-000000000301' AND status IN ('processing','approved')),1000::numeric,'cumulative receipts equal sale total');
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000002');
SELECT is(pg_temp.try_decision((SELECT (payload->>'payment_id')::uuid FROM payment_results WHERE name='second'),'5a2e0000-0000-4000-8000-000000000608')->>'error','23514','first proof never substitutes for second receipt proof');
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata)
SELECT 'payment-proofs',(payload->>'payment_id')||'/5a2e0000-0000-4000-8000-000000000702.pdf',
 '{"size":24,"mimetype":"application/pdf"}'::jsonb,
 jsonb_build_object('sha256',repeat('b',64),'safe_file_name','preuve.pdf','payment_id',payload->>'payment_id','idempotency_key','5a2e0000-0000-4000-8000-000000000702','uploaded_by','5a2e0000-0000-4000-8000-000000000001') FROM payment_results WHERE name='second';
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT lives_ok($q$SELECT public.snp_paiement_preuve_rattacher((payload->>'payment_id')::uuid,'payment-proofs/'||(payload->>'payment_id')||'/5a2e0000-0000-4000-8000-000000000702.pdf','preuve.pdf',24,'application/pdf',repeat('b',64),'5a2e0000-0000-4000-8000-000000000702') FROM payment_results WHERE name='second'$q$,'second proof attached independently');
SELECT pg_temp.payment_claims('5a2e0000-0000-4000-8000-000000000002');
SELECT is(pg_temp.try_decision((SELECT (payload->>'payment_id')::uuid FROM payment_results WHERE name='second'),'5a2e0000-0000-4000-8000-000000000609')->>'payment_status','approved','independent reviewer confirms final installment');
SELECT is((SELECT sum(amount) FROM payments WHERE sale_id='5a2e0000-0000-4000-8000-000000000301' AND status='approved'),1000::numeric,'confirmed receipts cover exactly the sale');
SELECT is((SELECT status::text FROM sales WHERE id='5a2e0000-0000-4000-8000-000000000301'),'payment_received','only final approval marks sale paid');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
