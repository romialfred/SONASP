import { describe, expect, it } from 'vitest';
import type { Conciliation, ContexteConciliation } from '@/services/conciliationService';
import { blocageExpedition, calculerImpacts, fixingContractuel, mesureRaffinerie } from './conciliationImpact';
const dossier = { poids_initial_g: 1000, teneur_initiale_pct: 90, or_fin_initial_g: 900, prix_initial: 2000, ca_initial: 57871.34, devise_initiale: 'USD', sale: { quantity_oz: 28.9, sale_date: '2026-08-01', final_price_per_oz: 2100 } } as Conciliation;
const contexte = { lignes: [], certificat: null, donneesCertificat: null, expedition: null } as unknown as ContexteConciliation;
describe('impacts de conciliation', () => {
  it('ne confond pas l’or fin avec le poids du lot ou de l’échantillon', () => {
    expect(mesureRaffinerie({ ...contexte, certificat: { sample_weight_grams: 25, fineness: 999 } as never })).toEqual({ poids: null, teneur: 99.9 });
  });
  it('normalise les deux conventions historiques de finesse', () => {
    expect(mesureRaffinerie({ ...contexte, certificat: { fineness: 99.9 } as never }).teneur).toBe(99.9);
  });
  it('calcule la masse fine une fois et la teneur en points', () => {
    const r = calculerImpacts(dossier, contexte, { poids: '990', teneur: '89,5', prix: '2100' });
    expect(r.find(l => l.code === 'or_fin')?.final).toBe(886.05);
    expect(r.find(l => l.code === 'teneur')?.ecart).toBe(-0.5);
    expect(r.find(l => l.code === 'ca_ht')?.final).toBe(59823.05);
  });
  it('garde les inconnues distinctes de zéro', () => {
    expect(calculerImpacts(dossier, contexte, { poids: '', teneur: '90', prix: '2000' }).find(l => l.code === 'ca_ht')?.final).toBeNull();
  });
  it('ne soustrait jamais des devises différentes', () => {
    expect(calculerImpacts({ ...dossier, devise_finale: 'XOF' }, contexte, { poids: '900', teneur: '90', prix: '2000' }).find(l => l.code === 'ca_ht')?.ecart).toBeNull();
  });
  it('privilégie le fixing de vente et non la date du certificat', () => {
    expect(fixingContractuel(dossier)).toEqual({ prix: 2100, date: '2026-08-01' });
  });
  it('refuse une préparation non expédiée même pour Owner', () => {
    expect(blocageExpedition({ ...contexte, expedition: { refinery_id: 'ref', shipped_at: null } as never })).toMatch(/encore en préparation/);
  });
  it('accepte plusieurs expéditions physiques complètes', () => {
    expect(blocageExpedition({ ...contexte, expeditions: [
      { refinery_id: 'ref', shipped_at: '2026-08-01' },
      { refinery_id: 'ref', shipped_at: '2026-08-02' },
    ] as never })).toBeNull();
  });
  it('réserve l’absence d’expédition à la vente locale directe', () => {
    expect(blocageExpedition({ ...contexte, modeFlux: 'vente_locale_directe' })).toBeNull();
    expect(blocageExpedition({ ...contexte, modeFlux: 'non_rattachee' })).toMatch(/Flux export incomplet/);
  });
});
