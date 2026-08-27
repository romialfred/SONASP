-- La chronologie reelle vit ailleurs que dans les tables heritees.
--
-- CONSTAT, mesure sur la base le 27 aout 2026
-- production_status_history : 0 ligne. La vraie chronologie de production est
-- dans unified_status_history (entity_type='production', 240 evenements), et
-- celle des expeditions au meme endroit (entity_type='shipping', 82 evenements).
-- Les transitions de paiement recentes s'ecrivent au journal snp_workflow_audit
-- (aggregate_type='international-payment'). Sans ces trois sources, le dossier
-- afficherait une chronologie tronquee en se croyant complete.
--
-- MECANISME
-- Cette migration injecte trois branches UNION dans la section chronologie de
-- snp_dossier_complet, par reecriture de sa definition. Elle est rejouable :
-- si les branches sont deja presentes, elle ne fait rien ; si l'ancre a
-- disparu (fonction remaniee), elle echoue explicitement plutot que de
-- laisser croire qu'elle a agi.

DO $$
declare
  v_def text;
  v_ancre text;
  v_ajout text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='snp_dossier_complet';

  if v_def is null then
    raise exception 'snp_dossier_complet est absente : appliquer d''abord fonction_dossier_complet.';
  end if;
  if position('unified_status_history' in v_def) > 0 then
    raise notice 'Branches deja presentes : rien a faire.';
    return;
  end if;

  v_ancre := 'UNION ALL
    SELECT jsonb_build_object(''etape'', ''enlevement'', ''date'', rh.survenu_le,';

  if position(v_ancre in v_def) = 0 then
    raise exception 'Ancre d''injection introuvable : la fonction a ete remaniee, reprendre cette migration.';
  end if;

  v_ajout := 'UNION ALL
    -- La chronologie reelle de la production et de l''expedition vit dans
    -- unified_status_history ; les tables heritees sont vides.
    SELECT jsonb_build_object(''etape'', ''production'', ''date'', ush.changed_at,
      ''titre'', coalesce(ush.action_description, ''Statut : '' || ush.new_status),
      ''detail'', coalesce(ush.notes, ''''),
      ''acteur'', up.full_name)
    FROM unified_status_history ush
    LEFT JOIN user_profiles up ON up.id = ush.changed_by
    WHERE ush.entity_type = ''production'' AND ush.entity_id = ANY(v_production_ids)
    UNION ALL
    SELECT jsonb_build_object(''etape'', ''expedition'', ''date'', ush.changed_at,
      ''titre'', coalesce(ush.action_description, ''Statut : '' || ush.new_status),
      ''detail'', coalesce(ush.notes, ''''),
      ''acteur'', up.full_name)
    FROM unified_status_history ush
    LEFT JOIN user_profiles up ON up.id = ush.changed_by
    WHERE ush.entity_type = ''shipping'' AND ush.entity_id = ANY(v_sp_ids)
    UNION ALL
    -- Les transitions de paiement recentes s''ecrivent au journal de workflow.
    SELECT jsonb_build_object(''etape'', ''paiement'', ''date'', wa.occurred_at,
      ''titre'', wa.action || coalesce('' : '' || wa.status_after, ''''),
      ''detail'', coalesce(wa.reason, ''''),
      ''acteur'', up.full_name)
    FROM snp_workflow_audit wa
    LEFT JOIN user_profiles up ON up.id = wa.actor_id
    WHERE wa.aggregate_type = ''international-payment''
      AND wa.aggregate_id IN (SELECT p2.id FROM payments p2 WHERE p2.sale_id = v_sale_id)
    ' || v_ancre;

  v_def := replace(v_def, v_ancre, v_ajout);
  execute v_def;
end $$;

DO $$
BEGIN
  IF position('unified_status_history' in (
    SELECT pg_get_functiondef(p.oid) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'snp_dossier_complet')) = 0 THEN
    RAISE EXCEPTION 'Postflight : les branches de chronologie reelle sont absentes.';
  END IF;
END;
$$;
