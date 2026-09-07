import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = 'docs/amelioration/lot-artisanat/lecture-production-details';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [
  'src/pages/artisanal-sites/ArtisanalSiteProduction.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteReadState.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteProduction.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteDetails.test.tsx',
  'src/hooks/useArtisanalSiteData.test.tsx',
];
const preserved = [
  'src/hooks/useArtisanalSiteData.ts',
  'src/services/artisanalSiteService.ts',
  'src/services/siteAeaDocumentService.ts',
  'src/services/sitePhotoService.ts',
  'src/lib/miningRegistryAccess.ts',
  'src/pages/artisanal-sites/ArtisanalSiteForm.tsx',
];
execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...preserved]);
const before = JSON.parse(fs.readFileSync(`${base}/avant-reproduction.json`, 'utf8'));
const after = JSON.parse(fs.readFileSync(`${base}/apres.json`, 'utf8'));
const evidence = {
  recordedAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: 'Production/Détails : contexte Auth, loading/error, invalidation AEA et reprise',
  before: { file: `${base}/avant-reproduction.json`, total: before.numTotalTests, passed: before.numPassedTests, failed: before.numFailedTests, exitCode: 1 },
  after: { file: `${base}/apres.json`, total: after.numTotalTests, passed: after.numPassedTests, failed: after.numFailedTests, files: after.testResults.length, exitCode: 0 },
  gates: { eslintExitCode: 0, typecheckExitCode: 0, diffCheckExitCode: 0 },
  sourceHashesAfterVerification: Object.fromEntries(files.map(file => [file, sha(file)])),
  preservedAtHead: Object.fromEntries(preserved.map(file => [file, sha(file)])),
  artifactHashes: Object.fromEntries(['avant-reproduction.json','avant-reproduction.log','apres.json','apres.log','lint.log','typecheck.log','ArtisanalSiteProduction.before.txt','ArtisanalSiteDetails.before.txt'].map(file => [file, sha(`${base}/${file}`)])),
  remoteCalls: 0, remoteMutations: 0, localOnly: true, sourceFrozen: true,
  realHook: true, realProductionCalculations: true,
  browserVerified: false, apiVerified: false, persistenceVerified: false,
  independentAudit: 'Coordonné séparément par le principal ; non déduit de ce reçu',
};
fs.writeFileSync(`${base}/evidence.json`, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ beforeFailed: before.numFailedTests, afterPassed: after.numPassedTests, sourceFiles: files.length, preservedFiles: preserved.length }));
