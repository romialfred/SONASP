-- Journalisation et suppression logique des pièces jointes d'une affectation.
BEGIN;

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
  IF p_mime_type NOT IN ('application/pdf','image/png','image/jpeg','image/webp') OR p_size_bytes<=0 OR p_size_bytes>15728640 THEN
    RAISE EXCEPTION 'Document invalide : PDF ou image, 15 Mo maximum.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.reserve_allocations WHERE id=p_allocation_id AND status='DRAFT') THEN
    RAISE EXCEPTION 'Les pièces ne peuvent être modifiées que sur un brouillon.' USING ERRCODE='22023';
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
  JOIN public.reserve_allocations allocation ON allocation.id=document.allocation_id
  WHERE document.id=p_document_id AND document.deleted_at IS NULL AND allocation.status='DRAFT'
  FOR UPDATE OF document;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document introuvable ou dossier non modifiable.' USING ERRCODE='P0002'; END IF;
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

REVOKE ALL ON FUNCTION public.snp_delete_reserve_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snp_delete_reserve_document(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
