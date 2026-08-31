// Prints a candidate for review; does not write SQL or access the server.
import { readFileSync } from 'node:fs';
const read=(name)=>readFileSync(`supabase/migrations/${name}`,'utf8').replace(/\r\n?/g,'\n');
const iam=read('20260827230000_refonte_acces_institutionnels.sql');
const gl=read('20260827190000_securiser_lecture_conciliation_multitenant.sql');
let sod=read('20260827231000_durcir_separation_fonctions_workflows.sql').replace(/^BEGIN;$/m,'').replace(/COMMIT;\s*$/,'');
sod=sod.replace('CREATE POLICY snp_sod_legacy_review_read','DROP POLICY IF EXISTS snp_sod_legacy_review_read ON public.snp_sod_legacy_review;\nCREATE POLICY snp_sod_legacy_review_read');
sod=sod.replace("IF position('IF NOT snp_peut_valider()' IN v_definition)=0 THEN", "IF position('snp_actor_has_capability(''sonasp.prepare'')' IN v_definition)>0 THEN RETURN; END IF;\n  IF position('IF NOT snp_peut_valider()' IN v_definition)=0 THEN");
const scopes=iam.slice(iam.indexOf('CREATE OR REPLACE FUNCTION public.snp_actor_can_access_organization'),iam.indexOf('CREATE OR REPLACE FUNCTION public.snp_guard_user_permission_ceiling'));
const ledgers=gl.slice(gl.indexOf('CREATE OR REPLACE FUNCTION public.snp_solde_commercial'),gl.indexOf('DO $$'));
console.log(JSON.stringify(`-- Convergence additive du socle partiellement publié.
-- Ne rejoue pas les catalogues ni les migrations de comptes historiques.
-- Les définitions IAM Owner/Admin les plus récentes sont conservées.
-- Prérequis : 20260830120000 fournit le prédicat de conciliation courant.
BEGIN;
${scopes}
REVOKE ALL ON FUNCTION public.snp_actor_can_access_organization(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.snp_authorize_scoped_action(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.snp_actor_can_access_organization(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.snp_authorize_scoped_action(text,uuid) TO authenticated;
${ledgers}
${sod}
COMMIT;
`));
