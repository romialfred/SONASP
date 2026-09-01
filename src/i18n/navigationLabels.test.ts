import { describe, it, expect } from 'vitest';
import { ENGLISH_NAVIGATION_LABELS, navigationLabel } from './navigationLabels';
import { NAVIGATION_SECTIONS, COMPTOIR_NAVIGATION_SECTIONS, COLLECTOR_NAVIGATION_SECTIONS, DGMG_NAVIGATION_SECTIONS, DGI_NAVIGATION_SECTIONS, SONASP_COMPTOIR_NAVIGATION_SECTION } from '@/components/layout/sidebarNavigation';

describe('English navigation', () => {
  it('covers the published navigation across every portal', () => {
    const sections = [...NAVIGATION_SECTIONS, ...COMPTOIR_NAVIGATION_SECTIONS, ...COLLECTOR_NAVIGATION_SECTIONS, ...DGMG_NAVIGATION_SECTIONS, ...DGI_NAVIGATION_SECTIONS, SONASP_COMPTOIR_NAVIGATION_SECTION];
    const labels = sections.flatMap(section => [section.title, ...section.groups.flatMap(group => [group.label, ...(group.children || []).map(item => item.label)])]);
    const missing = [...new Set(labels)].filter(label => !ENGLISH_NAVIGATION_LABELS[label.replace(/[’‘]/g, "'").toLocaleLowerCase('fr')]);
    expect(missing).toEqual([]);
  });
  it('does not translate business references, custom company names or a French preference', () => {
    expect(navigationLabel('SL-2026-012')).toBe('SL-2026-012');
    expect(navigationLabel('Mine A')).toBe('Mine A');
    expect(navigationLabel('Expéditions', 'fr')).toBe('Expéditions');
    expect(navigationLabel('Expéditions', 'en')).toBe('Shipments');
  });
});
