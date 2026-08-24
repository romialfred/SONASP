import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  compareCatalogue,
  compareRemoteHistory,
  createCatalogue,
  inventoryMigrations,
  parseMigrationFilename,
  serializeCatalogue,
  strictFindingsCount,
} from '../../scripts/check-migration-integrity.mjs';

async function fixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sonasp-migrations-'));
  const migrations = path.join(root, 'supabase', 'migrations');
  await mkdir(migrations, { recursive: true });
  for (const [filename, body] of Object.entries(files)) {
    await writeFile(path.join(migrations, filename), body, 'utf8');
  }
  return root;
}

test('reconnaît un timestamp UTC et un nom canoniques', () => {
  const parsed = parseMigrationFilename('20260824235959_exemple_canonique.sql');
  assert.equal(parsed.canonical, true);
  assert.equal(parsed.version, '20260824235959');
});

test('détecte préfixe court, absence de préfixe et timestamp impossible', () => {
  assert.equal(
    parseMigrationFilename('20260824_001_legacy.sql').prefixProblem,
    'prefix_must_have_14_digits',
  );
  assert.equal(
    parseMigrationFilename('migration_sans_version.sql').prefixProblem,
    'missing_numeric_prefix',
  );
  assert.equal(
    parseMigrationFilename('20260824235960_seconde_invalide.sql').prefixProblem,
    'invalid_utc_timestamp',
  );
});

test('l’inventaire détecte doublon, ordre ambigu et largeurs mixtes', async (context) => {
  const root = await fixture({
    '20260824_001_legacy.sql': 'select 1;\n',
    '20260824_002_legacy.sql': 'select 2;\n',
    '20260824235959_ok.sql': 'select 3;\n',
  });
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'supabase', 'migrations', '20260826000000_not_a_file.sql'));
  const inventory = await inventoryMigrations({ root });
  assert.equal(inventory.findings.duplicateVersions.length, 1);
  assert.equal(inventory.findings.ambiguousOrder.length, 1);
  assert.deepEqual(inventory.findings.versionWidths, [
    { digits: 8, count: 2 },
    { digits: 14, count: 1 },
  ]);
  assert.deepEqual(inventory.findings.unsupportedSqlEntries, [
    'supabase/migrations/20260826000000_not_a_file.sql',
  ]);
  assert.ok(strictFindingsCount(inventory.findings) > 0);
});

test('le catalogue est déterministe et accepte un état inchangé', async (context) => {
  const root = await fixture({
    '20260824235959_a.sql': 'select 1;\n',
    '20260825000000_b.sql': 'select 2;\n',
  });
  context.after(() => rm(root, { recursive: true, force: true }));
  const inventory = await inventoryMigrations({ root });
  const first = createCatalogue(inventory);
  const second = createCatalogue(inventory);
  assert.equal(serializeCatalogue(first), serializeCatalogue(second));
  assert.equal(compareCatalogue(first, inventory).ok, true);
});

test('un octet modifié produit une divergence de checksum', async (context) => {
  const root = await fixture({ '20260824235959_a.sql': 'select 1;\n' });
  context.after(() => rm(root, { recursive: true, force: true }));
  const baseline = createCatalogue(await inventoryMigrations({ root }));
  await writeFile(
    path.join(root, 'supabase', 'migrations', '20260824235959_a.sql'),
    'select 2;\n',
    'utf8',
  );
  const comparison = compareCatalogue(baseline, await inventoryMigrations({ root }));
  assert.equal(comparison.ok, false);
  assert.equal(comparison.changedFiles.length, 1);
});

test('les fins de ligne LF et CRLF ont le même checksum canonique', async (context) => {
  const root = await fixture({ '20260824235959_a.sql': 'select 1;\nselect 2;\n' });
  context.after(() => rm(root, { recursive: true, force: true }));
  const baseline = createCatalogue(await inventoryMigrations({ root }));
  await writeFile(
    path.join(root, 'supabase', 'migrations', '20260824235959_a.sql'),
    'select 1;\r\nselect 2;\r\n',
    'utf8',
  );
  assert.equal(compareCatalogue(baseline, await inventoryMigrations({ root })).ok, true);
});

test('ajout et suppression de migration sont bloqués avant revue de baseline', async (context) => {
  const root = await fixture({ '20260824235959_a.sql': 'select 1;\n' });
  context.after(() => rm(root, { recursive: true, force: true }));
  const baseline = createCatalogue(await inventoryMigrations({ root }));
  await writeFile(
    path.join(root, 'supabase', 'migrations', '20260825000000_b.sql'),
    'select 2;\n',
    'utf8',
  );
  let comparison = compareCatalogue(baseline, await inventoryMigrations({ root }));
  assert.deepEqual(comparison.unexpectedFiles, ['supabase/migrations/20260825000000_b.sql']);
  await rm(path.join(root, 'supabase', 'migrations', '20260824235959_a.sql'));
  comparison = compareCatalogue(baseline, await inventoryMigrations({ root }));
  assert.deepEqual(comparison.missingFiles, ['supabase/migrations/20260824235959_a.sql']);
});

test('une modification manuelle du catalogue invalide son digest', async (context) => {
  const root = await fixture({ '20260824235959_a.sql': 'select 1;\n' });
  context.after(() => rm(root, { recursive: true, force: true }));
  const inventory = await inventoryMigrations({ root });
  const catalogue = createCatalogue(inventory);
  catalogue.files[0].normalizedBytes += 1;
  const comparison = compareCatalogue(catalogue, inventory);
  assert.match(comparison.catalogueErrors[0], /catalogueSha256/);
});

test('le rapprochement distant détecte versions et checksums divergents', async (context) => {
  const root = await fixture({
    '20260824235959_a.sql': 'select 1;\n',
    '20260825000000_b.sql': 'select 2;\n',
  });
  context.after(() => rm(root, { recursive: true, force: true }));
  const inventory = await inventoryMigrations({ root });
  const localChecksum = inventory.files[0].sha256;
  const comparison = compareRemoteHistory(inventory, {
    versions: [
      { version: '20260824235959', sha256: localChecksum.replace(/^./, localChecksum[0] === '0' ? '1' : '0') },
      '20260826000000',
    ],
  });
  assert.equal(comparison.ok, false);
  assert.deepEqual(comparison.localOnly, ['20260825000000']);
  assert.deepEqual(comparison.remoteOnly, ['20260826000000']);
  assert.equal(comparison.checksumMismatches.length, 1);
});

test('la sérialisation produite est du JSON relisible', async (context) => {
  const root = await fixture({ '20260824235959_a.sql': 'select 1;\n' });
  context.after(() => rm(root, { recursive: true, force: true }));
  const serialized = serializeCatalogue(createCatalogue(await inventoryMigrations({ root })));
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.files.length, 1);
  assert.equal((await readFile(path.join(root, 'supabase/migrations/20260824235959_a.sql'), 'utf8')), 'select 1;\n');
});
