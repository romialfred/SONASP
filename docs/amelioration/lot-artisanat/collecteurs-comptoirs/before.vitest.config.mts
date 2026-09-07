// Read-only replay of the pre-correction source. Application files stay intact.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '../../../../vitest.config';

const directory=path.dirname(fileURLToPath(import.meta.url));
const originals = new Map([
  ['/src/pages/collector/CollectorsPage.tsx','CollectorsPage.before.txt'],
  ['/src/pages/collector/ComptoirsPage.tsx','ComptoirsPage.before.txt'],
  ['/src/services/collectorService.ts','collectorService.before.txt'],
]);
export default {
  ...base,
  plugins:[{
    name:'audit-pre-correction-source', enforce:'pre' as const,
    load(id:string) {
      const normalized=id.replaceAll('\\','/').split('?')[0];
      const match=[...originals].find(([suffix])=>normalized.endsWith(suffix));
      if (match) return fs.readFileSync(path.join(directory,match[1]),'utf8');
    },
  }, ...(base.plugins??[])],
};
