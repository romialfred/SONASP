import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = path.resolve('docs/amelioration/environnement/reprise-r04');
const [filename, label] = process.argv.slice(2);
assert.match(filename ?? '', /^[a-z0-9_-]+\.sql$/);
assert.match(label ?? '', /^[a-z0-9_-]+$/);
assert.equal(fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim(), 'yyverzuhkdonjjuficor');
const file = path.join(base, filename);
const sql = fs.readFileSync(file, 'utf8');
assert.match(sql, /^\s*(?:--[^\n]*\n)*BEGIN(?: TRANSACTION)?(?: ISOLATION LEVEL REPEATABLE READ)? READ ONLY;/i);
assert.match(sql.trim(), /ROLLBACK;$/i);
const cli = 'C:/Users/romia/AppData/Local/npm-cache/_npx/66b4952730d9cac8/node_modules/@supabase/cli-windows-x64/bin/supabase.exe';
assert.ok(fs.existsSync(cli));
const target = path.join(base, label);
assert.ok(!fs.existsSync(`${target}.json`), 'Conserver chaque tentative : nouveau label requis');
const lock = path.join(base, '.sql-read.lock');
const fd = fs.openSync(lock, 'wx');
const receipt = { projectRef: 'yyverzuhkdonjjuficor', startedAt: new Date().toISOString(), readOnly: true, command: `supabase 2.115.0 db query --linked --file ${filename} -o json`, sqlSha256: crypto.createHash('sha256').update(sql).digest('hex') };
let failed = false;
try {
  const raw = execFileSync(cli, ['db', 'query', '--linked', '--file', file, '-o', 'json'], { encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const result = JSON.parse(raw.slice(raw.indexOf('{')));
  fs.writeFileSync(`${target}.json`, JSON.stringify(result, null, 2) + '\n');
  receipt.exitCode = 0;
} catch (error) {
  failed = true;
  receipt.exitCode = typeof error.status === 'number' ? error.status : null;
  // Diagnostics bounded and scrubbed; never persist raw credentials or payloads.
  receipt.error = String(error.stderr || error.message)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[connexion expurgée]')
    .replace(/Bearer\s+\S+|sbp_[A-Za-z0-9]+|eyJ[A-Za-z0-9_.-]+/g, '[secret expurgé]').slice(0, 1800);
} finally {
  receipt.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${target}.execution.json`, JSON.stringify(receipt, null, 2) + '\n');
  fs.closeSync(fd); fs.unlinkSync(lock);
}
console.log(JSON.stringify({ label, exitCode: receipt.exitCode, evidence: `${target}.json` }));
if (failed) process.exitCode = 1;
