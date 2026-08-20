import { supabase } from '@/lib/supabase';
import { GRAMMES_PAR_ONCE, STATUTS_ENGAGEANTS, type StatutAchat } from './achatMineService';
import { STATUTS_ARTISAN_ACQUIS } from './stockSonaspService';

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

export type SourceLot = 'achat_mine' | 'achat_artisan';

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
    quantite_oz: number | null;
  }>
): Lot[] {
  const dejaAffecte = new Map<string, number>();
  affectations.forEach((part) => {
    const cle = part.achat_mine_id || part.artisan_vente_id;
    if (!cle) return;
    dejaAffecte.set(cle, (dejaAffecte.get(cle) || 0) + Number(part.quantite_oz || 0));
  });

  const lots: Lot[] = [];

  achatsMines
    .filter((achat) => STATUTS_ENGAGEANTS.includes(achat.statut))
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

  return lots;
}

export const tracabiliteVenteService = {
  /** Lots d'achat encore mobilisables. */
  async lotsDisponibles(): Promise<Lot[]> {
    const [mines, artisans, affectations] = await Promise.all([
      supabase
        .from('snp_achats_mines')
        .select('id, numero_achat, date_achat, quantite_oz, statut, mining_company:mining_companies(name)'),
      supabase
        .from('snp_artisan_ventes_or')
        .select('id, numero_recu, date_vente, quantite_grammes, statut, artisan:snp_artisans_miniers(nom, prenoms)'),
      supabase.from(TABLE).select('source_type, achat_mine_id, artisan_vente_id, quantite_oz'),
    ]);

    if (mines.error) throw mines.error;
    if (artisans.error) throw artisans.error;
    if (affectations.error) throw affectations.error;

    return construireLots(
      (mines.data || []) as never,
      (artisans.data || []) as never,
      (affectations.data || []) as never
    );
  },

  /** Composition d'une vente déjà enregistrée. */
  async lotsDeVente(saleId: string): Promise<Affectation[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        'source_type, achat_mine_id, artisan_vente_id, quantite_oz, ' +
          'achat:snp_achats_mines(numero_achat, mining_company:mining_companies(name)), ' +
          'vente_artisan:snp_artisan_ventes_or(numero_recu, artisan:snp_artisans_miniers(nom, prenoms))'
      )
      .eq('sale_id', saleId)
      .order('created_at');
    if (error) throw error;

    return (data || []).map((ligne: Record<string, any>) => ({
      source_type: ligne.source_type,
      source_id: ligne.achat_mine_id || ligne.artisan_vente_id,
      reference: ligne.achat?.numero_achat || ligne.vente_artisan?.numero_recu || '—',
      origine:
        ligne.achat?.mining_company?.name || nomArtisan(ligne.vente_artisan?.artisan) || '—',
      quantite_oz: Number(ligne.quantite_oz || 0),
    }));
  },

  /** Enregistre la composition d'une vente. */
  async affecter(saleId: string, affectations: Affectation[]): Promise<void> {
    if (!affectations.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from(TABLE).insert(
      affectations.map((part) => ({
        sale_id: saleId,
        source_type: part.source_type,
        achat_mine_id: part.source_type === 'achat_mine' ? part.source_id : null,
        artisan_vente_id: part.source_type === 'achat_artisan' ? part.source_id : null,
        quantite_oz: part.quantite_oz,
        created_by: user?.id,
      }))
    );
    if (error) throw error;
  },
};
