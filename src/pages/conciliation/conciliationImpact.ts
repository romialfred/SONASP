import type { Conciliation, ContexteConciliation } from '@/services/conciliationService';

export const ONCE_TROY_G = 31.1034768;
const arrondi = (value: number, digits = 4) => Number(value.toFixed(digits));
const valeur = (value: unknown): number | null => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

/** La masse d'un échantillon et les onces d'or fin ne sont jamais un poids brut. */
export function mesureRaffinerie(contexte: ContexteConciliation) {
  const c = contexte.certificat;
  const d = contexte.donneesCertificat;
  const finesse = valeur(c?.fineness ?? d?.fineness);
  return {
    poids: valeur(d?.total_weight_g),
    teneur: valeur(c?.purity_percent ?? c?.gold_content_percent ?? d?.gold_purity_percentage)
      ?? (finesse === null ? null : finesse > 100 ? finesse / 10 : finesse),
  };
}

export function fixingContractuel(dossier: Conciliation) {
  const sale = dossier.sale;
  return {
    prix: dossier.prix_final ?? sale?.final_price_per_oz ?? dossier.prix_initial ?? sale?.london_am_rate ?? null,
    date: (dossier.date_fixing || sale?.spot_value_date || sale?.forward_value_date || sale?.spot_pricing_date || sale?.sale_date || '').slice(0, 10),
  };
}

export interface LigneImpact { code: string; label: string; unite: string; initial: number | null; final: number | null; ecart: number | null }
export function calculerImpacts(dossier: Conciliation, contexte: ContexteConciliation, saisie: { poids: string; teneur: string; prix: string }): LigneImpact[] {
  const p = valeur(saisie.poids.replace(',', '.'));
  const t = valeur(saisie.teneur.replace(',', '.'));
  const prix = valeur(saisie.prix.replace(',', '.'));
  const poids = p !== null && p > 0 ? p : null;
  const teneur = t !== null && t > 0 && t <= 100 ? t : null;
  const fin = poids !== null && teneur !== null ? arrondi(poids * teneur / 100) : null;
  const ca = fin !== null && prix !== null && prix > 0 ? arrondi(fin / ONCE_TROY_G * prix, 2) : null;
  const mine = contexte.analysesMine?.length === 1 ? contexte.analysesMine[0] : null;
  const poidsInitial = dossier.poids_initial_g ?? contexte.expedition?.total_net_weight_grams ?? null;
  const teneurInitiale = dossier.teneur_initiale_pct ?? mine?.teneur_declaree_pct ?? null;
  const devise = dossier.devise_initiale || dossier.sale?.currency || '';
  const comparable = !dossier.devise_finale || dossier.devise_finale === devise;
  return [
    { code: 'poids', label: 'Poids du métal (hors emballage)', unite: 'g', initial: poidsInitial, final: poids },
    { code: 'teneur', label: 'Teneur en or', unite: '%', initial: teneurInitiale, final: teneur },
    { code: 'or_fin', label: 'Quantité d’or fin', unite: 'g', initial: dossier.or_fin_initial_g, final: fin },
    { code: 'prix', label: 'Prix contractuel par once', unite: `${devise}/oz`, initial: dossier.prix_initial, final: prix },
    { code: 'ca_ht', label: 'Valeur commerciale brute', unite: devise, initial: dossier.ca_initial, final: ca },
  ].map(l => ({ ...l, ecart: l.initial != null && l.final != null && (comparable || !['prix', 'ca_ht'].includes(l.code)) ? arrondi(l.final - l.initial) : null }));
}

export function blocageExpedition(contexte: ContexteConciliation): string | null {
  if (contexte.modeFlux === 'vente_locale_directe') return null;
  const expeditions = contexte.expeditions?.length
    ? contexte.expeditions
    : contexte.expedition ? [contexte.expedition] : [];
  if (expeditions.length === 0) {
    return 'Flux export incomplet : aucune expédition physique vérifiable n’est rattachée à cette vente.';
  }
  if (expeditions.some((expedition) => !expedition.refinery_id)) {
    return 'La destination raffinerie doit être renseignée sur chaque expédition rattachée.';
  }
  if (expeditions.some((expedition) => !expedition.shipped_at)) {
    return 'Au moins un lot est encore en préparation. La conciliation s’ouvre lorsque toutes les expéditions sont parties vers la raffinerie.';
  }
  return null;
}
