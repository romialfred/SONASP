import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const base = 'docs/amelioration/preuves/lecture-sites-ui';
const buffer = file => fs.readFileSync(path.join(root, base, file));
const text = file => buffer(file).toString('utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(text('manifest.json').replace(/^\uFEFF/, ''));
const expected = ['02-overview-erreur.jpg', '03-overview-attente.jpg', '06-production-attente.jpg', '07-production-erreur.jpg', '09-detail-erreur.jpg', '11-overview-non-evalue.jpg', '12-overview-mobile-erreur.jpg', '13-production-mobile-erreur.jpg', '14-detail-mobile-erreur.jpg'];
function dimensions(bytes) {
  if (bytes.readUInt16BE(0) !== 0xffd8) throw new Error('Capture non JPEG');
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Marqueur JPEG attendu');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5), actualFormat: 'JPEG' };
    }
    offset += length;
  }
  throw new Error('Dimensions JPEG absentes');
}
const comparisons = manifest.files.map(file => {
  const bytes = buffer(file.name);
  return { file: `${base}/${file.name}`, expectedSha256: file.sha256, actualSha256: sha(bytes), bytesMatch: bytes.length === file.bytes, hashMatches: sha(bytes) === file.sha256 };
});
const main = file => text(file).split('- main:')[1]?.split('- contentinfo:')[0] || '';
const domChecks = {
  formerZeroPreservedIn04: text('04-overview-vide.txt').includes('img "Indice de conformité 0 sur 100"'),
  correctedUnassessed11: text('11-overview-non-evalue.txt').includes('strong: Non évalué') && !text('11-overview-non-evalue.txt').includes('img "Indice de conformité 0 sur 100"'),
  productionRetry07: main('07-production-erreur.txt').includes('button "Réessayer"'),
  detailError09: main('09-detail-erreur.txt').includes('momentanément indisponibles') && !main('09-detail-erreur.txt').includes('Modifier la fiche') && !main('09-detail-erreur.txt').includes('img "Photo'),
  detailRecovered10: main('10-detail-repris.txt').includes('link "Modifier la fiche"') && main('10-detail-repris.txt').includes('img "Photo 1') && main('10-detail-repris.txt').includes('img "Photo 2'),
  mobileRetries: ['12-overview-mobile-erreur.txt', '13-production-mobile-erreur.txt', '14-detail-mobile-erreur.txt'].every(file => main(file).includes('button "Réessayer"')),
};
const evidence = {
  id: 'AUD-LECTURES-SITES-PIXELS-20260907', checkedAt: new Date().toISOString(),
  mode: 'Relecture indépendante de fichiers existants : neuf images vues directement, DOM et manifeste contrôlés sans navigateur, tests ou réseau.',
  manifestSha256: sha(buffer('manifest.json')), comparisons,
  captures: expected.map(file => ({ file: `${base}/${file}`, sha256: sha(buffer(file)), ...dimensions(buffer(file)), fullPage: false, visuallyInspected: true })),
  domChecks,
  allManifestEntriesMatch: comparisons.every(row => row.bytesMatch && row.hashMatches),
  findings: [
    '07 : panneau du banc superposé au bouton de reprise ; pixels seuls insuffisants pour sa visibilité desktop.',
    '11 : viewport défilé sur le bloc de conformité, sans preuve de page entière.',
    'Mesures scrollWidth annoncées par le pilote non exportées dans les fichiers DOM examinés ; absence de débordement seulement observée visuellement ici.',
    '10 : reprise et deux éléments image présents dans le DOM ; pas de capture de ce stade dans ce répertoire.',
  ],
  realAuthVerified: false, storageVerified: false, persistenceVerified: false, fullPageVerified: false,
};
const out = path.join(root, 'docs/amelioration/audit/lecture-sites-ui-independent.evidence.json');
fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ manifestEntries: comparisons.length, allManifestEntriesMatch: evidence.allManifestEntriesMatch, captures: evidence.captures.length, dimensions: evidence.captures.map(({ file, width, height }) => ({ file, width, height })), domChecks }));
if (!evidence.allManifestEntriesMatch || !Object.values(domChecks).every(Boolean)) process.exitCode = 1;
