import { Buffer } from 'node:buffer';
/** Actual worker renderer, isolated fixture, no connection to a business database. */
import assert from 'node:assert/strict';
import { PNG } from 'npm:pngjs@7.0.0';
import jsQR from 'npm:jsqr@1.4.0';
import { generateAffiliationFiles } from '../supabase/functions/affiliation-card-render/render-files.ts';
const output = new URL('../docs/affiliation-qa/', import.meta.url);
await Deno.mkdir(output, { recursive: true });
const portrait = new PNG({ width: 300, height: 400 });
// A deliberately neutral placeholder, visibly labelled as test data by the holder name.
for (let y=0;y<400;y++) for(let x=0;x<300;x++) {
 const index=(y*300+x)*4; const head=((x-150)**2+(y-110)**2<55**2); const body=((x-150)**2/105**2+(y-320)**2/140**2<1);
 portrait.data[index]=head||body?125:240; portrait.data[index+1]=head||body?145:245; portrait.data[index+2]=head||body?160:247; portrait.data[index+3]=255;
}
const input = { snapshot: { nom: 'DOSSIER DE TEST', prenoms: 'Vérification technique', societe: null, role: 'exploitant', site_nom: 'Site de test — Nom réel du site', commune: 'Commune de test', numero_affiliation: 'FS-TEST-000001' }, valid_from: null, valid_until: null, activated_at: null, verification_token: 'a0000000-0000-4000-8000-000000000001' };
const result = await generateAffiliationFiles(input, PNG.sync.write(portrait), 'image/png', 'https://verification.example.test');
for (const [face, bytes] of Object.entries(result)) {
 await Deno.writeFile(new URL(`${face}.${face==='pdf'?'pdf':'png'}`, output), bytes);
 if(face!=='pdf'&&face!=='portrait') { const image=PNG.sync.read(Buffer.from(bytes));assert.equal(image.width,1011);assert.equal(image.height,638); }
}
const verso=PNG.sync.read(Buffer.from(result.verso));const decoded=jsQR(new Uint8ClampedArray(verso.data),verso.width,verso.height);
assert.equal(decoded?.data,`https://verification.example.test/verifier-carte/${input.verification_token}`);
await assert.rejects(() => generateAffiliationFiles(input,PNG.sync.write(portrait),'image/png','http://localhost:5180'));
await assert.rejects(() => generateAffiliationFiles(input,PNG.sync.write(portrait),'image/png','https://127.0.0.1'));
await assert.rejects(() => generateAffiliationFiles(input,new Uint8Array(30),'image/png','https://verification.example.test'));
const long = await generateAffiliationFiles({ ...input, snapshot: { ...input.snapshot, nom: 'OUÉDRAOGO KABORÉ SAWADOGO DE TEST', prenoms: 'Éléonore Marie-Françoise de Test', societe: 'SOCIÉTÉ DE TEST POUR LE CONTRÔLE DU RENDU', role: 'aide_exploitant' } },PNG.sync.write(portrait),'image/png','https://verification.example.test');
await Deno.writeFile(new URL('recto-identite-longue.png',output),long.recto);
const active = await generateAffiliationFiles({ ...input, activated_at: '2026-09-06T12:00:00Z', issued_on: '2026-09-06', valid_from: '2026-09-06', valid_until: '2027-09-05', verification_token: 'b0000000-0000-4000-8000-000000000001' },PNG.sync.write(portrait),'image/png','https://verification.example.test');
await Deno.writeFile(new URL('recto-actif-test.png',output),active.recto);
await Deno.writeFile(new URL('verso-actif-test.png',output),active.verso);
console.log('Rendu réel validé : deux PNG 1011 × 638, PDF recto verso, QR décodé depuis le PNG final, refus de localhost.');
