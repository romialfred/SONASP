import { describe, expect, it } from 'vitest';
import { DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS } from '@/data/artisanalSitesData';
import { calculateSiteMetrics, summarizeSiteProduction } from './artisanalSiteService';

describe('artisanalSiteService analytics', () => {
  it('calculates the national indicators from sites and productions', () => {
    const metrics = calculateSiteMetrics(DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS);

    expect(metrics.siteCount).toBe(6);
    expect(metrics.activeSiteCount).toBe(4);
    expect(metrics.activeMinerCount).toBe(659);
    expect(metrics.productionKilograms).toBe(121);
    expect(metrics.taxesFcfa).toBe(162_522_000);
  });

  it('ranks sites by recorded production', () => {
    const summaries = summarizeSiteProduction(DEMO_ARTISANAL_SITES, DEMO_SITE_PRODUCTIONS);

    expect(summaries[0].siteName).toContain('Poura');
    expect(summaries[0].productionKilograms).toBeCloseTo(50.6, 1);
    expect(summaries[summaries.length - 1]?.productionKilograms).toBe(0);
  });
});
