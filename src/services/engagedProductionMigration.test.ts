import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(
  'supabase/migrations/20260901210000_figer_productions_engagees.sql',
), 'utf8');

describe('migration de gel des productions engagées', () => {
  it('couvre les attributs physiques et identitaires', () => {
    for (const column of [
      'production_date', 'mining_company_id', 'site_id', 'bar_reference',
      'bullion_grams', 'estimated_fineness_pct', 'estimated_gold_pct',
      'estimated_silver_pct', 'pure_gold_grams', 'estimated_oz',
      'silver_content_grams',
    ]) {
      expect(sql).toContain(column);
    }
  });

  it('ne considère que les achats encore actifs', () => {
    expect(sql).toContain('JOIN public.snp_achats_mines');
    expect(sql).toContain("purchase.statut <> 'annulee'");
  });

  it('installe une garde serveur non exposée au navigateur', () => {
    expect(sql).toContain('BEFORE UPDATE OF');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path TO 'pg_catalog', 'public', 'pg_temp'");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  });

  it('sérialise le cumul des allocations sur la production', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.snp_verifier_achat_production()');
    expect(sql).toMatch(/FROM public\.daily_production[\s\S]*FOR UPDATE/);
    expect(sql).toContain("v_achat.statut = 'annulee'");
  });
});
