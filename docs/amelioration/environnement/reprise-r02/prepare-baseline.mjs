import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = 'docs/amelioration/environnement/reprise-r02';
const metadata = JSON.parse(fs.readFileSync(`${base}/preflight.json`,'utf8')).rows[0].preflight;
const tables = metadata.relations.map(row => row.name);
for (const table of tables) assert.match(table,/^[a-z_]+$/);
const fingerprints = tables.map(table => `SELECT '${table}' AS table_name,count(*) AS row_count,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY id),'')) AS aggregate_md5,
  coalesce(jsonb_agg(jsonb_build_object('id',id,'md5',md5(to_jsonb(t)::text)) ORDER BY id),'[]'::jsonb) AS rows
 FROM public.${table} t`).join('\nUNION ALL\n');
const sql = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R02',
 'transaction_read_only',current_setting('transaction_read_only'),
 'tables',(SELECT jsonb_agg(to_jsonb(t) ORDER BY table_name) FROM (${fingerprints}) t),
 'storage',(SELECT jsonb_build_object('count',count(*),
   'objects',coalesce(jsonb_agg(jsonb_build_object('id',id,'bucket',bucket_id,'path_md5',md5(name),
     'content_md5',md5(jsonb_build_object('bucket',bucket_id,'name',name,'metadata',metadata,'owner',owner,'created_at',created_at,'updated_at',updated_at)::text)) ORDER BY id),'[]'::jsonb))
   FROM storage.objects WHERE bucket_id IN('artisanal-sites','artisanal-site-aea','artisan-dossiers'))
) AS baseline;
ROLLBACK;`;
fs.writeFileSync(`${base}/baseline.sql`,sql+'\n');
console.log(JSON.stringify({prepared:'baseline.sql',tables,mutation:false}));
