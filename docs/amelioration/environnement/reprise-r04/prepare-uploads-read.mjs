// Prépare une relecture des seuls objets référencés par le site UI exact. Aucun appel distant.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const folder='docs/amelioration/environnement/reprise-r04';
const [id,stage]=process.argv.slice(2);
assert.match(id??'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.match(stage??'',/^[a-z0-9_-]+$/);
const sql=`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='20s';
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id='${id}'::uuid AND left(name,length('QA20260907-R04'))='QA20260907-R04') THEN
   RAISE EXCEPTION 'Site absent ou extérieur au RUN R04'; END IF;
 IF EXISTS(SELECT 1 FROM public.artisanal_sites s CROSS JOIN LATERAL unnest(s.photos) p(name)
   WHERE s.id='${id}'::uuid AND p.name !~ '^sites/[a-zA-Z0-9-]+\\.jpg$') THEN
   RAISE EXCEPTION 'Référence de photo non canonique : contrôle manuel requis'; END IF;
 IF EXISTS(SELECT 1 FROM public.artisanal_sites WHERE id='${id}'::uuid AND aea_document_path IS NOT NULL
   AND (split_part(aea_document_path,'/',1)<>'${id}' OR aea_document_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(pdf|jpg|jpeg|png)$')) THEN
   RAISE EXCEPTION 'Référence AEA extérieure au site ou non canonique'; END IF;
END; $guard$;
WITH paths AS (
 SELECT 'artisanal-sites'::text AS bucket,p.name FROM public.artisanal_sites s CROSS JOIN LATERAL unnest(s.photos) p(name) WHERE s.id='${id}'::uuid
 UNION ALL SELECT 'artisanal-site-aea',aea_document_path FROM public.artisanal_sites WHERE id='${id}'::uuid AND aea_document_path IS NOT NULL
)
SELECT jsonb_build_object('checked_at',clock_timestamp(),'run_prefix','QA20260907-R04','site_id','${id}',
 'objects',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',p.bucket,'path',p.name,'found',o.id IS NOT NULL,
   'object_id',o.id,'created_at',o.created_at,'updated_at',o.updated_at,'owner_id',to_jsonb(o)->>'owner_id',
   'size',o.metadata->>'size','mimetype',o.metadata->>'mimetype','metadata_md5',md5(o.metadata::text),
   'site_reference_count',(SELECT count(*) FROM public.artisanal_sites s WHERE
     (p.bucket='artisanal-sites' AND p.name=ANY(s.photos)) OR (p.bucket='artisanal-site-aea' AND s.aea_document_path=p.name))) ORDER BY p.bucket,p.name),'[]'::jsonb)
   FROM paths p LEFT JOIN storage.objects o ON o.bucket_id=p.bucket AND o.name=p.name)) AS uploads;
ROLLBACK;
`;
const stem=`uploads-${stage}-${id}`;
fs.writeFileSync(`${folder}/${stem}.sql`,sql,{flag:'wx'});
console.log(JSON.stringify({preparedOnly:true,file:`${folder}/${stem}.sql`,command:`node ${folder}/run-readonly.mjs ${stem}.sql ${stem}`}));
