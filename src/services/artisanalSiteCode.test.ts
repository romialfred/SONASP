import { describe, expect, it } from 'vitest';
import { DEMO_ARTISANAL_SITES } from '@/test/fixtures/artisanalSites';
import type { ArtisanalSite } from '@/types/artisanalSite';
import { generateSiteCode, nextSiteSequence, regionTrigram } from './artisanalSiteCode';

const site = (code: string) => ({ code } as ArtisanalSite);

describe('artisanalSiteCode', () => {
  it('réduit la région à un trigramme sans accent ni séparateur', () => {
    expect(regionTrigram('Boucle du Mouhoun')).toBe('BOU');
    expect(regionTrigram('Centre-Nord')).toBe('CEN');
    expect(regionTrigram('Hauts-Bassins')).toBe('HAU');
    expect(regionTrigram('Est')).toBe('EST');
    expect(regionTrigram('')).toBe('XXX');
  });

  it('reprend le compteur au maximum des codes déjà attribués', () => {
    expect(nextSiteSequence([])).toBe(1);
    expect(nextSiteSequence(DEMO_ARTISANAL_SITES)).toBe(7);
    expect(nextSiteSequence([site('SA-NOR-2026-0003'), site('SA-SAH-2025-0042')])).toBe(43);
  });

  it('ignore les codes hors format', () => {
    expect(nextSiteSequence([site('SA-2026-001'), site('libre'), site('')])).toBe(1);
  });

  it('compose le code SA-XXX-AAAA-NNNN', () => {
    expect(generateSiteCode('Sahel', DEMO_ARTISANAL_SITES, 2026)).toBe('SA-SAH-2026-0007');
    expect(generateSiteCode('Centre-Ouest', [], 2027)).toBe('SA-CEN-2027-0001');
    expect(generateSiteCode('Nord', [], 2026, 128)).toBe('SA-NOR-2026-0128');
  });

  it('produit un code valide même sans région sélectionnée', () => {
    expect(generateSiteCode('', [], 2026)).toBe('SA-XXX-2026-0001');
  });
});
