-- Cohérence du catalogue et protection propriétaire des brouillons de réserve.
BEGIN;

UPDATE public.snp_modules
SET est_actif = false, est_visible_menu = false, updated_at = now()
WHERE code IN ('inventory-physical', 'inventory-controls', 'inventory-valuation', 'inventory-audit');

CREATE OR REPLACE FUNCTION public.snp_reserve_draft_owned_or_owner(p_allocation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
  SELECT coalesce(auth.role(),'') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.reserve_allocations allocation
      WHERE allocation.id = p_allocation_id
        AND allocation.status = 'DRAFT'
        AND (
          allocation.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_profiles profile
            WHERE profile.id = auth.uid() AND profile.role = 'owner' AND profile.is_active
          )
        )
    );
$fn$;

CREATE OR REPLACE FUNCTION public.snp_guard_reserve_allocation_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
BEGIN
  IF OLD.status = 'DRAFT' AND NEW.status IN ('SUBMITTED','CANCELLED')
     AND NOT public.snp_reserve_draft_owned_or_owner(OLD.id) THEN
    RAISE EXCEPTION 'Seul l’auteur du brouillon ou le Owner peut engager cette transition.' USING ERRCODE='42501';
  END IF;
  IF NEW.status IN ('UNDER_REVIEW','VALIDATED_LEVEL_1','VALIDATED_LEVEL_2','TRANSFER_AUTHORIZED','RECONCILED','ACTIVE')
     AND OLD.created_by = auth.uid()
     AND coalesce(auth.role(),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Séparation des tâches : l’auteur ne peut pas contrôler ni valider son propre dossier.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS reserve_allocation_transition_guard ON public.reserve_allocations;
CREATE TRIGGER reserve_allocation_transition_guard
BEFORE UPDATE OF status ON public.reserve_allocations
FOR EACH ROW EXECUTE FUNCTION public.snp_guard_reserve_allocation_transition();

CREATE OR REPLACE FUNCTION public.snp_register_reserve_document(
  p_allocation_id uuid,p_document_type text,p_file_name text,p_storage_path text,p_mime_type text,p_size_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
DECLARE v_id uuid; v_role text;
BEGIN
  IF NOT public.snp_reserve_permission_allowed('reserve.allocations.edit') THEN
    RAISE EXCEPTION 'Permission reserve.allocations.edit requise.' USING ERRCODE='42501';
  END IF;
  IF NOT public.snp_reserve_draft_owned_or_owner(p_allocation_id) THEN
    RAISE EXCEPTION 'Seul l’auteur du brouillon ou le Owner peut ajouter une pièce.' USING ERRCODE='42501';
  END IF;
  IF p_mime_type NOT IN ('application/pdf','image/png','image/jpeg','image/webp') OR p_size_bytes<=0 OR p_size_bytes>15728640 THEN
    RAISE EXCEPTION 'Document invalide : PDF ou image, 15 Mo maximum.' USING ERRCODE='22023';
  END IF;
  SELECT role INTO v_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  INSERT INTO public.reserve_allocation_documents(
    allocation_id,document_type,file_name,storage_path,mime_type,size_bytes,uploaded_by
  ) VALUES(p_allocation_id,p_document_type,p_file_name,p_storage_path,p_mime_type,p_size_bytes,auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.reserve_allocation_events(
    allocation_id,event_type,status_from,status_to,actor_id,actor_role,comment,metadata
  ) VALUES(
    p_allocation_id,'DOCUMENT_ADDED','DRAFT','DRAFT',auth.uid(),v_role,
    'Pièce jointe ajoutée',jsonb_build_object('document_id',v_id,'document_type',p_document_type,'file_name',p_file_name)
  );
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.snp_delete_reserve_document(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=public,pg_temp
AS $fn$
DECLARE v_document public.reserve_allocation_documents%ROWTYPE; v_role text;
BEGIN
  IF NOT public.snp_reserve_permission_allowed('reserve.allocations.edit') THEN
    RAISE EXCEPTION 'Permission reserve.allocations.edit requise.' USING ERRCODE='42501';
  END IF;
  SELECT document.* INTO v_document
  FROM public.reserve_allocation_documents document
  WHERE document.id=p_document_id AND document.deleted_at IS NULL
    AND public.snp_reserve_draft_owned_or_owner(document.allocation_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable ou brouillon non modifiable.' USING ERRCODE='P0002'; END IF;
  SELECT role INTO v_role FROM public.user_profiles WHERE id=auth.uid() AND is_active;
  UPDATE public.reserve_allocation_documents SET deleted_at=now() WHERE id=p_document_id;
  INSERT INTO public.reserve_allocation_events(
    allocation_id,event_type,status_from,status_to,actor_id,actor_role,comment,metadata
  ) VALUES(
    v_document.allocation_id,'DOCUMENT_REMOVED','DRAFT','DRAFT',auth.uid(),v_role,
    'Pièce jointe retirée',jsonb_build_object('document_id',v_document.id,'document_type',v_document.document_type,'file_name',v_document.file_name)
  );
  RETURN v_document.storage_path;
END;
$fn$;

DROP POLICY IF EXISTS reserve_documents_storage_insert ON storage.objects;
CREATE POLICY reserve_documents_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='reserve-documents'
  AND public.snp_reserve_permission_allowed('reserve.allocations.edit')
  AND public.snp_reserve_draft_owned_or_owner((storage.foldername(name))[1]::uuid)
);
DROP POLICY IF EXISTS reserve_documents_storage_delete ON storage.objects;
CREATE POLICY reserve_documents_storage_delete ON storage.objects FOR DELETE TO authenticated
USING(
  bucket_id='reserve-documents'
  AND public.snp_reserve_permission_allowed('reserve.allocations.edit')
  AND public.snp_reserve_draft_owned_or_owner((storage.foldername(name))[1]::uuid)
);

REVOKE ALL ON FUNCTION public.snp_reserve_draft_owned_or_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_reserve_draft_owned_or_owner(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
