// Prépare une lecture seule ; aucune exécution SQL ni suppression.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const folder = 'docs/amelioration/environnement/reprise-r02';
const extract = (file, alias) => {
  const sql = fs.readFileSync(`${folder}/${file}`, 'utf8');
  const start = sql.indexOf('SELECT jsonb_build_object(');
  const end = sql.lastIndexOf(` AS ${alias};`);
  assert.ok(start > 0 && end > start);
  return sql.slice(start, end + ` AS ${alias}`.length);
};
const metadata = `jsonb_build_object(
 'foreign_keys',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,
   'referenced_table',c.confrelid::regclass::text,'definition',pg_get_constraintdef(c.oid),'delete_action',c.confdeltype,
   'columns',(SELECT jsonb_agg(a.attname ORDER BY k.n) FROM unnest(c.conkey) WITH ORDINALITY k(attnum,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum),
   'referenced_columns',(SELECT jsonb_agg(a.attname ORDER BY k.n) FROM unnest(c.confkey) WITH ORDINALITY k(attnum,n) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum))
   ORDER BY c.conrelid::regclass::text,c.conname),'[]'::jsonb) FROM pg_constraint c
   WHERE c.contype='f' AND c.confrelid IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass)),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'internal',t.tgisinternal,
   'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text,
   'function_md5',CASE WHEN NOT t.tgisinternal THEN md5(pg_get_functiondef(t.tgfoid)) ELSE NULL END)
   ORDER BY t.tgrelid::regclass::text,t.tgname),'[]'::jsonb) FROM pg_trigger t
   WHERE t.tgrelid IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass)),
 'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',r.ev_class::regclass::text,'name',r.rulename,'definition',pg_get_ruledef(r.oid))
   ORDER BY r.ev_class::regclass::text,r.rulename),'[]'::jsonb) FROM pg_rewrite r
   WHERE r.ev_class IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass))
)`;
fs.writeFileSync(`${folder}/cleanup-schema-expression.txt`, metadata, { flag: 'wx' });
const sql = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
WITH dossier_read AS (${extract('site-creation-d9f7160a-aadd-41d9-ad4d-c9f886d41e0c.sql','dossier')}),
baseline_read AS (${extract('baseline.sql','baseline')})
SELECT jsonb_build_object('checked_at',clock_timestamp(),'project_ref','yyverzuhkdonjjuficor',
 'read_only',current_setting('transaction_read_only'),
 'dossier',(SELECT dossier FROM dossier_read),'baseline',(SELECT baseline FROM baseline_read),
 'schema',${metadata},
 'trigger_functions',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
  FROM pg_proc p WHERE p.oid IN (SELECT t.tgfoid FROM pg_trigger t WHERE NOT t.tgisinternal
    AND t.tgrelid IN ('public.artisanal_sites'::regclass,'public.artisanal_site_assignments'::regclass)))) AS cleanup_preflight;
ROLLBACK;
`;
fs.writeFileSync(`${folder}/cleanup-preflight.sql`, sql, { flag: 'wx' });
console.log('Préflight de nettoyage préparé uniquement.');
