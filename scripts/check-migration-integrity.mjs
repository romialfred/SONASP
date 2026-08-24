#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const DEFAULT_MIGRATION_DIRECTORY = 'supabase/migrations';
const DEFAULT_CATALOGUE = 'supabase/migrations.catalogue.json';
const CATALOGUE_FORMAT_VERSION = 1;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CANONICAL_DESCRIPTION_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function compareBytes(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeSqlLineEndings(bytes) {
  const normalized = Buffer.allocUnsafe(bytes.length);
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < bytes.length; readIndex += 1) {
    if (bytes[readIndex] === 13) {
      if (bytes[readIndex + 1] === 10) readIndex += 1;
      normalized[writeIndex] = 10;
    } else {
      normalized[writeIndex] = bytes[readIndex];
    }
    writeIndex += 1;
  }
  return normalized.subarray(0, writeIndex);
}

function relativePortable(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function isValidTimestampPrefix(prefix) {
  if (!/^\d{14}$/.test(prefix)) return false;
  const year = Number(prefix.slice(0, 4));
  const month = Number(prefix.slice(4, 6));
  const day = Number(prefix.slice(6, 8));
  const hour = Number(prefix.slice(8, 10));
  const minute = Number(prefix.slice(10, 12));
  const second = Number(prefix.slice(12, 14));
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second;
}

export function parseMigrationFilename(filename) {
  const match = /^(\d+)_(.+)\.sql$/.exec(filename);
  if (!match) {
    return {
      filename,
      version: null,
      description: null,
      canonical: false,
      prefixProblem: 'missing_numeric_prefix',
      nameProblem: null,
    };
  }

  const [, version, description] = match;
  let prefixProblem = null;
  if (version.length !== 14) prefixProblem = 'prefix_must_have_14_digits';
  else if (!isValidTimestampPrefix(version)) prefixProblem = 'invalid_utc_timestamp';

  const nameProblem = CANONICAL_DESCRIPTION_PATTERN.test(description)
    ? null
    : 'description_must_be_lower_snake_case';

  return {
    filename,
    version,
    description,
    canonical: prefixProblem === null && nameProblem === null,
    prefixProblem,
    nameProblem,
  };
}

function structuralFindings(entries, unsupportedSqlEntries = []) {
  const byVersion = new Map();
  const versionWidths = new Map();
  const unversionedFiles = [];
  const nonCanonicalPrefixes = [];
  const nonCanonicalNames = [];

  for (const entry of entries) {
    if (entry.version === null) {
      unversionedFiles.push(entry.path);
      continue;
    }

    const grouped = byVersion.get(entry.version) ?? [];
    grouped.push(entry.path);
    byVersion.set(entry.version, grouped);
    versionWidths.set(entry.version.length, (versionWidths.get(entry.version.length) ?? 0) + 1);

    if (entry.prefixProblem) {
      nonCanonicalPrefixes.push({
        path: entry.path,
        prefix: entry.version,
        reason: entry.prefixProblem,
      });
    }
    if (entry.nameProblem) {
      nonCanonicalNames.push({ path: entry.path, reason: entry.nameProblem });
    }
  }

  const duplicateVersions = [...byVersion.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => ({ version, files: files.sort(compareBytes) }))
    .sort((left, right) => compareBytes(left.version, right.version));

  return {
    duplicateVersions,
    unversionedFiles: unversionedFiles.sort(compareBytes),
    nonCanonicalPrefixes: nonCanonicalPrefixes.sort((left, right) => compareBytes(left.path, right.path)),
    nonCanonicalNames: nonCanonicalNames.sort((left, right) => compareBytes(left.path, right.path)),
    ambiguousOrder: duplicateVersions.map(({ version, files }) => ({
      reason: 'same_version_prefix',
      version,
      files,
    })),
    versionWidths: [...versionWidths.entries()]
      .map(([digits, count]) => ({ digits, count }))
      .sort((left, right) => left.digits - right.digits),
    unsupportedSqlEntries: [...unsupportedSqlEntries].sort(compareBytes),
  };
}

export async function inventoryMigrations({
  root = DEFAULT_ROOT,
  migrationDirectory = DEFAULT_MIGRATION_DIRECTORY,
} = {}) {
  const absoluteDirectory = path.resolve(root, migrationDirectory);
  const directoryEntries = await readdir(absoluteDirectory, { withFileTypes: true });
  const filenames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => entry.name)
    .sort(compareBytes);
  const unsupportedSqlEntries = directoryEntries
    .filter((entry) => !entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => relativePortable(root, path.join(absoluteDirectory, entry.name)));

  const files = [];
  for (const filename of filenames) {
    const absolutePath = path.join(absoluteDirectory, filename);
    const bytes = await readFile(absolutePath);
    const normalizedBytes = normalizeSqlLineEndings(bytes);
    const parsed = parseMigrationFilename(filename);
    files.push({
      path: relativePortable(root, absolutePath),
      version: parsed.version,
      description: parsed.description,
      canonical: parsed.canonical,
      prefixProblem: parsed.prefixProblem,
      nameProblem: parsed.nameProblem,
      normalizedBytes: normalizedBytes.length,
      sha256: sha256(normalizedBytes),
    });
  }

  return {
    migrationDirectory: relativePortable(root, absoluteDirectory),
    files,
    findings: structuralFindings(files, unsupportedSqlEntries),
  };
}

function cataloguePayload(inventory) {
  return {
    formatVersion: CATALOGUE_FORMAT_VERSION,
    checksumAlgorithm: 'sha256',
    checksumCanonicalization: 'SQL bytes with CRLF and CR normalized to LF; no other transformation',
    migrationDirectory: inventory.migrationDirectory,
    policy: {
      canonicalPrefix: 'YYYYMMDDHHMMSS as a valid UTC timestamp',
      canonicalFilename: '^\\d{14}_[a-z0-9]+(?:_[a-z0-9]+)*\\.sql$',
      ordering: 'bytewise filename order; every version prefix must be unique',
    },
    files: inventory.files,
    knownStructuralDebt: inventory.findings,
  };
}

export function createCatalogue(inventory) {
  const payload = cataloguePayload(inventory);
  return {
    ...payload,
    catalogueSha256: sha256(JSON.stringify(payload)),
  };
}

export function serializeCatalogue(catalogue) {
  return `${JSON.stringify(catalogue, null, 2)}\n`;
}

function validateCatalogueShape(catalogue) {
  const errors = [];
  if (catalogue?.formatVersion !== CATALOGUE_FORMAT_VERSION) {
    errors.push(`formatVersion attendu: ${CATALOGUE_FORMAT_VERSION}`);
  }
  if (catalogue?.checksumAlgorithm !== 'sha256') errors.push('checksumAlgorithm doit être sha256');
  if (!Array.isArray(catalogue?.files)) errors.push('files doit être un tableau');
  if (!catalogue?.knownStructuralDebt) errors.push('knownStructuralDebt est absent');
  if (!SHA256_PATTERN.test(catalogue?.catalogueSha256 ?? '')) {
    errors.push('catalogueSha256 absent ou invalide');
  }

  if (errors.length === 0) {
    const { catalogueSha256, ...payload } = catalogue;
    const expected = sha256(JSON.stringify(payload));
    if (catalogueSha256 !== expected) errors.push('catalogueSha256 ne correspond pas au contenu');
  }
  return errors;
}

function byPath(files) {
  return new Map(files.map((file) => [file.path, file]));
}

export function compareCatalogue(catalogue, inventory) {
  const catalogueErrors = validateCatalogueShape(catalogue);
  if (catalogueErrors.length > 0) {
    return {
      ok: false,
      catalogueErrors,
      missingFiles: [],
      unexpectedFiles: [],
      changedFiles: [],
      structuralDrift: true,
    };
  }

  const expected = byPath(catalogue.files);
  const actual = byPath(inventory.files);
  const missingFiles = [...expected.keys()].filter((entry) => !actual.has(entry)).sort(compareBytes);
  const unexpectedFiles = [...actual.keys()].filter((entry) => !expected.has(entry)).sort(compareBytes);
  const changedFiles = [];

  for (const [entryPath, expectedEntry] of expected) {
    const actualEntry = actual.get(entryPath);
    if (!actualEntry) continue;
    if (actualEntry.sha256 !== expectedEntry.sha256
      || actualEntry.normalizedBytes !== expectedEntry.normalizedBytes) {
      changedFiles.push({
        path: entryPath,
        expectedSha256: expectedEntry.sha256,
        actualSha256: actualEntry.sha256,
        expectedNormalizedBytes: expectedEntry.normalizedBytes,
        actualNormalizedBytes: actualEntry.normalizedBytes,
      });
    }
  }
  changedFiles.sort((left, right) => compareBytes(left.path, right.path));

  const structuralDrift = JSON.stringify(catalogue.knownStructuralDebt)
    !== JSON.stringify(inventory.findings);
  return {
    ok: catalogueErrors.length === 0
      && missingFiles.length === 0
      && unexpectedFiles.length === 0
      && changedFiles.length === 0
      && !structuralDrift,
    catalogueErrors,
    missingFiles,
    unexpectedFiles,
    changedFiles,
    structuralDrift,
  };
}

export function strictFindingsCount(findings) {
  return findings.duplicateVersions.length
    + findings.unversionedFiles.length
    + findings.nonCanonicalPrefixes.length
    + findings.nonCanonicalNames.length
    + findings.unsupportedSqlEntries.length
    + (findings.versionWidths.length > 1 ? 1 : 0);
}

function normalizeRemoteEntries(remoteHistory) {
  if (!Array.isArray(remoteHistory?.versions)) {
    throw new Error('Le manifeste distant doit contenir un tableau versions.');
  }
  return remoteHistory.versions.map((entry) => {
    if (typeof entry === 'string') return { version: entry, sha256: null };
    if (!entry || typeof entry.version !== 'string') {
      throw new Error('Chaque version distante doit être une chaîne ou un objet {version, sha256?}.');
    }
    if (entry.sha256 != null && !SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`Checksum distant invalide pour ${entry.version}.`);
    }
    return { version: entry.version, sha256: entry.sha256 ?? null };
  });
}

export function compareRemoteHistory(inventory, remoteHistory) {
  const remoteEntries = normalizeRemoteEntries(remoteHistory);
  const localByVersion = new Map();
  for (const file of inventory.files) {
    if (file.version === null) continue;
    const files = localByVersion.get(file.version) ?? [];
    files.push(file);
    localByVersion.set(file.version, files);
  }
  const remoteByVersion = new Map();
  for (const entry of remoteEntries) {
    const entries = remoteByVersion.get(entry.version) ?? [];
    entries.push(entry);
    remoteByVersion.set(entry.version, entries);
  }

  const localVersions = [...localByVersion.keys()].sort(compareBytes);
  const remoteVersions = [...remoteByVersion.keys()].sort(compareBytes);
  const localOnly = localVersions.filter((version) => !remoteByVersion.has(version));
  const remoteOnly = remoteVersions.filter((version) => !localByVersion.has(version));
  const common = localVersions.filter((version) => remoteByVersion.has(version));
  const ambiguousLocalVersions = [...localByVersion.entries()]
    .filter(([, files]) => files.length !== 1)
    .map(([version]) => version)
    .sort(compareBytes);
  const duplicateRemoteVersions = [...remoteByVersion.entries()]
    .filter(([, entries]) => entries.length !== 1)
    .map(([version]) => version)
    .sort(compareBytes);
  const checksumMismatches = [];

  for (const version of common) {
    const localFiles = localByVersion.get(version);
    const remote = remoteByVersion.get(version);
    if (localFiles.length !== 1 || remote.length !== 1 || remote[0].sha256 === null) continue;
    if (localFiles[0].sha256 !== remote[0].sha256) {
      checksumMismatches.push({
        version,
        localSha256: localFiles[0].sha256,
        remoteSha256: remote[0].sha256,
      });
    }
  }

  return {
    ok: localOnly.length === 0
      && remoteOnly.length === 0
      && ambiguousLocalVersions.length === 0
      && duplicateRemoteVersions.length === 0
      && checksumMismatches.length === 0,
    localVersionCount: localVersions.length,
    remoteVersionCount: remoteVersions.length,
    common,
    localOnly,
    remoteOnly,
    ambiguousLocalVersions,
    duplicateRemoteVersions,
    checksumMismatches,
  };
}

function parseArguments(argv) {
  const [command = 'verify', ...rest] = argv;
  const options = {
    command,
    root: DEFAULT_ROOT,
    catalogue: DEFAULT_CATALOGUE,
    migrationDirectory: DEFAULT_MIGRATION_DIRECTORY,
    output: null,
    remoteHistory: null,
    json: false,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--root') options.root = path.resolve(rest[++index]);
    else if (argument === '--catalogue') options.catalogue = rest[++index];
    else if (argument === '--migrations') options.migrationDirectory = rest[++index];
    else if (argument === '--output') options.output = rest[++index];
    else if (argument === '--remote-history') options.remoteHistory = rest[++index];
    else throw new Error(`Argument inconnu: ${argument}`);
  }
  return options;
}

function findingSummary(inventory) {
  return {
    files: inventory.files.length,
    uniqueVersions: new Set(inventory.files.map((file) => file.version).filter(Boolean)).size,
    canonicalFiles: inventory.files.filter((file) => file.canonical).length,
    duplicateVersionGroups: inventory.findings.duplicateVersions.length,
    unversionedFiles: inventory.findings.unversionedFiles.length,
    nonCanonicalPrefixes: inventory.findings.nonCanonicalPrefixes.length,
    nonCanonicalNames: inventory.findings.nonCanonicalNames.length,
    unsupportedSqlEntries: inventory.findings.unsupportedSqlEntries.length,
    versionWidths: inventory.findings.versionWidths,
  };
}

function printHuman(result) {
  const prefix = result.ok ? '[OK]' : '[ECHEC]';
  console.log(`${prefix} ${result.message}`);
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.details) console.log(JSON.stringify(result.details, null, 2));
}

async function fileExists(filename) {
  try {
    await access(filename, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function assertPathInsideRoot(root, target) {
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Chemin de sortie hors dépôt refusé: ${target}`);
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const inventory = await inventoryMigrations({
    root: options.root,
    migrationDirectory: options.migrationDirectory,
  });
  const summary = findingSummary(inventory);

  if (options.command === 'snapshot') {
    const catalogue = createCatalogue(inventory);
    if (!options.output) {
      process.stdout.write(serializeCatalogue(catalogue));
      return 0;
    }
    const absoluteOutput = path.resolve(options.root, options.output);
    assertPathInsideRoot(options.root, absoluteOutput);
    if (await fileExists(absoluteOutput)) {
      throw new Error(`Refus d'écraser un catalogue existant: ${relativePortable(options.root, absoluteOutput)}`);
    }
    await writeFile(absoluteOutput, serializeCatalogue(catalogue), { encoding: 'utf8', flag: 'wx' });
    printHuman({
      ok: true,
      message: `candidat de baseline créé: ${relativePortable(options.root, absoluteOutput)}`,
      summary,
      details: { catalogueSha256: catalogue.catalogueSha256 },
    });
    return 0;
  }

  if (options.command === 'audit') {
    const count = strictFindingsCount(inventory.findings);
    const result = {
      ok: count === 0,
      message: count === 0
        ? 'chaîne de migrations strictement canonique'
        : `${count} constats structurels; aucune correction automatique effectuée`,
      summary,
      details: inventory.findings,
    };
    if (options.json) console.log(JSON.stringify(result));
    else printHuman(result);
    return result.ok ? 0 : 1;
  }

  if (options.command !== 'verify') throw new Error(`Commande inconnue: ${options.command}`);
  const absoluteCatalogue = path.resolve(options.root, options.catalogue);
  const catalogue = JSON.parse(await readFile(absoluteCatalogue, 'utf8'));
  const comparison = compareCatalogue(catalogue, inventory);
  let remoteComparison = null;
  if (options.remoteHistory) {
    const remote = JSON.parse(await readFile(path.resolve(options.root, options.remoteHistory), 'utf8'));
    remoteComparison = compareRemoteHistory(inventory, remote);
  }
  const ok = comparison.ok && (remoteComparison?.ok ?? true);
  const result = {
    ok,
    message: ok
      ? 'catalogue/checksums conformes; dette historique inchangée'
      : 'divergence de migrations détectée; aucune migration appliquée ou renommée',
    summary,
    details: {
      catalogue: comparison,
      ...(remoteComparison ? { remoteHistory: remoteComparison } : {}),
    },
  };
  if (options.json) console.log(JSON.stringify(result));
  else printHuman(result);
  return ok ? 0 : 1;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`[ERREUR] ${error.message}`);
    process.exitCode = 2;
  });
}
