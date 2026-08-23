-- ============================================================================
-- Décisions sensibles : approbations internes et réponse du client
--
-- Les anciens écrans orchestraient plusieurs UPDATE depuis le navigateur et
-- utilisaient un jeton Base64 non vérifié pour la réponse client. Cette
-- migration déplace les contrôles et toutes les écritures dans des transactions
-- PostgreSQL indivisibles. Aucun courriel ni rôle fourni par le client n'est
-- utilisé comme preuve d'identité : seul auth.uid(), le profil actif et aal2
-- font autorité.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_type text NOT NULL,
  approver_role text NOT NULL,
  assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'escalated'))
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
  ON public.approval_requests (status, requested_at)
  WHERE status IN ('pending', 'escalated');
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity
  ON public.approval_requests (entity_type, entity_id);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS snp_approbations_lecture_controlee ON public.approval_requests;
CREATE POLICY snp_approbations_lecture_controlee
  ON public.approval_requests
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.snp_mfa_satisfaite()
    AND (
      public.snp_est_agent_sonasp()
      OR requested_by = auth.uid()
      OR assigned_to = auth.uid()
    )
  );

-- Les décisions et créations passent exclusivement par des procédures métier.
DROP POLICY IF EXISTS snp_approbations_aucune_ecriture_directe ON public.approval_requests;
DROP POLICY IF EXISTS snp_approbations_aucune_insertion_directe ON public.approval_requests;
CREATE POLICY snp_approbations_aucune_insertion_directe
  ON public.approval_requests
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS snp_approbations_aucune_modification_directe ON public.approval_requests;
CREATE POLICY snp_approbations_aucune_modification_directe
  ON public.approval_requests
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS snp_approbations_aucune_suppression_directe ON public.approval_requests;
CREATE POLICY snp_approbations_aucune_suppression_directe
  ON public.approval_requests
  AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (false);

CREATE TABLE IF NOT EXISTS public.snp_decisions_approbation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'customer_approved', 'customer_rejected')),
  previous_status text NOT NULL,
  resulting_status text NOT NULL,
  reason text,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  actor_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snp_decisions_approbation_entity
  ON public.snp_decisions_approbation_audit (entity_type, entity_id, created_at DESC);

ALTER TABLE public.snp_decisions_approbation_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS snp_decisions_audit_lecture ON public.snp_decisions_approbation_audit;
CREATE POLICY snp_decisions_audit_lecture
  ON public.snp_decisions_approbation_audit
  FOR SELECT TO authenticated
  USING (public.snp_est_agent_sonasp());
REVOKE INSERT, UPDATE, DELETE ON public.snp_decisions_approbation_audit FROM anon, authenticated;


CREATE OR REPLACE FUNCTION public.snp_decider_approbation(
  p_demande_id uuid,
  p_decision text,
  p_motif text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_demande public.approval_requests%ROWTYPE;
  v_vente public.sales%ROWTYPE;
  v_paiement public.payments%ROWTYPE;
  v_reception public.receiving_records%ROWTYPE;
  v_raffinage public.refining_records%ROWTYPE;
  v_statut_initial text;
  v_statut_final text;
  v_destinataire_client uuid;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise pour décider.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor
  FROM public.user_profiles
  WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil actif introuvable.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_demande
  FROM public.approval_requests
  WHERE id = p_demande_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande d''approbation introuvable.'; END IF;
  IF v_demande.status NOT IN ('pending', 'escalated') THEN
    RAISE EXCEPTION 'Cette demande a déjà reçu une décision.';
  END IF;
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Décision invalide.';
  END IF;
  IF p_decision = 'reject' AND length(trim(COALESCE(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Le motif de rejet doit comporter au moins 5 caractères.';
  END IF;

  IF v_actor.role NOT IN ('owner', 'admin', 'management')
     AND v_actor.role IS DISTINCT FROM v_demande.approver_role THEN
    RAISE EXCEPTION 'Votre rôle ne permet pas de traiter cette demande.'
      USING ERRCODE = '42501';
  END IF;
  IF v_demande.assigned_to IS NOT NULL
     AND v_demande.assigned_to <> v_actor.id
     AND v_actor.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Cette demande est affectée à un autre approbateur.'
      USING ERRCODE = '42501';
  END IF;

  IF v_demande.request_type IN ('sale', 'sale_approval') THEN
    SELECT * INTO v_vente FROM public.sales
    WHERE id = v_demande.entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vente associée introuvable.'; END IF;
    IF v_vente.status <> 'pending_management_approval' THEN
      RAISE EXCEPTION 'La vente n''est plus en attente de validation de la direction.';
    END IF;
    v_statut_initial := v_vente.status::text;

    IF p_decision = 'approve' THEN
      v_statut_final := 'pending_for_customer_approval';
      UPDATE public.sales SET
        status = 'pending_for_customer_approval',
        management_approved_at = now(),
        management_approved_by = v_actor.id,
        management_approval_notes = NULLIF(trim(COALESCE(p_motif, '')), ''),
        management_rejected_at = NULL,
        management_rejected_by = NULL,
        management_rejection_notes = NULL,
        updated_at = now()
      WHERE id = v_vente.id;

      SELECT up.id INTO v_destinataire_client
      FROM public.customers c
      JOIN public.user_profiles up ON lower(up.email) = lower(c.email)
      WHERE c.id = v_vente.customer_id
        AND c.is_active IS DISTINCT FROM false
        AND up.is_active
        AND up.role = 'customer'
      LIMIT 1;

      IF v_destinataire_client IS NOT NULL THEN
        PERFORM public.snp_notifier(
          v_destinataire_client,
          'Vente à confirmer',
          'Une vente approuvée par la SONASP attend votre décision.',
          'validation_attendue', 'haute', 'vente', v_vente.id,
          '/sales/approve/' || v_vente.id::text,
          jsonb_build_object('sale_number', v_vente.sale_number),
          'vente-client-' || v_vente.id::text, true
        );
      END IF;
    ELSE
      v_statut_final := 'management_rejected';
      UPDATE public.sales SET
        status = 'management_rejected',
        management_rejected_at = now(),
        management_rejected_by = v_actor.id,
        management_rejection_notes = trim(p_motif),
        updated_at = now()
      WHERE id = v_vente.id;
    END IF;

  ELSIF v_demande.request_type IN ('payment', 'payment_approval') THEN
    SELECT * INTO v_paiement FROM public.payments
    WHERE id = v_demande.entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Paiement associé introuvable.'; END IF;
    v_statut_initial := COALESCE(v_paiement.status, 'pending');
    v_statut_final := CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END;

    UPDATE public.payments SET
      status = v_statut_final,
      approved_at = CASE WHEN p_decision = 'approve' THEN now() ELSE approved_at END,
      approved_by = CASE WHEN p_decision = 'approve' THEN v_actor.id ELSE approved_by END,
      notes = concat_ws(E'\n', NULLIF(notes, ''), NULLIF(trim(COALESCE(p_motif, '')), ''))
    WHERE id = v_paiement.id;
  ELSIF v_demande.request_type = 'batch_receipt' THEN
    SELECT * INTO v_reception FROM public.receiving_records
    WHERE id = v_demande.entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Réception associée introuvable.'; END IF;
    IF v_reception.reconciliation_approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cette réception a déjà été rapprochée.';
    END IF;
    v_statut_initial := 'pending';
    v_statut_final := CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END;
    IF p_decision = 'approve' THEN
      UPDATE public.receiving_records SET
        reconciliation_approved_at = now(),
        reconciliation_approved_by = v_actor.id,
        reconciliation_comments = NULLIF(trim(COALESCE(p_motif, '')), '')
      WHERE id = v_reception.id;
    END IF;
  ELSIF v_demande.request_type = 'refining_process' THEN
    SELECT * INTO v_raffinage FROM public.refining_records
    WHERE id = v_demande.entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Raffinage associé introuvable.'; END IF;
    IF v_raffinage.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Ce raffinage a déjà été approuvé.';
    END IF;
    v_statut_initial := 'pending';
    v_statut_final := CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END;
    IF p_decision = 'approve' THEN
      UPDATE public.refining_records SET
        approved_at = now(),
        approved_by = v_actor.id,
        processing_notes = concat_ws(
          E'\n', NULLIF(processing_notes, ''), NULLIF(trim(COALESCE(p_motif, '')), '')
        )
      WHERE id = v_raffinage.id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Ce type de demande utilise un autre circuit métier.';
  END IF;

  UPDATE public.approval_requests SET
    status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
    approved_at = CASE WHEN p_decision = 'approve' THEN now() ELSE NULL END,
    approved_by = v_actor.id,
    rejection_reason = CASE WHEN p_decision = 'reject' THEN trim(p_motif) ELSE NULL END,
    comments = CASE WHEN p_decision = 'approve' THEN NULLIF(trim(COALESCE(p_motif, '')), '') ELSE comments END,
    updated_at = now()
  WHERE id = v_demande.id;

  INSERT INTO public.snp_decisions_approbation_audit (
    approval_request_id, entity_type, entity_id, decision,
    previous_status, resulting_status, reason, actor_id, actor_role
  ) VALUES (
    v_demande.id, v_demande.entity_type, v_demande.entity_id,
    CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
    v_statut_initial, v_statut_final, NULLIF(trim(COALESCE(p_motif, '')), ''),
    v_actor.id, v_actor.role
  );

  IF v_demande.requested_by IS NOT NULL AND v_demande.requested_by <> v_actor.id THEN
    PERFORM public.snp_notifier(
      v_demande.requested_by,
      CASE WHEN p_decision = 'approve' THEN 'Demande approuvée' ELSE 'Demande rejetée' END,
      CASE WHEN p_decision = 'approve'
        THEN 'Votre demande a été approuvée.'
        ELSE 'Votre demande a été rejetée. Motif : ' || trim(p_motif) END,
      'decision', CASE WHEN p_decision = 'approve' THEN 'normale' ELSE 'haute' END,
      CASE WHEN v_demande.request_type LIKE 'sale%' THEN 'vente' ELSE 'reglement' END,
      v_demande.entity_id, NULL,
      jsonb_build_object('request_id', v_demande.id, 'decision', p_decision),
      'decision-' || v_demande.id::text, true
    );
  END IF;

  RETURN jsonb_build_object(
    'request_id', v_demande.id,
    'decision', p_decision,
    'entity_id', v_demande.entity_id,
    'status', v_statut_final
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_decider_approbation(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_decider_approbation(uuid, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.snp_vente_a_valider_client(p_vente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'sale_number', s.sale_number,
    'quantity_oz', s.quantity_oz,
    'london_am_rate', s.london_am_rate,
    'gross_proceeds', s.gross_proceeds,
    'freight_cost', COALESCE(s.freight_cost, 0),
    'other_costs', COALESCE(s.other_costs, 0),
    'net_proceeds', s.net_proceeds,
    'royalty_amount', s.royalty_amount,
    'final_proceeds', s.final_proceeds,
    'status', s.status,
    'mechanism_type', s.mechanism_type,
    'created_at', s.created_at,
    'customer', jsonb_build_object('name', c.name, 'email', c.email, 'country', c.country)
  ) INTO v_resultat
  FROM public.sales s
  JOIN public.customers c ON c.id = s.customer_id
  JOIN public.user_profiles up
    ON up.id = auth.uid()
   AND up.is_active
   AND up.role = 'customer'
   AND lower(up.email) = lower(c.email)
  WHERE s.id = p_vente_id
    AND s.status = 'pending_for_customer_approval';

  IF v_resultat IS NULL THEN
    RAISE EXCEPTION 'Cette vente n''est pas accessible ou n''attend plus votre décision.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_resultat;
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_vente_a_valider_client(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_vente_a_valider_client(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.snp_repondre_vente_client(
  p_vente_id uuid,
  p_decision text,
  p_motif text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor public.user_profiles%ROWTYPE;
  v_vente public.sales%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_paiement_id uuid;
  v_echeance date;
  v_jours integer;
BEGIN
  IF NOT public.snp_mfa_satisfaite() THEN
    RAISE EXCEPTION 'Une authentification forte est requise pour décider.'
      USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approve', 'reject') THEN RAISE EXCEPTION 'Décision invalide.'; END IF;
  IF p_decision = 'reject' AND length(trim(COALESCE(p_motif, ''))) < 5 THEN
    RAISE EXCEPTION 'Le motif de rejet doit comporter au moins 5 caractères.';
  END IF;

  SELECT * INTO v_actor FROM public.user_profiles
  WHERE id = auth.uid() AND is_active AND role = 'customer';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seul le compte client destinataire peut répondre.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_vente FROM public.sales
  WHERE id = p_vente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable.'; END IF;
  IF v_vente.status <> 'pending_for_customer_approval' THEN
    RAISE EXCEPTION 'Cette vente a déjà reçu une décision ou n''est pas encore disponible.';
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_vente.customer_id;
  IF NOT FOUND OR lower(v_customer.email) <> lower(v_actor.email) THEN
    RAISE EXCEPTION 'Cette vente n''appartient pas à votre compte client.' USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'approve' THEN
    v_jours := CASE
      WHEN lower(COALESCE(v_vente.mechanism_type, 'spot')) IN ('forward_14', 'forward_14_days') THEN 14
      WHEN lower(COALESCE(v_vente.mechanism_type, 'spot')) IN ('forward_7', 'forward_7_days') THEN 7
      ELSE 2
    END;
    v_echeance := current_date + v_jours;

    INSERT INTO public.payments (
      sale_id, customer_id, amount, currency, expected_date, due_date,
      is_virtual, mechanism_type, virtual_due_date, status, created_by, notes
    ) VALUES (
      v_vente.id, v_vente.customer_id, v_vente.final_proceeds,
      COALESCE(v_vente.currency, 'USD'), v_echeance, v_echeance,
      true, COALESCE(v_vente.mechanism_type, 'spot'), v_echeance,
      'pending', v_actor.id, 'Engagement de paiement créé à la confirmation du client.'
    ) RETURNING id INTO v_paiement_id;

    UPDATE public.sales SET
      status = 'waiting_for_payment',
      customer_approved_at = now(),
      customer_approved_by = v_actor.id,
      customer_approval_notes = NULLIF(trim(COALESCE(p_motif, '')), ''),
      updated_at = now()
    WHERE id = v_vente.id;
  ELSE
    UPDATE public.sales SET
      status = 'customer_rejected',
      customer_rejected_at = now(),
      customer_rejected_by = v_actor.id,
      customer_rejection_notes = trim(p_motif),
      updated_at = now()
    WHERE id = v_vente.id;
  END IF;

  INSERT INTO public.snp_decisions_approbation_audit (
    entity_type, entity_id, decision, previous_status, resulting_status,
    reason, actor_id, actor_role
  ) VALUES (
    'sales', v_vente.id,
    CASE WHEN p_decision = 'approve' THEN 'customer_approved' ELSE 'customer_rejected' END,
    v_vente.status::text,
    CASE WHEN p_decision = 'approve' THEN 'waiting_for_payment' ELSE 'customer_rejected' END,
    NULLIF(trim(COALESCE(p_motif, '')), ''), v_actor.id, v_actor.role
  );

  PERFORM public.snp_notifier_roles(
    ARRAY['owner', 'admin', 'management'],
    CASE WHEN p_decision = 'approve' THEN 'Vente confirmée par le client' ELSE 'Vente refusée par le client' END,
    CASE WHEN p_decision = 'approve'
      THEN 'Le client a confirmé la vente ' || v_vente.sale_number || '.'
      ELSE 'Le client a refusé la vente ' || v_vente.sale_number || '. Motif : ' || trim(p_motif) END,
    'decision', CASE WHEN p_decision = 'approve' THEN 'normale' ELSE 'haute' END,
    'vente', v_vente.id, '/sales/' || v_vente.id::text,
    jsonb_build_object('sale_number', v_vente.sale_number, 'decision', p_decision),
    'decision-client-' || v_vente.id::text, true
  );

  RETURN jsonb_build_object(
    'sale_id', v_vente.id,
    'decision', p_decision,
    'status', CASE WHEN p_decision = 'approve' THEN 'waiting_for_payment' ELSE 'customer_rejected' END,
    'payment_id', v_paiement_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.snp_repondre_vente_client(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.snp_repondre_vente_client(uuid, text, text) TO authenticated;
