import { supabase } from '@/lib/supabase';
import { GRAMMES_PAR_ONCE, type StatutAchat } from './achatMineService';
import {
  STATUTS_ACHAT_MINE_ACQUIS,
  STATUTS_ARTISAN_ACQUIS,
  STATUTS_CESSION_ACQUISES,
} from './stockSonaspService';

/**
 * Traçabilité d'une vente à l'export : de quels achats provient l'or vendu.
 *
 * Le stock exportable de la SONASP se vérifiait en masse — total acheté moins
 * total vendu — mais rien ne disait de quelle mine ou de quel artisan venait
 * l'or d'une expédition. Chaque vente est donc décomposée en fractions de lots
 * d'achat, au plus ancien d'abord : l'or entré le premier sort le premier, ce
 * qui limite l'immobilisation et rend la composition reproductible.
 */

const TABLE = 'snp_ventes_lots';

export type SourceLot = 'achat_mine' | 'achat_artisan' | 'cession_comptoir';

export interface Lot {
  source_type: SourceLot;
  /** Identifiant de l'achat d'origine. */
  source_id: string;
  /** Référence lisible : numéro d'achat ou de reçu. */
  reference: string;
  /** Vendeur d'origine : société minière ou artisan. */
  origine: string;
  date: string;
  /** Onces entrées par cet achat. */
  quantiteOz: number;
  /** Onces déjà affectées à des ventes. */
  affecteeOz: number;
  /** Reste mobilisable. */
  disponibleOz: number;
}

export interface Affectation {
  source_type: SourceLot;
  source_id: string;
  reference: string;
  origine: string;
  quantite_oz: number;
}

export interface Composition {
  affectations: Affectation[];
  /** Onces que les lots disponibles ne couvrent pas. */
  resteOz: number;
  couverte: boolean;
}

const arrondi = (valeur: number) => Math.round(valeur * 10000) / 10000;

/** `snp_artisans_miniers` porte le nom et les prénoms séparément. */
export const nomArtisan = (artisan?: { nom?: string | null; prenoms?: string | null } | null): string =>
  [artisan?.prenoms, artisan?.nom].filter(Boolean).join(' ').trim();

/**
 * Répartit une quantité vendue sur les lots disponibles, du plus ancien au plus
 * récent. Un reste non couvert est rendu tel quel : il se signale, il ne se
 * comble pas avec de l'or qui n'existe pas.
 */
export function composer(lots: Lot[], quantiteOz: number): Composition {
  const demande = Math.max(0, Number(quantiteOz) || 0);
  const ordonnes = [...lots]
    .filter((lot) => lot.disponibleOz > 1e-6)
    .sort((a, b) => (a.date === b.date ? a.reference.localeCompare(b.reference) : a.date.localeCompare(b.date)));

  const affectations: Affectation[] = [];
  let reste = demande;

  for (const lot of ordonnes) {
    if (reste <= 1e-6) break;
    const prise = Math.min(lot.disponibleOz, reste);
    affectations.push({
      source_type: lot.source_type,
      source_id: lot.source_id,
      reference: lot.reference,
      origine: lot.origine,
      quantite_oz: arrondi(prise),
    });
    reste = arrondi(reste - prise);
  }

  return { affectations, resteOz: Math.max(0, reste), couverte: demande > 0 && reste <= 1e-6 };
}

/** Contrôles bloquants avant écriture. */
export function validerComposition(composition: Composition, quantiteOz: number): string | null {
  if (!(quantiteOz > 0)) return 'La quantité vendue doit être supérieure à zéro.';
  if (!composition.couverte) {
    return `Le stock acheté ne couvre pas la vente : ${composition.resteOz.toFixed(3)} oz sans origine.`;
  }
  const total = composition.affectations.reduce((somme, part) => somme + part.quantite_oz, 0);
  if (Math.abs(total - quantiteOz) > 0.001) {
    return `La composition (${total.toFixed(3)} oz) ne correspond pas à la quantité vendue (${quantiteOz.toFixed(3)} oz).`;
  }
  return null;
}

/** Construit les lots à partir des trois sources, déjà diminués de ce qui est affecté. */
export function construireLots(
  achatsMines: Array<{
    id: string;
    numero_achat: string | null;
    date_achat: string;
    quantite_oz: number | null;
    statut: StatutAchat;
    mining_company?: { name?: string | null } | null;
  }>,
  achatsArtisans: Array<{
    id: string;
    numero_recu?: string | null;
    date_vente: string;
    quantite_grammes: number | null;
    statut: string | null;
    artisan?: { nom?: string | null; prenoms?: string | null } | null;
  }>,
  affectations: Array<{
    source_type: SourceLot;
    achat_mine_id: string | null;
    artisan_vente_id: string | null;
    comptoir_cession_id?: string | null;
    quantite_oz: number | null;
  }>,
  reserveNationaleOz = 0,
  cessionsComptoirs: Array<{
    id: string;
    reference_vente: string;
    date_vente: string;
    quantity_grams: number | null;
    status: string | null;
    comptoir?: { name?: string | null } | null;
  }> = [],
): Lot[] {
  const dejaAffecte = new Map<string, number>();
  affectations.forEach((part) => {
    const cle = part.achat_mine_id || part.artisan_vente_id || part.comptoir_cession_id;
    if (!cle) return;
    dejaAffecte.set(cle, (dejaAffecte.get(cle) || 0) + Number(part.quantite_oz || 0));
  });

  const lots: Lot[] = [];

  achatsMines
    .filter((achat) => STATUTS_ACHAT_MINE_ACQUIS.includes(achat.statut))
    .forEach((achat) => {
      const quantiteOz = Number(achat.quantite_oz || 0);
      const affecteeOz = dejaAffecte.get(achat.id) || 0;
      lots.push({
        source_type: 'achat_mine',
        source_id: achat.id,
        reference: achat.numero_achat || 'Achat sans numéro',
        origine: achat.mining_company?.name || 'Société minière',
        date: achat.date_achat,
        quantiteOz: arrondi(quantiteOz),
        affecteeOz: arrondi(affecteeOz),
        disponibleOz: arrondi(Math.max(0, quantiteOz - affecteeOz)),
      });
    });

  achatsArtisans
    .filter((vente) => STATUTS_ARTISAN_ACQUIS.includes(vente.statut || ''))
    .forEach((vente) => {
      const quantiteOz = Number(vente.quantite_grammes || 0) / GRAMMES_PAR_ONCE;
      const affecteeOz = dejaAffecte.get(vente.id) || 0;
      lots.push({
        source_type: 'achat_artisan',
        source_id: vente.id,
        reference: vente.numero_recu || 'Reçu sans numéro',
        origine: nomArtisan(vente.artisan) || 'Artisan minier',
        date: vente.date_vente,
        quantiteOz: arrondi(quantiteOz),
        affecteeOz: arrondi(affecteeOz),
        disponibleOz: arrondi(Math.max(0, quantiteOz - affecteeOz)),
      });
    });

  cessionsComptoirs
    .filter((cession) => STATUTS_CESSION_ACQUISES.includes(cession.status || ''))
    .forEach((cession) => {
      const quantiteOz = Number(cession.quantity_grams || 0) / GRAMMES_PAR_ONCE;
      const affecteeOz = dejaAffecte.get(cession.id) || 0;
      lots.push({
        source_type: 'cession_comptoir',
        source_id: cession.id,
        reference: cession.reference_vente || 'Cession sans numéro',
        origine: cession.comptoir?.name || 'Comptoir d’achat',
        date: cession.date_vente,
        quantiteOz: arrondi(quantiteOz),
        affecteeOz: arrondi(affecteeOz),
        disponibleOz: arrondi(Math.max(0, quantiteOz - affecteeOz)),
      });
    });

  // Faute d'identifiant de lot historique commun entre achat et inventaire de
  // raffinerie, la réserve est retranchée globalement en FIFO. Le trigger SQL
  // applique le même invariant de masse et reste l'autorité concurrente.
  let reserveRestante = Math.max(0, Number(reserveNationaleOz) || 0);
  return lots
    .sort((left, right) => left.date.localeCompare(right.date) || left.reference.localeCompare(right.reference))
    .map((lot) => {
      const retenue = Math.min(lot.disponibleOz, reserveRestante);
      reserveRestante = arrondi(reserveRestante - retenue);
      return { ...lot, disponibleOz: arrondi(Math.max(0, lot.disponibleOz - retenue)) };
    });
}

export const tracabiliteVenteService = {
  /** Lots d'achat encore mobilisables. */
  async lotsDisponibles(): Promise<Lot[]> {
    const [mines, artisans, cessions, affectations, reserve] = await Promise.all([
      supabase
        .from('snp_achats_mines')
        .select('id, numero_achat, date_achat, quantite_oz, statut, mining_company:mining_companies(name)'),
      supabase
        .from('snp_artisan_ventes_or')
        .select('id, numero_recu, date_vente, quantite_grammes, statut, artisan:snp_artisans_miniers(nom, prenoms)')
        .is('comptoir_organization_id', null),
      supabase
        .from('snp_comptoir_ventes_sonasp')
        .select('id, reference_vente, date_vente, quantity_grams, status, comptoir:snp_organizations!snp_comptoir_ventes_sonasp_comptoir_organization_id_fkey(name)'),
      supabase
        .from(TABLE)
        .select('source_type, achat_mine_id, artisan_vente_id, comptoir_cession_id, quantite_oz')
        .is('released_at', null),
      supabase.from('gold_inventory').select('quantity_national_reserve_oz'),
    ]);

    if (mines.error) throw mines.error;
    if (artisans.error) throw artisans.error;
    if (cessions.error) throw cessions.error;
    if (affectations.error) throw affectations.error;
    if (reserve.error) throw reserve.error;

    return construireLots(
      (mines.data || []) as never,
      (artisans.data || []) as never,
      (affectations.data || []) as never,
      (reserve.data || []).reduce(
        (total, item) => total + Number(item.quantity_national_reserve_oz || 0),
        0,
      ),
      (cessions.data || []) as never,
    );
  },

  /** Composition d'une vente déjà enregistrée. */
  async lotsDeVente(saleId: string): Promise<Affectation[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        '*, ' +
          'achat:snp_achats_mines(numero_achat, mining_company:mining_companies(name)), ' +
          'vente_artisan:snp_artisan_ventes_or(numero_recu, artisan:snp_artisans_miniers(nom, prenoms))'
      )
      .eq('sale_id', saleId)
      .is('released_at', null)
      .order('created_at');
    if (error) throw error;

    type LotRow = {
      source_type: SourceLot;
      achat_mine_id: string | null;
      artisan_vente_id: string | null;
      comptoir_cession_id: string | null;
      quantite_oz: number | null;
      achat?: { numero_achat?: string | null; mining_company?: { name?: string | null } | null } | null;
      vente_artisan?: { numero_recu?: string | null; artisan?: { nom?: string | null; prenoms?: string | null } | null } | null;
      cession?: { reference_vente?: string | null; comptoir?: { name?: string | null } | null } | null;
    };
    const lignes = (data || []) as unknown as LotRow[];
    // Les bases antérieures à la filière Comptoir n'ont ni cette colonne ni sa
    // relation. Ne demander la relation que pour des identifiants réellement lus.
    const cessionIds = [...new Set(lignes.flatMap((ligne) => ligne.comptoir_cession_id ? [ligne.comptoir_cession_id] : []))];
    if (cessionIds.length) {
      const cessions = await supabase.from('snp_comptoir_ventes_sonasp')
        .select('id, reference_vente, comptoir:snp_organizations!snp_comptoir_ventes_sonasp_comptoir_organization_id_fkey(name)')
        .in('id', cessionIds);
      if (cessions.error) throw cessions.error;
      const parId = new Map((cessions.data ?? []).map((cession) => [cession.id, cession]));
      for (const ligne of lignes) {
        if (ligne.comptoir_cession_id) ligne.cession = parId.get(ligne.comptoir_cession_id) as LotRow['cession'];
      }
    }
    return lignes.map((ligne) => {
      const sourceId = ligne.achat_mine_id || ligne.artisan_vente_id || ligne.comptoir_cession_id;
      if (!sourceId) {
        throw new Error('Lot export incohérent : aucune source n’est rattachée.');
      }
      return {
        source_type: ligne.source_type,
        source_id: sourceId,
        reference:
          ligne.achat?.numero_achat ||
          ligne.vente_artisan?.numero_recu ||
          ligne.cession?.reference_vente ||
          '—',
        origine:
          ligne.achat?.mining_company?.name ||
          nomArtisan(ligne.vente_artisan?.artisan) ||
          ligne.cession?.comptoir?.name ||
          '—',
        quantite_oz: Number(ligne.quantite_oz || 0),
      };
    });
  },

};
