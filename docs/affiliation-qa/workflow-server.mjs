/** Disposable local SQL harness. No remote URL, credential, business data, or production auth. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';

const executeFile = promisify(execFile);
const ACTORS = { maker: 'a1000000-0000-4000-8000-000000000001', checker: 'a1000000-0000-4000-8000-000000000002', outsider: 'a1000000-0000-4000-8000-000000000003' };
const MEMBER = 'b1000000-0000-4000-8000-000000000001';
const CARD = 'c1000000-0000-4000-8000-000000000001';
const TARIFF = 'd1000000-0000-4000-8000-000000000001';
const CAPS = ['artisan.cards.manage','artisan.membership.manage','artisan.membership.confirm','artisan.cards.activate','platform.settings.manage'];
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const ALLOWED_TABLES = new Set(['snp_adhesion_baremes','snp_adhesion_droits','snp_adhesion_encaissements','snp_adhesion_preuves','snp_cartes_professionnelles','snp_artisans_miniers']);
const ALLOWED_RPC = new Set(['snp_lister_affiliations','snp_affiliation_history','snp_preparer_carte_affiliation','snp_activer_carte_affiliation','snp_corriger_carte_affiliation','snp_configurer_adhesion_bareme','snp_etablir_adhesion_droit','snp_enregistrer_adhesion_encaissement','snp_controler_adhesion_encaissement','snp_annuler_adhesion_droit','snp_artisans_eligibles_operations','snp_artisan_affiliation_eligible','snp_verifier_affiliation','snp_transition_carte_professionnelle','snp_renouveler_carte_professionnelle']);
const listRpc = new Set(['snp_lister_affiliations','snp_affiliation_history','snp_artisans_eligibles_operations']);

export function affiliationWorkflowServer(root) {
  const db = new PGlite();
  const files = new Map();
  let pending = Promise.resolve();
  const query = (sql, args = []) => db.query(sql, args);
  const one = async (sql, args = []) => (await query(sql, args)).rows[0];
  const serial = (fn) => { const task = pending.then(fn, fn); pending = task.catch(() => {}); return task; };
  const initialized = (async () => {
    await db.exec(await fs.readFile(path.join(root, 'supabase/tests/fixtures/affiliation-baseline.sql'), 'utf8'));
    await db.exec(await fs.readFile(path.join(root, 'supabase/migrations/20260906134228_affiliations_cartes_faso_sanama.sql'), 'utf8'));
    await db.exec(await fs.readFile(path.join(root, 'supabase/migrations/20260906235254_affiliation_payment_evidence_and_paid_generation.sql'), 'utf8'));
    await db.exec('ALTER TABLE snp_artisans_miniers ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()');
    for (const [name,id] of Object.entries(ACTORS)) {
      await query('INSERT INTO auth.users(id) VALUES($1)', [id]);
      await query('INSERT INTO test_profiles(id,capabilities,scope) VALUES($1,$2,$3)', [id,CAPS,name === 'outsider' ? 'b1000000-0000-4000-8000-000000000099' : null]);
    }
    await query("INSERT INTO artisanal_sites(id,name) VALUES('e1000000-0000-4000-8000-000000000001','Site de recette isolée')");
    await query("INSERT INTO snp_artisans_miniers(id,numero_carte,type_personne,type_artisan,nom,prenoms,photo_url,commune,artisanal_site_id) VALUES($1,'QA-AFFILIATION-2026-0001','physique','exploitant','RECETTE ISOLÉE','Affiliation',$2,'Ouagadougou','e1000000-0000-4000-8000-000000000001')", [MEMBER,`${MEMBER}/portrait.png`]);
    await query("INSERT INTO snp_cartes_professionnelles(id,artisan_id,numero_carte,numero_affiliation,affiliation_version,date_emission,date_expiration,statut,created_by) VALUES($1,$2,'QA-AFFILIATION-2026-0001','QA-AFFILIATION-2026-0001',1,CURRENT_DATE,CURRENT_DATE,'en_cours',$3)", [CARD,MEMBER,ACTORS.maker]);
    await query("INSERT INTO snp_adhesion_baremes(id,libelle,role_artisan,montant,devise,duree_jours,fuseau,alerte_jours,created_by) VALUES($1,'Barème de recette isolée','exploitant',10000,'XOF',365,'Africa/Ouagadougou',30,$2)", [TARIFF,ACTORS.maker]);
    console.info('Affiliation QA: disposable PGlite database ready. No remote connection.');
  })();
  const asActor = async (actor) => {
    await db.exec('RESET ROLE');
    await query("SELECT set_config('test.uid',$1,false),set_config('test.session','active',false),set_config('test.aal','aal2',false),set_config('request.jwt.claims','{}',false)", [ACTORS[actor] || ACTORS.maker]);
    await db.exec('SET ROLE authenticated');
  };
  async function rpc(name,args) {
    if (!ALLOWED_RPC.has(name)) return { data: [], error: null };
    const entries = Object.entries(args);
    if (!entries.every(([key]) => IDENTIFIER.test(key))) throw new Error('Invalid QA argument');
    const call = `public.${name}(${entries.map(([key],i) => `${key}=>$${i+1}`).join(',')})`;
    if (name === 'snp_affiliation_history') return { data: (await query(`SELECT * FROM ${call}`,entries.map(([,value]) => value))).rows, error: null };
    const rows = (await query(`SELECT ${call} AS value`,entries.map(([,value]) => value))).rows;
    return { data: listRpc.has(name) ? rows.map((row) => row.value) : rows[0]?.value ?? null, error: null };
  }
  async function readTable(body) {
    if (!ALLOWED_TABLES.has(body.table)) return { data: [], error: null };
    const values = [];
    const where = (body.filters || []).map(({field,value,op}) => {
      if (!IDENTIFIER.test(field)) throw new Error('Invalid QA filter');
      values.push(value);
      return op === 'in' ? `${field}=ANY($${values.length})` : `${field}=$${values.length}`;
    });
    const orders = (body.orders || []).map(({field,ascending}) => { if (!IDENTIFIER.test(field)) throw new Error('Invalid QA order'); return `${field} ${ascending ? 'ASC' : 'DESC'}`; });
    // PostgreSQL JSON preserves date columns as YYYY-MM-DD, matching PostgREST.
    // PGlite's native date decoder would otherwise emit midnight timestamps.
    const rows = (await query(`SELECT to_jsonb(qa_row) AS value FROM (SELECT * FROM public.${body.table}${where.length ? ' WHERE '+where.join(' AND ') : ''}${orders.length ? ' ORDER BY '+orders.join(',') : ''} LIMIT ${Math.max(1,Math.min(500,Number(body.limit) || 500))}) qa_row`,values)).rows.map(row=>row.value);
    return { data: body.single ? rows[0] || null : rows, error: null };
  }
  async function proof(body,actor) {
    const allowed = (await one('SELECT public.snp_adhesion_preuve_allowed($1) AS value',[body.duesId])).value;
    const file = body.file;
    const extension = {'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[file?.type];
    const bytes = Buffer.from(file?.bytes || []);
    if (!extension || !bytes.length || bytes.length > 5242880) throw new Error('Invalid local proof file');
    const magic = extension === 'pdf' ? bytes.subarray(0,5).toString() === '%PDF-' : extension === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!magic) throw new Error('Invalid local proof signature');
    const objectPath = `${allowed.artisan_id}/${body.duesId}/${body.receiptId}.${extension}`;
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await db.exec('RESET ROLE');
    const existing = await one('SELECT * FROM snp_adhesion_preuves WHERE paiement_id=$1',[body.receiptId]);
    if (existing && existing.sha256 !== sha256) throw new Error('A different proof already exists');
    await query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('affiliation-payment-proofs',$1,$2) ON CONFLICT(bucket_id,name) DO NOTHING",[objectPath,JSON.stringify({size:bytes.length,mimetype:file.type})]);
    await query('INSERT INTO snp_adhesion_preuves(paiement_id,droit_id,artisan_id,path,file_name,mime_type,file_size,sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(paiement_id) DO NOTHING',[body.receiptId,body.duesId,allowed.artisan_id,objectPath,file.name,file.type,bytes.length,sha256,ACTORS[actor]]);
    files.set(`affiliation-payment-proofs/${objectPath}`,{ bytes,type:file.type });
    return { data: { proof: { path:objectPath,file_name:file.name,mime_type:file.type,file_size:bytes.length,sha256 } }, error:null };
  }
  async function render(body) {
    const claim = (await one('SELECT public.snp_claim_affiliation_render($1) AS value',[body.cardId])).value;
    if (claim.ready) return { data:{success:true},error:null };
    const temp = await fs.mkdtemp(path.join(os.tmpdir(),'faso-affiliation-qa-'));
    const input = path.join(temp,'input.json');
    await fs.writeFile(input,JSON.stringify(claim.card));
    const deno = process.env.QA_DENO_BIN || 'deno';
    await executeFile(deno,['run','--node-modules-dir=none','--allow-read','--allow-write='+temp,'--allow-env',path.join(root,'docs/affiliation-qa/workflow-render.ts'),input,temp],{cwd:root,windowsHide:true,timeout:60000});
    const rendered = {};
    await db.exec('RESET ROLE');
    for (const face of ['recto','verso','pdf','portrait']) {
      const extension = face === 'pdf' ? 'pdf' : 'png';
      const type = face === 'pdf' ? 'application/pdf' : 'image/png';
      const bytes = await fs.readFile(path.join(temp,`${face}.${extension}`));
      const objectPath = `${claim.card.artisan_id}/${claim.card.id}/v${claim.card.version}-r${claim.card.render_revision}/${claim.lease}/${face}.${extension}`;
      rendered[face] = {path:objectPath,sha256:createHash('sha256').update(bytes).digest('hex')};
      files.set(`affiliation-cards/${objectPath}`,{bytes,type});
      await query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('affiliation-cards',$1,$2)",[objectPath,JSON.stringify({size:bytes.length,mimetype:type})]);
    }
    await query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");
    await query('SELECT public.snp_complete_affiliation_render($1,$2,$3,$4)',[claim.card.id,claim.lease,claim.card.render_revision,JSON.stringify(rendered)]);
    return { data:{success:true},error:null };
  }
  const snapshot = async () => {
    await db.exec('RESET ROLE');
    return {
      environment:'Disposable local PGlite. No remote data.',
      cards:(await query('SELECT id,numero_affiliation,statut,render_status,valid_from,valid_until,activated_at,public.snp_affiliation_effective_status(c) AS effective_status FROM snp_cartes_professionnelles c')).rows,
      dues:(await query('SELECT id,montant,devise,debut,fin,statut FROM snp_adhesion_droits')).rows,
      receipts:(await query('SELECT id,montant,reference,date_paiement,annee_adhesion,lieu_paiement,preuve_path,statut,created_by,confirmed_by FROM snp_adhesion_encaissements')).rows,
      proofs:(await query('SELECT paiement_id,file_name,mime_type,file_size,sha256 FROM snp_adhesion_preuves')).rows,
      storage:(await query('SELECT bucket_id,name,metadata FROM storage.objects')).rows,
      audit:(await query('SELECT action,status_after,actor_id FROM snp_workflow_audit ORDER BY id')).rows,
    };
  };
  const cleanup = async () => {
    await db.exec('RESET ROLE');
    await query('DELETE FROM snp_adhesion_encaissements WHERE droit_id IN (SELECT id FROM snp_adhesion_droits WHERE artisan_id=$1)',[MEMBER]);
    await query('DELETE FROM snp_adhesion_preuves WHERE artisan_id=$1',[MEMBER]);
    await query('DELETE FROM snp_adhesion_droits WHERE artisan_id=$1',[MEMBER]);
    await query('DELETE FROM snp_cartes_professionnelles WHERE artisan_id=$1',[MEMBER]);
    await query('DELETE FROM snp_artisans_miniers WHERE id=$1',[MEMBER]);
    await query("DELETE FROM storage.objects WHERE name LIKE $1",[MEMBER+'/%']);
    await query('DELETE FROM snp_workflow_audit WHERE actor_id=ANY($1)',[Object.values(ACTORS)]);
    await query('DELETE FROM snp_adhesion_baremes WHERE id=$1',[TARIFF]);
    files.clear();
    return snapshot();
  };
  function respond(res,result,status=200) { res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(result,null,2)); }
  return {
    name:'isolated-affiliation-workflow-qa',
    configureServer(server) {
      let proofHandlerModule;
      const invokeProofHandler = async (body, actor) => {
        proofHandlerModule ??= await server.ssrLoadModule('/@fs/' + path.join(root,'supabase/functions/affiliation-payment-proof-upload/handler.ts').replaceAll('\\','/'));
        const form = new FormData();
        form.append('duesId',body.duesId);
        form.append('receiptId',body.receiptId);
        form.append('file',new File([Uint8Array.from(body.file.bytes)],body.file.name,{type:body.file.type}));
        const handler = proofHandlerModule.createAffiliationProofHandler({
          authenticate:async () => Boolean(ACTORS[actor]),
          save:async (_token,duesId,receiptId,file) => (await proof({duesId,receiptId,file:{name:file.name,type:file.mime,bytes:Array.from(file.bytes)}},actor)).data.proof,
        });
        const response = await handler(new Request('http://127.0.0.1/qa-proof',{method:'POST',headers:{Authorization:'Bearer isolated-local-qa'},body:form}));
        const result = await response.json();
        return response.ok ? {data:result,error:null} : {data:null,error:{code:'P0001',message:result.error}};
      };
      server.middlewares.use(async (req,res,next) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        if (!url.pathname.startsWith('/__affiliation_qa/')) {
          if (req.headers.accept?.includes('text/html') && !url.pathname.includes('.')) req.url='/workflow.html'+url.search;
          return next();
        }
        try {
          await initialized;
          const result = await serial(async () => {
            if (url.pathname.endsWith('/state')) return snapshot();
            if (url.pathname.endsWith('/cleanup') && req.method==='POST') return cleanup();
            if (url.pathname.endsWith('/file')) {
              await asActor(url.searchParams.get('actor'));
              const bucket=url.searchParams.get('bucket');const objectPath=url.searchParams.get('path');
              const allowed=await one('SELECT name FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,objectPath]);
              const file=files.get(`${bucket}/${objectPath}`);
              if(!allowed || !file) {respond(res,{error:'Unavailable'},404);return undefined;}
              res.setHeader('Content-Type',file.type);res.setHeader('Cache-Control','no-store');res.end(file.bytes);return undefined;
            }
            const chunks=[];for await(const chunk of req)chunks.push(chunk);
            const body=JSON.parse(Buffer.concat(chunks).toString() || '{}');
            const actor=req.headers['x-qa-actor'] || 'maker';await asActor(actor);
            if(body.kind==='rpc')return rpc(body.name,body.args || {});
            if(body.kind==='table')return readTable(body);
            if(body.kind==='edge' && body.name==='affiliation-payment-proof-upload')return invokeProofHandler(body.body,actor);
            if(body.kind==='edge' && body.name==='affiliation-card-render')return render(body.body);
            return {data:[],error:null};
          });
          if(result!==undefined)respond(res,result);
        } catch(error) {respond(res,{data:null,error:{message:error.message,code:error.code || 'P0001'}});}
      });
    },
  };
}
