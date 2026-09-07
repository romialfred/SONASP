import fs from 'node:fs';
import assert from 'node:assert/strict';
const [beforeFile,afterFile,outputFile,manifestFile] = process.argv.slice(2);
assert.ok(beforeFile && afterFile && outputFile);
const load = file => JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const before = load(beforeFile).rows[0].baseline;
const after = load(afterFile).rows[0].baseline;
assert.equal(before.run_prefix,'QA20260907-R04');
assert.equal(after.run_prefix,before.run_prefix);
const manifest = manifestFile ? load(manifestFile) : { runPrefix:before.run_prefix,entities:{},storageObjects:[] };
assert.equal(manifest.runPrefix,before.run_prefix);
const missing = [], changed = [], added = [], unknownAdded = [];
for (const table of before.tables) {
  const current = after.tables.find(row => row.table_name === table.table_name);
  assert.ok(current, `Table absente du relevé après : ${table.table_name}`);
  const currentRows = new Map(current.rows.map(row => [row.id,row.md5]));
  const oldIds = new Set(table.rows.map(row => row.id));
  for (const row of table.rows) {
    if (!currentRows.has(row.id)) missing.push({table:table.table_name,id:row.id});
    else if (currentRows.get(row.id) !== row.md5) changed.push({table:table.table_name,id:row.id});
  }
  for (const row of current.rows) if (!oldIds.has(row.id)) {
    const item = {table:table.table_name,id:row.id}; added.push(item);
    if (!(manifest.entities[table.table_name] ?? []).includes(row.id)) unknownAdded.push(item);
  }
}
const objects = new Map(after.storage.objects.map(row => [row.id,row]));
const oldObjectIds = new Set(before.storage.objects.map(row => row.id));
for (const row of before.storage.objects) {
  const current = objects.get(row.id);
  if (!current) missing.push({table:'storage.objects',id:row.id});
  else if (current.metadata_md5 !== row.metadata_md5 || current.path_md5 !== row.path_md5) changed.push({table:'storage.objects',id:row.id});
}
for (const row of after.storage.objects) if (!oldObjectIds.has(row.id)) {
  const item = {table:'storage.objects',id:row.id}; added.push(item);
  if (!(manifest.storageObjects ?? []).includes(row.id)) unknownAdded.push(item);
}
const report = { comparedAt:new Date().toISOString(),beforeFile,afterFile,manifestFile:manifestFile ?? null,
  preexistingPreserved:missing.length===0 && changed.length===0, newRowsFullyAttributed:unknownAdded.length===0,
  missing,changed,added,unknownAdded };
assert.ok(!fs.existsSync(outputFile),'Ne pas écraser une preuve');
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({preexistingPreserved:report.preexistingPreserved,newRowsFullyAttributed:report.newRowsFullyAttributed,missing:missing.length,changed:changed.length,added:added.length}));
if (!report.preexistingPreserved || !report.newRowsFullyAttributed) process.exitCode=1;
