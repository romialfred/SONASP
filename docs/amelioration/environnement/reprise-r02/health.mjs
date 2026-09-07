import fs from 'node:fs';
import dns from 'node:dns/promises';
import assert from 'node:assert/strict';
const target = 'yyverzuhkdonjjuficor';
assert.equal(fs.readFileSync('supabase/.temp/project-ref','utf8').trim(),target);
const env = fs.readFileSync('.env','utf8');
const key = env.match(/^VITE_SUPABASE_ANON_KEY\s*=\s*["']?([^\r\n"']+)/m)?.[1];
assert.ok(key, 'Clé publique existante introuvable ; aucune configuration modifiée');
const report = { checkedAt: new Date().toISOString(), projectRef: target, credentialsExposed: false, dns: [], http: [] };
try { report.dns = await dns.resolve4(`${target}.supabase.co`); } catch(error) { report.dnsError = error.code; }
for (const path of ['/auth/v1/health','/rest/v1/']) {
  try {
    const response = await fetch(`https://${target}.supabase.co${path}`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
    report.http.push({ path, method: 'GET', status: response.status });
    await response.body?.cancel();
  } catch (error) { report.http.push({ path, method: 'GET', error: error.cause?.code ?? error.name }); }
}
fs.writeFileSync('docs/amelioration/environnement/reprise-r02/health.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
