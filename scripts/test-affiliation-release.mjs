// Rehearse the publication orchestrator against an isolated real PostgreSQL engine.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const root=process.cwd();
const workspace=path.join(root,'backups','affiliation-release-isolated-'+randomUUID());
await mkdir(path.join(workspace,'supabase','.temp'),{recursive:true});
await mkdir(path.join(workspace,'supabase','migrations'),{recursive:true});
const migration='20260906235254_affiliation_payment_evidence_and_paid_generation.sql';
await cp(path.join(root,'supabase','migrations',migration),path.join(workspace,'supabase','migrations',migration));
await cp(path.join(root,'supabase','migrations.catalogue.json'),path.join(workspace,'supabase','migrations.catalogue.json'));
await writeFile(path.join(workspace,'supabase','.temp','project-ref'),'yyverzuhkdonjjuficor');
const databasePath=path.join(workspace,'database');
const database=new PGlite(databasePath);
await database.exec(await readFile(path.join(root,'supabase','tests','fixtures','affiliation-baseline.sql'),'utf8'));
await database.exec(await readFile(path.join(root,'supabase','migrations','20260906134228_affiliations_cartes_faso_sanama.sql'),'utf8'));
await database.exec("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]); INSERT INTO supabase_migrations.schema_migrations VALUES('20260906134228','base',ARRAY['base']);");
const artisan=randomUUID(),card=randomUUID(),tariff=randomUUID(),dues=randomUUID();
await database.query("INSERT INTO snp_artisans_miniers(id,numero_carte,type_personne,type_artisan,nom) VALUES($1,'ISOLATED-RELEASE','physique','exploitant','Test isolé')",[artisan]);
await database.query("INSERT INTO snp_cartes_professionnelles(id,artisan_id,numero_carte,numero_affiliation,affiliation_version,date_emission,date_expiration,statut) VALUES($1,$2,'ISOLATED-RELEASE','ISOLATED-RELEASE',1,CURRENT_DATE,CURRENT_DATE+364,'en_cours')",[card,artisan]);
await database.query("INSERT INTO snp_adhesion_baremes(id,libelle,role_artisan,montant,devise,duree_jours,fuseau,alerte_jours) VALUES($1,'Barème isolé','exploitant',100,'XOF',365,'Africa/Ouagadougou',30)",[tariff]);
await database.query("INSERT INTO snp_adhesion_droits(id,carte_id,artisan_id,bareme_id,montant,devise,duree_jours,fuseau,alerte_jours,debut,fin) VALUES($1,$2,$3,$4,100,'XOF',365,'Africa/Ouagadougou',30,CURRENT_DATE,CURRENT_DATE+364)",[dues,card,artisan,tariff]);
await database.query("INSERT INTO snp_adhesion_encaissements(id,droit_id,montant,reference,mode,date_paiement) VALUES($1,$2,100,'RELEASE-RECEIPT','cash',CURRENT_DATE)",[randomUUID(),dues]);
await database.close();
// The real script invokes `CLI db query --linked --file ...`. Node's first argument
// resolves this temporary `db` module, which implements only that SQL-file operation.
const pgliteModule=pathToFileURL(path.join(root,'node_modules','@electric-sql','pglite','dist','index.js')).href;
await writeFile(path.join(workspace,'db'),`
import {readFile} from 'node:fs/promises';
import {PGlite} from ${JSON.stringify(pgliteModule)};
const args=process.argv.slice(2);
if(args[0]!=='query'||!args.includes('--linked')||!args.includes('--file'))throw new Error('Unsupported isolated command');
const sql=await readFile(args[args.indexOf('--file')+1],'utf8');
const db=new PGlite(${JSON.stringify(databasePath)});
try{const results=await db.exec(sql); process.stdout.write(JSON.stringify({rows:results.at(-1)?.rows||[]}));}
finally{await db.close();}
`);
const script=path.join(root,'scripts','release','deploy-affiliation-payment-evidence.mjs');
const results=[];
for(const mode of ['backup','rehearse','apply','verify','apply']) {
 const output=execFileSync(process.execPath,[script,mode,process.execPath,'backups/proof'],{cwd:workspace,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 const result=JSON.parse(output.trim());results.push(result);
 if(mode==='rehearse')assert.equal(result.rollbackVerified,true);
}
assert.equal(results.at(-1).alreadyApplied,true);
console.log('Déploiement affiliation validé en base isolée : backup, ROLLBACK, application, 15 contrôles et application idempotente.');
console.log('Preuves locales privées : '+workspace);
