import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/pages/inventory/reserve-allocations.css'), 'utf8');

const ruleBody = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  expect(match, `La règle CSS ${selector} doit exister`).not.toBeNull();
  return match?.[1] ?? '';
};

describe('Reserve allocation form layout', () => {
  it('confine les actions dans la colonne principale et espace le résumé', () => {
    const layout = ruleBody('.reserve-form-layout');
    const main = ruleBody('.reserve-form-main');
    const navigation = ruleBody('.reserve-form-nav');

    expect(layout).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(310px,\s*330px\)/);
    expect(layout).toMatch(/gap:\s*18px/);
    expect(main).toMatch(/min-width:\s*0/);
    expect(main).toMatch(/overflow:\s*hidden/);
    expect(navigation).toMatch(/width:\s*100%/);
    expect(navigation).toMatch(/max-width:\s*100%/);
    expect(navigation).toMatch(/box-sizing:\s*border-box/);
  });
});
