import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = 'docs/amelioration/environnement/reprise-r02';
const [kind, rawId, stage] = process.argv.slice(2);
const id = rawId?.toLowerCase();
assert.ok(['site','artisan'].includes(kind), 'Type : site ou artisan');
assert.match(id ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.match(stage ?? '', /^[a-z0-9_-]+$/);
const prefix = 'QA20260907-R02';
const metadata = JSON.parse(fs.readFileSync(`${base}/preflight.json`,'utf8')).rows[0].preflight;
const table = kind === 'site' ? 'artisanal_sites' : 'snp_artisans_miniers';
const quote = value => "'" + String(value).replaceAll("'","''") + "'";
const uuid = `${quote(id)}::uuid`;
const guard = kind === 'site' ? `left(name,${prefix.length})=${quote(prefix)}`
  : `(left(nom,${prefix.length})=${quote(prefix)} OR left(raison_sociale,${prefix.length})=${quote(prefix)})`;
const refs = metadata.foreign_keys.filter(fk => fk.referenced_table.replace(/^public\./,'') === table).map(fk => {
  const refTable = fk.table.replace(/^public\./,'');
  assert.match(refTable,/^[a-z_]+$/);
  const column = fk.definition.match(/^FOREIGN KEY \(([a-z_]+)\) REFERENCES /)?.[1];
  assert.ok(column, 'Clé étrangère non simple : revue requise, aucune requête improvisée');
  return `SELECT '${refTable}' AS table_name,'${column}' AS column_name,count(*) AS row_count FROM public.${refTable} WHERE ${column}=${uuid}`;
}).join('\nUNION ALL\n');
const jsonRows = (childTable, condition, projection = 'to_jsonb(t)') => `(SELECT coalesce(jsonb_agg(${projection} ORDER BY id),'[]'::jsonb) FROM public.${childTable} t WHERE ${condition})`;
const safeReference = column => `CASE WHEN ${column} IS NULL THEN NULL WHEN ${column} ~ '^(data:|https?://)' THEN '[reference externe ou inline expurgée]' ELSE ${column} END`;
let parent;
let children;
let objectPaths;
if (kind === 'site') {
  parent = `(SELECT to_jsonb(t)-'photos' || jsonb_build_object('photos',coalesce((SELECT jsonb_agg(CASE WHEN photo ~ '^sites/[a-zA-Z0-9-]+\\.jpg$' THEN photo ELSE '[reference expurgée]' END ORDER BY n) FROM unnest(t.photos) WITH ORDINALITY p(photo,n)),'[]'::jsonb),'photo_reference_md5',coalesce((SELECT jsonb_agg(md5(photo) ORDER BY n) FROM unnest(t.photos) WITH ORDINALITY p(photo,n)),'[]'::jsonb)) FROM public.artisanal_sites t WHERE id=${uuid})`;
  children = `'assignments',${jsonRows('artisanal_site_assignments',`site_id=${uuid}`)},`;
  objectPaths = `SELECT 'artisanal-sites' AS bucket_id,p.photo AS name FROM public.artisanal_sites s CROSS JOIN LATERAL unnest(s.photos) p(photo) WHERE s.id=${uuid} AND p.photo ~ '^sites/'
   UNION ALL SELECT 'artisanal-site-aea',aea_document_path FROM public.artisanal_sites WHERE id=${uuid} AND aea_document_path IS NOT NULL`;
} else {
  parent = `(SELECT to_jsonb(t)-'photo_url'-'piece_identite_url' || jsonb_build_object('photo_url',${safeReference('photo_url')},'photo_reference_md5',md5(photo_url),'piece_identite_url',${safeReference('piece_identite_url')},'piece_reference_md5',md5(piece_identite_url)) FROM public.snp_artisans_miniers t WHERE id=${uuid})`;
  children = `'responsables',${jsonRows('snp_artisan_responsables',`artisan_id=${uuid}`)},
   'documents',${jsonRows('snp_artisan_documents',`artisan_id=${uuid}`)},
   'moyens_paiement',${jsonRows('snp_artisan_moyens_paiement',`artisan_id=${uuid}`)},
   'cards',${jsonRows('snp_cartes_professionnelles',`artisan_id=${uuid}`,`jsonb_build_object('id',id,'artisan_id',artisan_id,'numero_carte',numero_carte,'numero_affiliation',numero_affiliation,'affiliation_version',affiliation_version,'statut',statut,'date_emission',date_emission,'date_expiration',date_expiration,'valid_from',valid_from,'valid_until',valid_until,'activated_at',activated_at,'render_status',render_status,'created_at',created_at,'updated_at',updated_at)`)},`;
  objectPaths = `SELECT storage_bucket AS bucket_id,chemin_fichier AS name FROM public.snp_artisan_documents WHERE artisan_id=${uuid} AND deleted_at IS NULL`;
}
const sql = `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.${table} WHERE id=${uuid} AND ${guard}) THEN
  RAISE EXCEPTION 'UUID absent ou dossier hors du préfixe QA20260907-R02 autorisé';
 END IF;
END; $guard$;
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','${prefix}','kind','${kind}','id',${quote(id)},
 'parent',${parent},${children}
 'references',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY table_name,column_name),'[]'::jsonb) FROM (${refs}) r),
 'storage',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',p.bucket_id,'path',p.name,'found',o.id IS NOT NULL,
   'object_id',o.id,'created_at',o.created_at,'updated_at',o.updated_at,'size',o.metadata->>'size','mimetype',o.metadata->>'mimetype',
   'metadata_md5',md5(o.metadata::text)) ORDER BY p.bucket_id,p.name),'[]'::jsonb)
   FROM (${objectPaths}) p LEFT JOIN storage.objects o ON o.bucket_id=p.bucket_id AND o.name=p.name)
) AS dossier;
ROLLBACK;`;
const stem = `${kind}-${stage}-${id}`;
assert.ok(!fs.existsSync(`${base}/${stem}.sql`), 'Ne pas écraser une preuve préparée');
fs.writeFileSync(`${base}/${stem}.sql`,sql+'\n');
console.log(JSON.stringify({ prepared: `${base}/${stem}.sql`, command: `node ${base}/run-readonly.mjs ${stem}.sql ${stem}`, executed:false }));
