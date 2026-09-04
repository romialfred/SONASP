import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOT = join(ROOT, 'src');

// Ces formulations ont déjà été remplacées dans l’interface institutionnelle.
// Le contrôle empêche leur réintroduction dans un composant React visible.
const FORBIDDEN_UI_TEXTS = [
  'Gold Price',
  'No data available',
  'No recent activity',
  'No notifications',
  'Mark all as read',
  'Refresh now',
  'Production Trends',
  'Daily Production (Ounces)',
  'Mining Companies',
  'Manage mining company information and track their activities',
  'Add Mining Company',
  'Search companies...',
  'Loading companies...',
  'No mining companies found',
  'Manage your account settings and preferences',
  'Update your personal information',
  'Update your password regularly for security',
  'Manage your notification preferences',
  'Recent account activity',
  'Still need help?',
  'Contact Support',
  'View System Logs',
  'FX Rates Management',
  'Track and manage exchange rates from multiple sources',
  'Loading rates...',
  'No daily rates found',
  'No monthly rates found',
  'No customer rates found',
  'Showing {',
];

async function collectReactSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectReactSources(path);
    if (!entry.name.endsWith('.tsx') || /\.(?:test|spec)\.tsx$/.test(entry.name)) return [];
    return [path];
  }));
  return nested.flat();
}

const violations = [];
for (const path of await collectReactSources(SOURCE_ROOT)) {
  const source = await readFile(path, 'utf8');
  const lines = source.split(/\r?\n/);
  for (const text of FORBIDDEN_UI_TEXTS) {
    lines.forEach((line, index) => {
      if (line.includes(text)) {
        violations.push(`${relative(ROOT, path)}:${index + 1} — « ${text} »`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Des libellés anglais interdits subsistent dans l’interface française :');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log('Contrôle de l’interface française : aucun libellé interdit détecté.');
}
