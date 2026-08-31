import { supabase } from '@/lib/supabase';
import { tracabiliteVenteService, type Affectation } from './tracabiliteVenteService';
import type {
  AnalyseTeneurConciliation, CertificatConciliation, Conciliation, ContexteConciliation,
  DonneesCertificatConciliation, ExpeditionConciliation, LigneVenteConciliation,
  MouvementFiscalConciliation, PaiementConciliation, RaffinerieConciliation, ReceptionConciliation,
} from './conciliationService';

const CERTIFICAT = 'id, certificate_number, certificate_date, issuing_laboratory, sample_id, sample_weight_grams, fineness, purity_percent, gold_content_percent, file_name, file_path, file_size, mime_type, approval_status, approved_by, approved_at, shipping_preparation_id, created_at';
const ANALYSE = 'id, reference, numero_echantillon, teneur_declaree_pct, teneur_retenue_pct, masse_echantillon_g, masse_lot_oz, methode_echantillonnage, lieu_prelevement, date_prelevement, date_declaration, decision, statut, observations';

/** Une panne secondaire ne détruit pas les données accessibles des autres sections. */
export async function chargerContexteConciliation(dossier: Conciliation): Promise<ContexteConciliation> {
  const incidents: NonNullable<ContexteConciliation['incidents']> = [];
  async function lire<T>(section: string, requete: PromiseLike<{ data: unknown; error: unknown }>, vide: T): Promise<T> {
    try {
      const result = await requete;
      if (result.error) throw result.error;
      return (result.data ?? vide) as T;
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'NETWORK';
      incidents.push({ section, code, type: code === '42501' || code === 'PGRST301' ? 'acces' : 'technique' });
      return vide;
    }
  }
  const sp = dossier.sale?.shipping_preparation_id;
  const [lignes, expedition, certificats, analysesMine, paiement, origines, reception, fiscalite] = await Promise.all([
    lire<LigneVenteConciliation[]>('Lignes de vente', supabase.from('sales_line_items').select('id, line_number, metal_type, quantity_grams, quantity_oz, fine_weight_oz, fineness_percentage, unit_price, line_total').eq('sale_id', dossier.sale_id).order('line_number'), []),
    sp ? lire<ExpeditionConciliation | null>('Expédition', supabase.from('shipping_preparations').select('id, expedition_lot_number, refinery_id, shipped_to_company, shipped_to_country, total_gross_weight_grams, total_net_weight_grams, total_weight_oz, prepared_at, shipped_at, status').eq('id', sp).maybeSingle(), null) : null,
    sp ? lire<CertificatConciliation[]>('Certificats de raffinage', supabase.from('assay_certificates').select(CERTIFICAT).eq('shipping_preparation_id', sp).order('created_at', { ascending: false }), []) : [],
    sp ? lire<AnalyseTeneurConciliation[]>('Analyses Mine', supabase.from('snp_analyses_teneur').select(ANALYSE).eq('shipping_preparation_id', sp).order('date_declaration', { ascending: false }), []) : [] as AnalyseTeneurConciliation[],
    lire<PaiementConciliation | null>('Référence financière', supabase.from('payments').select('id, invoice_number, reference_number, amount, currency, status, created_at').eq('sale_id', dossier.sale_id).order('created_at', { ascending: false }).limit(1).maybeSingle(), null),
    lire<Affectation[]>('Origine des lots', tracabiliteVenteService.lotsDeVente(dossier.sale_id).then(data => ({ data, error: null })), []),
    sp ? lire<ReceptionConciliation | null>('Réception raffinerie', supabase.from('freight_shipments').select('received_at').eq('shipping_preparation_id', sp).is('deleted_at', null).order('shipment_date', { ascending: false }).limit(1).maybeSingle(), null) : null,
    lire<MouvementFiscalConciliation[]>('Écritures fiscales', supabase.from('snp_grand_livre_fiscal').select('id, code_taxe, sens, montant, devise, type_mouvement, statut_credit, conciliation_id, created_at').eq('sale_id', dossier.sale_id).order('created_at'), []),
  ]);
  const achatsMine = [...new Set(origines.filter(l => l.source_type === 'achat_mine').map(l => l.source_id))];
  if (achatsMine.length) {
    const rapportsOrigine = await lire<AnalyseTeneurConciliation[]>('Analyses des achats Mine', supabase.from('snp_analyses_teneur').select(ANALYSE).in('achat_id', achatsMine).order('date_declaration', { ascending: false }), []);
    const ids = new Set(analysesMine.map(a => a.id));
    analysesMine.push(...rapportsOrigine.filter(a => !ids.has(a.id)));
  }
  const [raffinerie, mesuresCertificats] = await Promise.all([
    expedition?.refinery_id ? lire<RaffinerieConciliation | null>('Raffinerie', supabase.from('refineries').select('id, name, country').eq('id', expedition.refinery_id).maybeSingle(), null) : null,
    sp && certificats.length ? lire<DonneesCertificatConciliation[]>('Mesures vérifiées', supabase.from('assay_certificate_data').select('certificate_id, total_weight_g, gold_purity_percentage, fineness, is_verified').eq('shipping_preparation_id', sp).in('certificate_id', certificats.map(c => c.id)).eq('is_verified', true).order('updated_at', { ascending: false }), []) : [],
  ]);
  // Ne jamais substituer silencieusement une autre preuve à celle enregistrée.
  const approuves = certificats.filter(c => c.approval_status === 'approved' && c.approved_at && c.approved_by);
  const certificat = dossier.assay_certificate_id
    ? certificats.find(c => c.id === dossier.assay_certificate_id) ?? null
    : approuves.length === 1 ? approuves[0] : null;
  const analyseTeneur = dossier.analyse_teneur_id ? analysesMine.find(a => a.id === dossier.analyse_teneur_id) ?? null : null;
  return {
    lignes, expedition, certificats, analysesMine, paiement, origines, reception, fiscalite,
    raffinerie, mesuresCertificats, certificat, analyseTeneur, incidents,
    donneesCertificat: mesuresCertificats.find(m => m.certificate_id === certificat?.id) ?? null,
  };
}
