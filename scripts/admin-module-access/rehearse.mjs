// Répétition distante annulée : aucun mode COMMIT, aucun token utilisateur manipulé.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = process.argv[2];
if (!cli) throw new Error('Usage: node scripts/admin-module-access/rehearse.mjs CHEMIN_CLI_SUPABASE');
if (readFileSync(path.join(root, 'supabase/.temp/project-ref'), 'utf8').trim() !== 'yyverzuhkdonjjuficor') {
  throw new Error('Projet lié inattendu : arrêt.');
}
const migration = readFileSync(path.join(root,
  'supabase/migrations/20260830160000_habilitations_administrateur_configurables.sql'), 'utf8');
if (!/^BEGIN;\s*$/m.test(migration) || !/COMMIT;\s*$/.test(migration)) throw new Error('Transaction inattendue');
const body = migration.replace(/^BEGIN;\s*$/m, '').replace(/COMMIT;\s*$/, '');
const dir = mkdtempSync(path.join(tmpdir(), 'sonasp-admin-rehearsal-'));
const file = path.join(dir, 'rehearse.sql');
const fingerprint = `SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY id),'')) FROM public.user_permissions p`;
writeFileSync(file, `BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE admin_permission_before ON COMMIT DROP AS ${fingerprint};
${body}
DO $check$ BEGIN
 IF (SELECT md5 FROM admin_permission_before) IS DISTINCT FROM (${fingerprint}) THEN
   RAISE EXCEPTION 'Les permissions existantes ont changé : arrêt.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id='c7570144-0075-4cb0-8a59-4713c1ebe07f'
   AND lower(email)='otingueri@gmail.com' AND role='admin' AND is_active AND mining_company_id IS NULL) THEN
   RAISE EXCEPTION 'Le compte cible a changé : arrêt.';
 END IF;
END $check$;
SELECT jsonb_build_object(
 'mode','ROLLBACK obligatoire',
 'existing_permissions_unchanged',true,
 'active_modules',(SELECT count(*) FROM public.modules WHERE is_active),
 'assignable_modules',(SELECT count(*) FROM public.modules m WHERE is_active AND
   public.snp_user_permission_allowed('c7570144-0075-4cb0-8a59-4713c1ebe07f',m.id,'edit')),
 'direct_permission_writes_blocked',NOT has_table_privilege('authenticated','public.user_permissions','UPDATE')
) AS result;
ROLLBACK;
`, { mode: 0o600 });
const output = execFileSync(cli, ['db', 'query', '--linked', '--file', file, '-o', 'json'], {
  cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const result = JSON.parse(output.slice(output.indexOf('{')));
console.log(JSON.stringify({ evidenceDirectory: dir, rows: result.rows }, null, 2));
