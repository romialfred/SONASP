import { supabase } from '@/lib/supabase';
import { tracabiliteVenteService, type Affectation } from './tracabiliteVenteService';
import type {
  AnalyseTeneurConciliation, CertificatConciliation, Conciliation, ContexteConciliation,
  DonneesCertificatConciliation, ExpeditionConciliation, LigneVenteConciliation,
  ModeFluxConciliation, MouvementFiscalConciliation, PaiementConciliation,
  RaffinerieConciliation, ReceptionConciliation, ResultatRaffinageConciliation,
} from './conciliationService';

const CERTIFICAT = 'id, certificate_number, certificate_date, issuing_laboratory, sample_id, sample_weight_grams, fineness, purity_percent, gold_content_percent, file_name, file_path, file_size, mime_type, approval_status, approved_by, approved_at, shipping_preparation_id, created_at';
const ANALYSE = 'id, reference, numero_echantillon, teneur_declaree_pct, teneur_retenue_pct, masse_echantillon_g, masse_lot_oz, methode_echantillonnage, lieu_prelevement, date_prelevement, date_declaration, decision, statut, observations';

interface LigneLogistiqueConciliation {
  shipping_preparation_id: string;
  expedition_lot_number: string | null;
  prepared_at: string | null;
  shipped_at: string | null;
  preparation_status: string;
  refinery_id: string | null;
  refinery_name: string | null;
  refinery_country: string | null;
  shipped_to_company: string | null;
  shipped_to_country: string | null;
  total_gross_weight_grams: number | null;
  total_net_weight_grams: number | null;
  total_weight_oz: number | null;
  link_source: 'direct' | 'physical_backing';
  freight_shipment_id: string | null;
  freight_reference: string | null;
  freight_status: string | null;
  received_at: string | null;
  inventory_id: string | null;
  allocated_quantity_oz: number | null;
  certificate_number: string | null;
  refining_record_id: string | null;
  pre_melting_weight_grams: number | null;
  post_melting_weight_grams: number | null;
  fineness_percentage: number | null;
  metal_retained_percentage: number | null;
  final_fine_grams: number | null;
  final_fine_ounces: number | null;
  processed_at: string | null;
  refining_approved_at: string | null;
}

const nombre = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normaliserLogistiqueConciliation(
  rawRows: unknown,
  venteLocaleDirecte = false,
): {
  expeditions: ExpeditionConciliation[];
  resultatsRaffinage: ResultatRaffinageConciliation[];
  raffinerie: RaffinerieConciliation | null;
  reception: ReceptionConciliation | null;
  modeFlux: ModeFluxConciliation;
  poidsExpedieG: number | null;
  orFinRaffineAlloueG: number | null;
} {
  const rows = Array.isArray(rawRows)
    ? rawRows.filter((row): row is LigneLogistiqueConciliation => Boolean(
      row && typeof row === 'object' && typeof (row as LigneLogistiqueConciliation).shipping_preparation_id === 'string',
    ))
    : [];
  const expeditionsParId = new Map<string, ExpeditionConciliation>();
  for (const row of rows) {
    const existante = expeditionsParId.get(row.shipping_preparation_id);
    const alloue = nombre(row.allocated_quantity_oz);
    if (existante) {
      if (alloue !== null) existante.allocated_quantity_oz = (existante.allocated_quantity_oz ?? 0) + alloue;
      continue;
    }
    expeditionsParId.set(row.shipping_preparation_id, {
      id: row.shipping_preparation_id,
      expedition_lot_number: row.expedition_lot_number,
      refinery_id: row.refinery_id,
      shipped_to_company: row.shipped_to_company,
      shipped_to_country: row.shipped_to_country,
      total_gross_weight_grams: nombre(row.total_gross_weight_grams),
      total_net_weight_grams: nombre(row.total_net_weight_grams),
      total_weight_oz: nombre(row.total_weight_oz),
      prepared_at: row.prepared_at,
      shipped_at: row.shipped_at,
      status: row.preparation_status,
      source_lien: row.link_source,
      freight_shipment_id: row.freight_shipment_id,
      freight_reference: row.freight_reference,
      freight_status: row.freight_status,
      received_at: row.received_at,
      allocated_quantity_oz: alloue,
    });
  }
  const expeditions = [...expeditionsParId.values()];
  const resultatsRaffinage = rows.flatMap((row): ResultatRaffinageConciliation[] => row.inventory_id ? [{
    shipping_preparation_id: row.shipping_preparation_id,
    freight_shipment_id: row.freight_shipment_id,
    inventory_id: row.inventory_id,
    certificate_number: row.certificate_number,
    refining_record_id: row.refining_record_id,
    allocated_quantity_oz: nombre(row.allocated_quantity_oz),
    pre_melting_weight_grams: nombre(row.pre_melting_weight_grams),
    post_melting_weight_grams: nombre(row.post_melting_weight_grams),
    fineness_percentage: nombre(row.fineness_percentage),
    metal_retained_percentage: nombre(row.metal_retained_percentage),
    final_fine_grams: nombre(row.final_fine_grams),
    final_fine_ounces: nombre(row.final_fine_ounces),
    processed_at: row.processed_at,
    approved_at: row.refining_approved_at,
  }] : []);
  const premiereRaffinerie = rows.find((row) => row.refinery_id && row.refinery_name);
  const receptions = expeditions.map((expedition) => expedition.received_at).filter((date): date is string => Boolean(date));
  const poidsAlloue = resultatsRaffinage.reduce((total, resultat) => {
    const finOz = resultat.allocated_quantity_oz;
    const purete = resultat.fineness_percentage;
    return finOz !== null && purete !== null && purete > 0
      ? total + finOz * 31.1034768 / (purete / 100)
      : total;
  }, 0);
  const poidsExpeditions = expeditions.reduce((total, expedition) => total + (expedition.total_net_weight_grams ?? 0), 0);
  const orFinAlloue = resultatsRaffinage.reduce(
    (total, resultat) => total + (resultat.allocated_quantity_oz ?? 0) * 31.1034768,
    0,
  );
  const adossementPhysique = expeditions.some((expedition) => expedition.source_lien === 'physical_backing');
  return {
    expeditions,
    resultatsRaffinage,
    raffinerie: premiereRaffinerie ? {
      id: premiereRaffinerie.refinery_id as string,
      name: premiereRaffinerie.refinery_name as string,
      country: premiereRaffinerie.refinery_country,
    } : null,
    reception: receptions.length ? { received_at: receptions.sort().at(-1) ?? null } : null,
    modeFlux: venteLocaleDirecte
      ? 'vente_locale_directe'
      : expeditions.length === 0
        ? 'non_rattachee'
        : adossementPhysique ? 'adossement_physique' : 'expedition_directe',
    poidsExpedieG: poidsAlloue > 0 ? poidsAlloue : poidsExpeditions > 0 ? poidsExpeditions : null,
    orFinRaffineAlloueG: orFinAlloue > 0 ? orFinAlloue : null,
  };
}

/** Une panne secondaire ne détruit pas les données accessibles des autres sections. */
export async function chargerContexteConciliation(dossier: Conciliation): Promise<ContexteConciliation> {
  const incidents: NonNullable<ContexteConciliation['incidents']> = [];
  async function lire<T>(section: string, creerRequete: () => PromiseLike<{ data: unknown; error: unknown }>, vide: T): Promise<T> {
    try {
      const result = await creerRequete();
      if (result.error) throw result.error;
      return (result.data ?? vide) as T;
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'NETWORK';
      incidents.push({ section, code, type: code === '42501' || code === 'PGRST301' ? 'acces' : 'technique' });
      return vide;
    }
  }
  const sp = dossier.sale?.shipping_preparation_id;
  const [lignes, lignesLogistiques, paiement, origines, fiscalite] = await Promise.all([
    lire<LigneVenteConciliation[]>('Lignes de vente', () => supabase.from('sales_line_items').select('id, line_number, metal_type, quantity_grams, quantity_oz, fine_weight_oz, fineness_percentage, unit_price, line_total').eq('sale_id', dossier.sale_id).order('line_number'), []),
    lire<LigneLogistiqueConciliation[]>('Chaîne logistique', () => supabase.rpc('snp_conciliation_expeditions_vente', { p_sale_id: dossier.sale_id }), []),
    lire<PaiementConciliation | null>('Référence financière', () => supabase.from('payments').select('id, invoice_number, reference_number, amount, currency, status, created_at').eq('sale_id', dossier.sale_id).order('created_at', { ascending: false }).limit(1).maybeSingle(), null),
    lire<Affectation[]>('Origine des lots', () => tracabiliteVenteService.lotsDeVente(dossier.sale_id).then(data => ({ data, error: null })), []),
    lire<MouvementFiscalConciliation[]>('Écritures fiscales', () => supabase.from('snp_grand_livre_fiscal').select('id, code_taxe, sens, montant, devise, type_mouvement, statut_credit, conciliation_id, created_at').eq('sale_id', dossier.sale_id).order('created_at'), []),
  ]);
  let logistique = normaliserLogistiqueConciliation(lignesLogistiques, Boolean(dossier.sale?.is_internal_sale));
  // Compatibility while the migration is rolling out: a valid legacy direct
  // link remains visible, but is never guessed from the sale number.
  if (logistique.expeditions.length === 0 && sp) {
    const expeditionDirecte = await lire<ExpeditionConciliation | null>('Expédition directe', () => supabase.from('shipping_preparations').select('id, expedition_lot_number, refinery_id, shipped_to_company, shipped_to_country, total_gross_weight_grams, total_net_weight_grams, total_weight_oz, prepared_at, shipped_at, status').eq('id', sp).maybeSingle(), null);
    if (expeditionDirecte) {
      logistique = {
        ...logistique,
        expeditions: [{ ...expeditionDirecte, source_lien: 'direct' }],
        modeFlux: 'expedition_directe',
        poidsExpedieG: expeditionDirecte.total_net_weight_grams,
      };
    }
  }
  const expeditionIds = [...new Set(logistique.expeditions.map((expedition) => expedition.id))];
  const [certificats, analysesMine] = expeditionIds.length ? await Promise.all([
    lire<CertificatConciliation[]>('Certificats de raffinage', () => supabase.from('assay_certificates').select(CERTIFICAT).in('shipping_preparation_id', expeditionIds).order('created_at', { ascending: false }), []),
    lire<AnalyseTeneurConciliation[]>('Analyses Mine', () => supabase.from('snp_analyses_teneur').select(ANALYSE).in('shipping_preparation_id', expeditionIds).order('date_declaration', { ascending: false }), []),
  ]) : [[], []] as [CertificatConciliation[], AnalyseTeneurConciliation[]];
  const achatsMine = [...new Set(origines.filter(l => l.source_type === 'achat_mine').map(l => l.source_id))];
  if (achatsMine.length) {
    const rapportsOrigine = await lire<AnalyseTeneurConciliation[]>('Analyses des achats Mine', () => supabase.from('snp_analyses_teneur').select(ANALYSE).in('achat_id', achatsMine).order('date_declaration', { ascending: false }), []);
    const ids = new Set(analysesMine.map(a => a.id));
    analysesMine.push(...rapportsOrigine.filter(a => !ids.has(a.id)));
  }
  const mesuresCertificats = certificats.length ? await lire<DonneesCertificatConciliation[]>('Mesures vérifiées', () => supabase.from('assay_certificate_data').select('certificate_id, total_weight_g, gold_purity_percentage, fineness, is_verified').in('shipping_preparation_id', expeditionIds).in('certificate_id', certificats.map(c => c.id)).eq('is_verified', true).order('updated_at', { ascending: false }), []) : [];
  // Ne jamais substituer silencieusement une autre preuve à celle enregistrée.
  const approuves = certificats.filter(c => c.approval_status === 'approved' && c.approved_at && c.approved_by);
  const certificat = dossier.assay_certificate_id
    ? certificats.find(c => c.id === dossier.assay_certificate_id) ?? null
    : approuves.length === 1 ? approuves[0] : null;
  const analyseTeneur = dossier.analyse_teneur_id ? analysesMine.find(a => a.id === dossier.analyse_teneur_id) ?? null : null;
  return {
    lignes, expedition: logistique.expeditions[0] ?? null, expeditions: logistique.expeditions,
    certificats, analysesMine, paiement, origines, reception: logistique.reception, fiscalite,
    raffinerie: logistique.raffinerie, resultatsRaffinage: logistique.resultatsRaffinage,
    modeFlux: logistique.modeFlux, poidsExpedieG: logistique.poidsExpedieG,
    orFinRaffineAlloueG: logistique.orFinRaffineAlloueG,
    mesuresCertificats, certificat, analyseTeneur, incidents,
    donneesCertificat: mesuresCertificats.find(m => m.certificate_id === certificat?.id) ?? null,
  };
}
