import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  resolve(process.cwd(), 'src/components/layout/national-dashboard-layout.css'),
  'utf8',
);

const ruleBody = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  expect(match, `La règle CSS ${selector} doit exister`).not.toBeNull();
  return match?.[1] ?? '';
};

describe('National dashboard layout overflow', () => {
  it('confine le défilement des pages avant le footer', () => {
    const body = ruleBody('.national-shell__body');
    const content = ruleBody('.national-shell__content');

    expect(body).toMatch(/min-height:\s*0\s*;/);
    expect(body).toMatch(/overflow:\s*hidden\s*;/);
    expect(content).toMatch(/min-height:\s*0\s*;/);
    expect(content).toMatch(/overflow:\s*auto\s*;/);
  });
});
