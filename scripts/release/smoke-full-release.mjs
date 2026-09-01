// No login, account creation, email, upload or financial mutation.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
const [mode, folder, expectedBuildId] = process.argv.slice(2);
if (!['services','frontend'].includes(mode)||!folder) throw new Error('mode and audit folder required');
const results=[];
const origin='https://sonasp.data-univers.com';
if (mode==='services') {
  const services=['create-user','delete-user','get-users','get-user-details','manage-user-status','reset-user-password','revoke-user-sessions','envoyer-courriel','sensitive-upload','activate-account','public-assistance','fetch-daily-fx-rates','fetch-daily-lbma-prices','scheduled-tasks'];
  for (const slug of services) {
    const response=await fetch('https://yyverzuhkdonjjuficor.supabase.co/functions/v1/'+slug,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
    await response.arrayBuffer();
    assert.ok([400,401,403,405,422].includes(response.status),slug+' failed closed with unexpected status '+response.status);
    results.push({service:slug,test:'no-session-no-payload',status:response.status});
  }
  for (const slug of ['create-user','get-users','sensitive-upload','activate-account','public-assistance']) {
    const response=await fetch('https://yyverzuhkdonjjuficor.supabase.co/functions/v1/'+slug,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(30000)});
    assert.ok([200,204].includes(response.status));
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
    results.push({service:slug,test:'allowed-preflight',status:response.status});
    const denied=await fetch('https://yyverzuhkdonjjuficor.supabase.co/functions/v1/'+slug,{method:'OPTIONS',headers:{Origin:'https://forbidden-release-probe.invalid','Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(30000)});
    assert.equal(denied.status,403);
    results.push({service:slug,test:'forbidden-preflight',status:denied.status});
  }
} else {
  const versionResponse=await fetch(origin+'/build-version.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});
  assert.equal(versionResponse.status,200);
  const version=await versionResponse.json();
  assert.ok(expectedBuildId,'expected build id required for frontend smoke');
  assert.equal(version.buildId,expectedBuildId);
  results.push({test:'public-build',...version});
  const assets=new Set();
  for(const route of ['/','/login','/users/new','/national-reserve/allocations','/sales','/payments','/assistance']) {
    const response=await fetch(origin+route,{cache:'no-store',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,route);
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('x-frame-options'),'DENY');
    const html=await response.text();
    assert.match(html,/<div id="root">/);
    for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)) assets.add(match[1]);
    results.push({test:'route-shell',route,status:response.status});
  }
  for(const asset of assets) {
    const response=await fetch(origin+asset,{signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,asset);
    assert.doesNotMatch(response.headers.get('content-type')||'',/text\/html/);
    await response.arrayBuffer();
    results.push({test:'entry-asset',asset,status:response.status});
  }
  const worker=await fetch(origin+'/sw.js',{signal:AbortSignal.timeout(30000)});
  assert.equal(worker.status,200);
  assert.doesNotMatch(worker.headers.get('content-type')||'',/text\/html/);
  results.push({test:'service-worker',status:worker.status});
}
writeFileSync(path.join(folder,mode+'-smoke.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));
console.log(JSON.stringify({mode,passed:results.length,results}));
