-- À exécuter exclusivement dans une copie locale isolée après application des migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT plan(10);

SELECT has_table('public','snp_access_portals','le référentiel des portails existe');
SELECT has_table('public','snp_access_roles','le référentiel des rôles précis existe');
SELECT has_table('public','snp_user_access_assignments','les affectations utilisateur existent');
SELECT has_table('public','snp_user_permission_restrictions','les restrictions individuelles existent');
SELECT has_table('public','snp_access_audit_log','le journal d’audit immuable existe');
SELECT has_function('public','snp_effective_access_for_user',ARRAY['uuid','text','text'],'le resolver effectif existe');
SELECT has_function('public','snp_access_user_assignment_save',ARRAY['uuid','uuid','uuid','text','text','uuid','jsonb','text'],'la mutation atomique des affectations existe');
SELECT is((SELECT count(*) FROM public.snp_permission_catalog),11::bigint,'les onze permissions institutionnelles sont disponibles');
SELECT is((SELECT count(*) FROM public.user_profiles profile WHERE NOT EXISTS(SELECT 1 FROM public.snp_user_access_assignments assignment WHERE assignment.user_id=profile.id)),0::bigint,'chaque profil existant est migré');
SELECT is((SELECT count(*) FROM public.snp_user_permission_restrictions WHERE NOT denied),0::bigint,'aucune restriction ne peut accorder un droit');

SELECT * FROM finish();
ROLLBACK;
