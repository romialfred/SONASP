-- L'avance partielle du jour de l'expedition devient possible.
--
-- LE WORKFLOW METIER (enonce du commanditaire)
-- « Le jour de l'expedition, la raffinerie ou le client final doit payer pour
-- cette vente ; le montant peut ne pas etre la totalite. » Or le flux 4H
-- exigeait le montant integral : un ecart superieur a 0,5 % etait refuse, et
-- un seul engagement actif etait tolere. L'avance etait donc impossible.
--
-- CE QUI CHANGE
-- 1. EXECUTION (snp_paiement_international_executer)
--    Le controle devient CUMULATIF : la somme des reglements en cours et
--    approuves, plus celui-ci, ne peut exceder le montant de la vente (a la
--    tolerance pres). En deca, le reglement est une AVANCE : une nouvelle
--    ligne de paiement est creee et l'engagement virtuel restant est reduit du
--    montant verse — il continue de porter le solde attendu. Lorsque le cumul
--    couvre la vente, le comportement historique s'applique : l'engagement est
--    converti et solde.
-- 2. RAPPROCHEMENT (snp_paiement_international_decider)
--    La vente ne passe a 'payment_received' que lorsque le cumul APPROUVE
--    couvre le montant ; une avance approuvee laisse la vente en
--    'virtual_payment'. Un rejet restitue le montant a l'engagement restant
--    quand il existe, et ne renvoie la vente a 'waiting_for_payment' que s'il
--    ne reste aucun reglement vivant.
-- 3. ANNULATION (snp_paiement_international_annuler)
--    Meme logique de restitution et de statut de vente.
--
-- CE QUI NE CHANGE PAS
-- Idempotence (reserve/complete, empreintes), double controle
-- executeur/rapprocheur, preuves privees obligatoires, verrous optimistes,
-- gardes de lignes, journal de workflow. Les appels existants au montant
-- integral se comportent exactement comme avant : le cumul part de zero et la
-- tolerance est identique.
--
-- NON TRAITE ICI, deliberement : l'ecriture des avances au grand livre
-- commercial. La contrainte de conversion du livre exige un taux vers le XOF
-- pour toute devise etrangere ; brancher les avances sans trancher ce modele
-- de devise produirait des ecritures fausses. Consigne au registre.

BEGIN;

CREATE OR REPLACE FUNCTION public.snp_paiement_international_executer(
  p_sale_id uuid,
  p_expected_sale_status text,
  p_expected_payment_version bigint,
  p_paid_amount numeric,
  p_payment_currency text,
  p_customer_bank_id uuid,
  p_seller_bank_id uuid,
  p_payment_date date,
  p_reference_number text,
  p_transaction_id text,
  p_proof_path text,
  p_notes text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_sale public.sales%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_reglement public.payments%ROWTYPE;
  v_customer_bank public.customer_banks%ROWTYPE;
  v_seller_bank public.stakeholder_bank_accounts%ROWTYPE;
  v_payment_currency text := upper(btrim(coalesce(p_payment_currency,'')));
  v_sale_currency text;
  v_fx_rate numeric;
  v_fx_date date;
  v_fx_source text;
  v_converted numeric;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
  v_pending_count integer;
  v_deja_regle numeric;
  v_tolerance numeric;
  v_solde_restant numeric;
  v_complet boolean;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE='42501';
  END IF;
  IF p_sale_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_sale_status NOT IN ('waiting_for_payment','virtual_payment')
     OR p_paid_amount IS NULL OR p_paid_amount<=0
     OR v_payment_currency !~ '^[A-Z]{3}$'
     OR p_customer_bank_id IS NULL OR p_seller_bank_id IS NULL
     OR p_payment_date IS NULL OR p_payment_date>current_date
     OR p_payment_date<current_date-30
     OR length(btrim(coalesce(p_reference_number,'')))<5 THEN
    RAISE EXCEPTION 'Parametres d''execution du paiement invalides.'
      USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(p_proof_path),'') IS NOT NULL THEN
    RAISE EXCEPTION
      'La preuve bancaire doit etre rattachee par un gateway prive verifie.'
      USING ERRCODE='42501';
  END IF;

  v_fingerprint:=md5(jsonb_build_object(
    'sale_id',p_sale_id,'expected_sale_status',p_expected_sale_status,
    'expected_payment_version',p_expected_payment_version,
    'paid_amount',p_paid_amount,'payment_currency',v_payment_currency,
    'customer_bank_id',p_customer_bank_id,'seller_bank_id',p_seller_bank_id,
    'payment_date',p_payment_date,'reference_number',btrim(p_reference_number),
    'transaction_id',nullif(btrim(p_transaction_id),''),
    'proof_path',nullif(btrim(p_proof_path),''),'notes',nullif(btrim(p_notes),'')
  )::text);
  v_replay:=public.snp_4h_payment_idempotency_reserve(
    p_idempotency_key,'execute',p_sale_id,v_fingerprint,v_actor,
    'sonasp.finance.execute'
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id=p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_sale.status::text<>p_expected_sale_status THEN
    RAISE EXCEPTION 'Conflit optimiste vente : attendu %, courant %.',
      p_expected_sale_status,v_sale.status::text USING ERRCODE='40001';
  END IF;
  IF v_sale.seller_type IS DISTINCT FROM 'sonasp'
     OR NOT EXISTS (
       SELECT 1 FROM public.mining_companies mc
       WHERE mc.id=v_sale.seller_id AND upper(coalesce(mc.code,''))='SONASP'
         AND mc.is_active
     ) THEN
    RAISE EXCEPTION 'Le paiement international doit concerner une vente SONASP active.'
      USING ERRCODE='42501';
  END IF;

  v_sale_currency:=upper(coalesce(v_sale.currency,'USD'));
  IF v_sale_currency !~ '^[A-Z]{3}$' OR v_sale.final_proceeds IS NULL
     OR v_sale.final_proceeds<=0 THEN
    RAISE EXCEPTION 'Montant/devise de vente incoherent.' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_customer_bank FROM public.customer_banks
  WHERE id=p_customer_bank_id FOR SHARE;
  IF NOT FOUND OR v_customer_bank.customer_id<>v_sale.customer_id
     OR v_customer_bank.is_active IS DISTINCT FROM true
     OR upper(v_customer_bank.currency)<>v_payment_currency THEN
    RAISE EXCEPTION 'Compte client inactif, hors client ou hors devise.'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_seller_bank FROM public.stakeholder_bank_accounts
  WHERE id=p_seller_bank_id FOR SHARE;
  IF NOT FOUND OR v_seller_bank.stakeholder_id<>v_sale.seller_id
     OR v_seller_bank.stakeholder_type<>v_sale.seller_type
     OR v_seller_bank.is_active IS DISTINCT FROM true
     OR lower(coalesce(v_seller_bank.verification_status,''))<>'verified'
     OR upper(v_seller_bank.account_currency)<>v_sale_currency
     OR (v_seller_bank.valid_from IS NOT NULL
         AND v_seller_bank.valid_from::date>p_payment_date)
     OR (v_seller_bank.valid_to IS NOT NULL
         AND v_seller_bank.valid_to::date<p_payment_date) THEN
    RAISE EXCEPTION 'Compte receveur SONASP non verifie, invalide ou hors devise.'
      USING ERRCODE='23514';
  END IF;

  IF v_payment_currency=v_sale_currency THEN
    v_fx_rate:=1; v_fx_date:=p_payment_date; v_fx_source:='parity';
  ELSE
    SELECT CASE WHEN f.currency_pair=v_payment_currency||'/'||v_sale_currency
                THEN f.rate ELSE 1/f.rate END,
           f.rate_date,coalesce(nullif(btrim(f.notes),''),'Referentiel SONASP')
    INTO v_fx_rate,v_fx_date,v_fx_source
    FROM public.fx_rates_daily f
    WHERE f.currency_pair IN (
      v_payment_currency||'/'||v_sale_currency,
      v_sale_currency||'/'||v_payment_currency
    ) AND f.rate>0 AND f.rate_date<=p_payment_date
      AND f.rate_date>=p_payment_date-5
    ORDER BY f.rate_date DESC,
      (f.currency_pair=v_payment_currency||'/'||v_sale_currency) DESC
    LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Taux FX autoritatif indisponible pour %/% a la date %.',
        v_payment_currency,v_sale_currency,p_payment_date USING ERRCODE='P0002';
    END IF;
  END IF;

  -- Controle CUMULATIF : le total regle (en cours + approuve) plus ce
  -- versement ne peut exceder la vente. En deca, c'est une avance.
  v_converted:=round(p_paid_amount*v_fx_rate,2);
  v_tolerance:=greatest(1::numeric,round(abs(v_sale.final_proceeds)*0.005,2));
  SELECT coalesce(sum(p.amount),0) INTO v_deja_regle FROM public.payments p
  WHERE p.sale_id=p_sale_id AND p.status IN ('processing','approved');

  IF v_converted+v_deja_regle>v_sale.final_proceeds+v_tolerance THEN
    RAISE EXCEPTION
      'Le versement % % excede le solde de la vente : deja regle % %, vente % %.',
      v_converted,v_sale_currency,v_deja_regle,v_sale_currency,
      v_sale.final_proceeds,v_sale_currency USING ERRCODE='23514';
  END IF;
  v_solde_restant:=round(v_sale.final_proceeds-v_deja_regle-v_converted,2);
  v_complet:=v_solde_restant<=v_tolerance;

  -- Un seul ENGAGEMENT en attente a la fois ; les reglements partiels en
  -- cours ou approuves peuvent en revanche coexister.
  SELECT count(*) INTO v_pending_count FROM public.payments p
  WHERE p.sale_id=p_sale_id AND p.status='pending';
  IF v_pending_count>1 THEN
    RAISE EXCEPTION 'Plusieurs engagements en attente existent pour cette vente.'
      USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_payment FROM public.payments p
  WHERE p.sale_id=p_sale_id AND p.status='pending'
  ORDER BY p.is_virtual DESC NULLS LAST,p.created_at DESC NULLS LAST,p.id
  LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    IF p_expected_payment_version IS NULL
       OR v_payment.version<>p_expected_payment_version THEN
      RAISE EXCEPTION 'Conflit optimiste paiement : attendu %, courant %.',
        p_expected_payment_version,v_payment.version USING ERRCODE='40001';
    END IF;
  ELSIF p_expected_payment_version IS NOT NULL THEN
    RAISE EXCEPTION 'Aucun engagement ne correspond a la version attendue.'
      USING ERRCODE='40001';
  END IF;

  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    IF v_complet AND v_payment.id IS NOT NULL THEN
      -- Le cumul couvre la vente : l'engagement est converti et solde,
      -- comme dans le flux historique.
      UPDATE public.payments SET
        amount=v_converted,currency=v_sale_currency,status='processing',
        is_virtual=false,payment_type='actual',customer_bank_id=p_customer_bank_id,
        seller_bank_id=p_seller_bank_id,payment_currency=v_payment_currency,
        receiving_currency=v_sale_currency,received_amount=p_paid_amount,
        actual_date=p_payment_date,bank_name=v_customer_bank.bank_name,
        account_number=v_customer_bank.account_number,
        reference_number=left(btrim(p_reference_number),255),
        transaction_id=left(nullif(btrim(p_transaction_id),''),255),
        fx_rate=v_fx_rate,proof_url=left(nullif(btrim(p_proof_path),''),2048),
        notes=concat_ws(E'\n',nullif(notes,''),left(nullif(btrim(p_notes),''),4000)),
        executed_by=v_actor,executed_at=clock_timestamp(),converted_by=v_actor,
        converted_to_actual_at=clock_timestamp(),fx_rate_date=v_fx_date,
        fx_rate_source=left(v_fx_source,255),
        execution_reference_key=p_seller_bank_id::text||':'||lower(btrim(p_reference_number)),
        approved_by=NULL,approved_at=NULL,rejected_by=NULL,rejected_at=NULL,
        rejection_reason=NULL,cancelled_by=NULL,cancelled_at=NULL,
        cancellation_reason=NULL,version=version+1
      WHERE id=v_payment.id RETURNING * INTO v_reglement;
    ELSE
      -- Avance partielle, ou aucun engagement : le versement est une nouvelle
      -- ligne, et l'engagement restant est reduit du montant verse.
      INSERT INTO public.payments(
        sale_id,customer_id,amount,currency,expected_date,status,is_virtual,
        payment_type,customer_bank_id,seller_bank_id,payment_currency,
        receiving_currency,received_amount,actual_date,bank_name,account_number,
        reference_number,transaction_id,fx_rate,proof_url,notes,created_by,
        executed_by,executed_at,converted_by,converted_to_actual_at,
        fx_rate_date,fx_rate_source,execution_reference_key,version
      ) VALUES (
        v_sale.id,v_sale.customer_id,v_converted,v_sale_currency,p_payment_date,
        'processing',false,'actual',p_customer_bank_id,p_seller_bank_id,
        v_payment_currency,v_sale_currency,p_paid_amount,p_payment_date,
        v_customer_bank.bank_name,v_customer_bank.account_number,
        left(btrim(p_reference_number),255),left(nullif(btrim(p_transaction_id),''),255),
        v_fx_rate,left(nullif(btrim(p_proof_path),''),2048),left(nullif(btrim(p_notes),''),4000),
        v_actor,v_actor,clock_timestamp(),v_actor,clock_timestamp(),
        v_fx_date,left(v_fx_source,255),
        p_seller_bank_id::text||':'||lower(btrim(p_reference_number)),1
      ) RETURNING * INTO v_reglement;

      IF v_payment.id IS NOT NULL THEN
        IF v_complet THEN
          -- Cumul couvert par une nouvelle ligne : l'engagement est solde.
          UPDATE public.payments SET status='cancelled',cancelled_by=v_actor,
            cancelled_at=clock_timestamp(),
            cancellation_reason='Engagement solde par le reglement cumulatif.',
            version=version+1
          WHERE id=v_payment.id;
        ELSE
          UPDATE public.payments SET amount=v_solde_restant,
            expected_date=greatest(coalesce(expected_date,p_payment_date),p_payment_date),
            version=version+1
          WHERE id=v_payment.id;
        END IF;
      END IF;
    END IF;

    UPDATE public.sales SET
      status='virtual_payment',payment_amount=round(v_deja_regle+v_converted,2),
      payment_date=p_payment_date,payment_method='bank_transfer',
      payment_proof_url=left(nullif(btrim(p_proof_path),''),2048),
      payment_received_at=NULL,updated_at=clock_timestamp()
    WHERE id=v_sale.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_reglement.id,'sale_id',v_sale.id,
    'payment_status','processing','sale_status','virtual_payment',
    'version',v_reglement.version,'idempotency_key',p_idempotency_key,
    'replayed',false,'paid_amount',p_paid_amount,
    'payment_currency',v_payment_currency,'settlement_amount',v_converted,
    'settlement_currency',v_sale_currency,'fx_rate',v_fx_rate,
    'fx_rate_date',v_fx_date,'fx_rate_source',v_fx_source,
    'paiement_partiel',NOT v_complet,
    'cumule_regle',round(v_deja_regle+v_converted,2),
    'solde_restant',greatest(v_solde_restant,0),
    'processed_at',v_reglement.executed_at
  );
  PERFORM public.snp_record_workflow_event(
    'international-payment',v_reglement.id,'executed','pending','processing',
    'sonasp.finance.execute',p_notes,
    jsonb_build_object('sale_id',v_sale.id,'idempotency_key',p_idempotency_key,
      'payment_currency',v_payment_currency,'settlement_currency',v_sale_currency,
      'fx_rate',v_fx_rate,'fx_rate_date',v_fx_date,
      'customer_bank_id',p_customer_bank_id,'seller_bank_id',p_seller_bank_id,
      'paiement_partiel',NOT v_complet,'solde_restant',greatest(v_solde_restant,0))
  );
  PERFORM public.snp_4h_complete_payment_operation(
    p_idempotency_key,v_reglement.id,v_sale.id,v_result
  );
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_paiement_international_decider(
  p_payment_id uuid,
  p_expected_status text,
  p_expected_version bigint,
  p_decision text,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_new_status text;
  v_sale_status text;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
  v_total_approuve numeric;
  v_reste_vivant integer;
  v_tolerance numeric;
  v_complet boolean;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.reconcile');
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE='42501'; END IF;
  IF p_payment_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_status<>'processing' OR p_expected_version IS NULL
     OR p_decision NOT IN ('approve','reject')
     OR (p_decision='reject' AND length(btrim(coalesce(p_reason,'')))<10) THEN
    RAISE EXCEPTION 'Parametres de decision invalides.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=md5(jsonb_build_object(
    'payment_id',p_payment_id,'expected_status',p_expected_status,
    'expected_version',p_expected_version,'decision',p_decision,
    'reason',nullif(btrim(p_reason),'')
  )::text);
  v_replay:=public.snp_4h_payment_idempotency_reserve(
    p_idempotency_key,'decide',p_payment_id,v_fingerprint,v_actor,
    'sonasp.finance.reconcile'
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_payment.status<>p_expected_status OR v_payment.version<>p_expected_version THEN
    RAISE EXCEPTION 'Conflit optimiste paiement : attendu %/%, courant %/%.',
      p_expected_status,p_expected_version,v_payment.status,v_payment.version
      USING ERRCODE='40001';
  END IF;
  IF v_payment.executed_by IS NULL OR v_payment.executed_by=v_actor THEN
    RAISE EXCEPTION 'Double controle requis : l''executeur ne rapproche pas son paiement.'
      USING ERRCODE='42501';
  END IF;
  IF p_decision='approve'
     AND length(btrim(coalesce(v_payment.proof_url,'')))<5 THEN
    RAISE EXCEPTION
      'Une preuve bancaire privee verifiee est requise avant rapprochement.'
      USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id=v_payment.sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_sale.status::text<>'virtual_payment' THEN
    RAISE EXCEPTION 'Conflit optimiste vente : statut courant %.',v_sale.status::text
      USING ERRCODE='40001';
  END IF;

  v_new_status:=CASE p_decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END;
  v_tolerance:=greatest(1::numeric,round(abs(coalesce(v_sale.final_proceeds,0))*0.005,2));

  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    UPDATE public.payments SET
      status=v_new_status,
      approved_by=CASE WHEN p_decision='approve' THEN v_actor ELSE NULL END,
      approved_at=CASE WHEN p_decision='approve' THEN clock_timestamp() ELSE NULL END,
      rejected_by=CASE WHEN p_decision='reject' THEN v_actor ELSE NULL END,
      rejected_at=CASE WHEN p_decision='reject' THEN clock_timestamp() ELSE NULL END,
      rejection_reason=CASE WHEN p_decision='reject' THEN left(btrim(p_reason),4000) ELSE NULL END,
      notes=CASE WHEN nullif(btrim(p_reason),'') IS NULL THEN notes
                 ELSE concat_ws(E'\n',nullif(notes,''),left(btrim(p_reason),4000)) END,
      version=version+1
    WHERE id=p_payment_id RETURNING * INTO v_payment;

    IF p_decision='approve' THEN
      -- La vente n'est payee que lorsque le cumul APPROUVE la couvre :
      -- une avance approuvee la laisse en attente du solde.
      SELECT coalesce(sum(p.amount),0) INTO v_total_approuve
      FROM public.payments p
      WHERE p.sale_id=v_sale.id AND p.status='approved';
      v_complet:=coalesce(v_sale.final_proceeds,0)-v_total_approuve<=v_tolerance;
      v_sale_status:=CASE WHEN v_complet THEN 'payment_received' ELSE 'virtual_payment' END;

      UPDATE public.sales SET
        status=v_sale_status::public.sale_status,
        payment_received_at=CASE WHEN v_complet THEN clock_timestamp() ELSE NULL END,
        updated_at=clock_timestamp()
      WHERE id=v_sale.id;
    ELSE
      -- Rejet : le montant retourne a l'engagement restant s'il existe ;
      -- la vente ne retombe a 'waiting_for_payment' que si plus rien ne vit.
      UPDATE public.payments SET amount=amount+v_payment.amount,version=version+1
      WHERE sale_id=v_sale.id AND status='pending' AND is_virtual;

      SELECT count(*) INTO v_reste_vivant FROM public.payments p
      WHERE p.sale_id=v_sale.id AND p.status IN ('pending','processing','approved');
      v_sale_status:=CASE WHEN v_reste_vivant>0 THEN 'virtual_payment' ELSE 'waiting_for_payment' END;

      UPDATE public.sales SET
        status=v_sale_status::public.sale_status,
        payment_received_at=NULL,updated_at=clock_timestamp()
      WHERE id=v_sale.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_payment.id,'sale_id',v_sale.id,
    'payment_status',v_new_status,'sale_status',v_sale_status,
    'version',v_payment.version,'decision',p_decision,
    'idempotency_key',p_idempotency_key,'replayed',false,
    'processed_at',coalesce(v_payment.approved_at,v_payment.rejected_at)
  );
  PERFORM public.snp_record_workflow_event(
    'international-payment',v_payment.id,'reconciled',p_expected_status,v_new_status,
    'sonasp.finance.reconcile',p_reason,
    jsonb_build_object('sale_id',v_sale.id,'idempotency_key',p_idempotency_key,
      'decision',p_decision,'executor_id',v_payment.executed_by,
      'sale_status',v_sale_status)
  );
  PERFORM public.snp_4h_complete_payment_operation(
    p_idempotency_key,v_payment.id,v_sale.id,v_result
  );
  RETURN v_result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_paiement_international_annuler(
  p_payment_id uuid,
  p_expected_status text,
  p_expected_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','pg_temp'
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_payment public.payments%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_fingerprint text;
  v_replay jsonb;
  v_result jsonb;
  v_reste_vivant integer;
  v_sale_status text;
BEGIN
  PERFORM public.snp_require_capability('sonasp.finance.execute');
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Acteur JWT authentifie requis.' USING ERRCODE='42501'; END IF;
  IF p_payment_id IS NULL OR p_idempotency_key IS NULL
     OR p_expected_status NOT IN ('pending','processing')
     OR p_expected_version IS NULL
     OR length(btrim(coalesce(p_reason,'')))<10 THEN
    RAISE EXCEPTION 'Parametres d''annulation invalides.' USING ERRCODE='22023';
  END IF;
  v_fingerprint:=md5(jsonb_build_object(
    'payment_id',p_payment_id,'expected_status',p_expected_status,
    'expected_version',p_expected_version,'reason',btrim(p_reason)
  )::text);
  v_replay:=public.snp_4h_payment_idempotency_reserve(
    p_idempotency_key,'cancel',p_payment_id,v_fingerprint,v_actor,
    'sonasp.finance.execute'
  );
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_payment.status<>p_expected_status OR v_payment.version<>p_expected_version THEN
    RAISE EXCEPTION 'Conflit optimiste paiement : attendu %/%, courant %/%.',
      p_expected_status,p_expected_version,v_payment.status,v_payment.version
      USING ERRCODE='40001';
  END IF;
  IF v_payment.executed_by IS NOT NULL AND v_payment.executed_by<>v_actor THEN
    RAISE EXCEPTION 'Seul l''executeur peut annuler avant rapprochement.'
      USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id=v_payment.sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente parente introuvable.' USING ERRCODE='P0002'; END IF;
  IF v_sale.status::text NOT IN ('waiting_for_payment','virtual_payment') THEN
    RAISE EXCEPTION 'Conflit optimiste vente : statut courant %.',v_sale.status::text
      USING ERRCODE='40001';
  END IF;

  PERFORM set_config('sonasp.payment_4h_rpc','1',true);
  BEGIN
    UPDATE public.payments SET
      status='cancelled',cancelled_by=v_actor,cancelled_at=clock_timestamp(),
      cancellation_reason=left(btrim(p_reason),4000),
      notes=concat_ws(E'\n',nullif(notes,''),left(btrim(p_reason),4000)),
      version=version+1
    WHERE id=p_payment_id RETURNING * INTO v_payment;

    -- Un reglement partiel annule restitue son montant a l'engagement restant.
    IF v_payment.status='cancelled' AND NOT coalesce(v_payment.is_virtual,false)
       AND p_expected_status='processing' THEN
      UPDATE public.payments SET amount=amount+v_payment.amount,version=version+1
      WHERE sale_id=v_sale.id AND status='pending' AND is_virtual;
    END IF;

    SELECT count(*) INTO v_reste_vivant FROM public.payments p
    WHERE p.sale_id=v_sale.id AND p.status IN ('pending','processing','approved');
    v_sale_status:=CASE WHEN v_reste_vivant>0 THEN 'virtual_payment' ELSE 'waiting_for_payment' END;

    UPDATE public.sales SET status=v_sale_status::public.sale_status,
      payment_received_at=NULL,updated_at=clock_timestamp()
    WHERE id=v_sale.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('sonasp.payment_4h_rpc','0',true);
    RAISE;
  END;
  PERFORM set_config('sonasp.payment_4h_rpc','0',true);

  v_result:=jsonb_build_object(
    'payment_id',v_payment.id,'sale_id',v_sale.id,
    'payment_status','cancelled','sale_status',v_sale_status,
    'version',v_payment.version,'idempotency_key',p_idempotency_key,
    'replayed',false,'processed_at',v_payment.cancelled_at
  );
  PERFORM public.snp_record_workflow_event(
    'international-payment',v_payment.id,'cancelled',p_expected_status,'cancelled',
    'sonasp.finance.execute',p_reason,
    jsonb_build_object('sale_id',v_sale.id,'idempotency_key',p_idempotency_key,
      'sale_status',v_sale_status)
  );
  PERFORM public.snp_4h_complete_payment_operation(
    p_idempotency_key,v_payment.id,v_sale.id,v_result
  );
  RETURN v_result;
END;
$fn$;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='snp_paiement_international_executer';
  IF v_def NOT LIKE '%paiement_partiel%' OR v_def NOT LIKE '%v_deja_regle%' THEN
    RAISE EXCEPTION 'Postflight : le controle cumulatif est absent de l''execution.';
  END IF;
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='snp_paiement_international_decider';
  IF v_def NOT LIKE '%v_total_approuve%' THEN
    RAISE EXCEPTION 'Postflight : le rapprochement ignore le cumul approuve.';
  END IF;
END;
$$;

COMMIT;
