import { supabase } from '@/lib/supabase';

/**
 * Achats d'or de la SONASP auprès des sociétés minières industrielles.
 *
 * Le circuit comporte deux ventes que la plateforme confondait :
 *
 *   1. La mine déclare sa production journalière, qui constitue son stock. En
 *      fin de mois, la SONASP lui achète tout ou partie de ce stock — c'est ce
 *      module, pendant industriel de l'achat aux artisans miniers.
 *   2. La SONASP revend hors du Burkina à des raffineurs internationaux, avec
 *      l'or ainsi acquis — c'est le module `sales`.
 *
 * La table `sales` ne connaissait que le second cas et y inscrivait la mine
 * comme vendeur : la SONASP n'apparaissait nulle part, et l'or passait de la
 * mine au raffineur sans jamais lui appartenir.
 */

const TABLE = 'snp_achats_mines';
export const GRAMMES_PAR_ONCE = 31.1034768;

export type StatutAchat = 'en_attente' | 'validee' | 'payee' | 'annulee';

export const STATUTS_ACHAT: StatutAchat[] = ['en_attente', 'validee', 'payee', 'annulee'];

export const LIBELLES_STATUT_ACHAT: Record<StatutAchat, string> = {
  en_attente: 'En attente',
  validee: 'Validé',
  payee: 'Payé',
  annulee: 'Annulé',
};

/** Statuts qui immobilisent la quantité : elle n'est plus disponible au stock. */
export const STATUTS_ENGAGEANTS: StatutAchat[] = ['en_attente', 'validee', 'payee'];

export interface AchatMine {
  id?: string;
  numero_achat?: string;
  mining_company_id: string;
  periode_debut: string;
  periode_fin: string;
  date_achat: string;
  quantite_oz: number;
  quantite_grammes?: number | null;
  prix_once_fcfa: number;
  cours_once_usd?: number | null;
  taux_usd_xof?: number | null;
  montant_brut_fcfa: number;
  tva_taux: number;
  tva_montant_fcfa: number;
  taxe_dev_comm_taux: number;
  taxe_dev_comm_montant_fcfa: number;
  montant_total_fcfa: number;
  statut: StatutAchat;
  observations?: string | null;
  created_at?: string;
  mining_company?: { id: string; name: string } | null;
}

export interface StockMine {
  mining_company_id: string;
  nom: string;
  /** Onces déclarées en production sur la période. */
  produitOz: number;
  /** Onces déjà engagées par un achat de la SONASP. */
  acheteOz: number;
  /** Reste mobilisable. */
  disponibleOz: number;
  declarations: number;
}

export interface Valorisation {
  montantBrut: number;
  tva: number;
  taxeDevComm: number;
  montantTotal: number;
}

/**
 * Valorisation d'un achat.
 * Les taxes s'ajoutent au montant brut, comme sur l'achat aux artisans : c'est
 * la SONASP qui les acquitte en sus du prix versé au vendeur.
 *
 * Les deux taux sont exigés, sans valeur par défaut. Ils portaient auparavant
 * 18 % et 1 % écrits dans le code : un appel qui les omettait appliquait donc en
 * silence des taux contraires au barème. Ils se résolvent désormais par
 * `tauxAchatService`, qui interroge le référentiel.
 */
export function valoriser(
  quantiteOz: number,
  prixOnceFcfa: number,
  tvaTaux: number,
  taxeDevCommTaux: number
): Valorisation {
  const arrondi = (valeur: number) => Math.round(valeur * 100) / 100;
  const montantBrut = arrondi(Math.max(0, quantiteOz) * Math.max(0, prixOnceFcfa));
  const tva = arrondi((montantBrut * tvaTaux) / 100);
  const taxeDevComm = arrondi((montantBrut * taxeDevCommTaux) / 100);
  return { montantBrut, tva, taxeDevComm, montantTotal: arrondi(montantBrut + tva + taxeDevComm) };
}

export const oncesVersGrammes = (onces: number) => Math.round((onces || 0) * GRAMMES_PAR_ONCE * 1000) / 1000;

/**
 * Stock mobilisable d'une mine sur une période.
 * Un achat annulé ne retient rien : sa quantité revient au disponible.
 */
export function calculerStock(
  productions: Array<{ mining_company_id: string | null; estimated_oz: number | null }>,
  achats: Array<{ mining_company_id: string; quantite_oz: number; statut: StatutAchat }>,
  societes: Array<{ id: string; name: string }>
): StockMine[] {
  const parId = new Map(societes.map((societe) => [societe.id, societe.name]));
  const stocks = new Map<string, StockMine>();

  const obtenir = (id: string): StockMine => {
    const existant = stocks.get(id);
    if (existant) return existant;
    const cree: StockMine = {
      mining_company_id: id,
      nom: parId.get(id) || 'Société inconnue',
      produitOz: 0,
      acheteOz: 0,
      disponibleOz: 0,
      declarations: 0,
    };
    stocks.set(id, cree);
    return cree;
  };

  productions.forEach((production) => {
    if (!production.mining_company_id) return;
    const stock = obtenir(production.mining_company_id);
    stock.produitOz += Number(production.estimated_oz || 0);
    stock.declarations += 1;
  });

  achats.forEach((achat) => {
    if (!STATUTS_ENGAGEANTS.includes(achat.statut)) return;
    obtenir(achat.mining_company_id).acheteOz += Number(achat.quantite_oz || 0);
  });

  stocks.forEach((stock) => {
    // Le disponible ne descend pas sous zéro : un sur-achat se lit à part.
    stock.disponibleOz = Math.max(0, stock.produitOz - stock.acheteOz);
  });

  return [...stocks.values()].sort((a, b) => b.disponibleOz - a.disponibleOz);
}

/** Contrôles bloquants avant enregistrement. */
export function validerAchat(achat: Partial<AchatMine>, disponibleOz: number | null): string | null {
  if (!achat.mining_company_id) return 'Sélectionnez la société minière.';
  if (!achat.periode_debut || !achat.periode_fin) return 'Renseignez la période de production achetée.';
  if (achat.periode_fin < achat.periode_debut) {
    return 'La fin de période est antérieure à son début.';
  }
  const quantite = Number(achat.quantite_oz || 0);
  if (!(quantite > 0)) return 'La quantité achetée doit être supérieure à zéro.';
  if (disponibleOz !== null && quantite > disponibleOz + 1e-6) {
    return `La quantité dépasse le stock disponible (${disponibleOz.toFixed(2)} oz).`;
  }
  if (!(Number(achat.prix_once_fcfa || 0) > 0)) return 'Le prix à l’once doit être supérieur à zéro.';
  return null;
}

export const achatMineService = {
  async lister(): Promise<AchatMine[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, mining_company:mining_companies(id, name)')
      .order('date_achat', { ascending: false });
    if (error) throw error;
    return (data || []) as AchatMine[];
  },

  async parId(id: string): Promise<AchatMine | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*, mining_company:mining_companies(id, name)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as AchatMine) || null;
  },

  /**
   * Stock de production par société, sur une période.
   * Les trois sources sont lues ensemble : une seule en échec fausserait le
   * disponible, donc l'erreur est remontée plutôt qu'avalée.
   */
  async stocksParSociete(debut: string, fin: string): Promise<StockMine[]> {
    const [productions, achats, societes] = await Promise.all([
      supabase
        .from('daily_production')
        .select('mining_company_id, estimated_oz')
        .gte('production_date', debut)
        .lte('production_date', fin),
      supabase.from(TABLE).select('mining_company_id, quantite_oz, statut'),
      supabase.from('mining_companies').select('id, name').eq('is_active', true),
    ]);

    if (productions.error) throw productions.error;
    if (achats.error) throw achats.error;
    if (societes.error) throw societes.error;

    return calculerStock(
      productions.data || [],
      (achats.data || []) as Array<{ mining_company_id: string; quantite_oz: number; statut: StatutAchat }>,
      societes.data || []
    );
  },

  async creer(achat: AchatMine): Promise<AchatMine> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{ ...achat, quantite_grammes: oncesVersGrammes(achat.quantite_oz), created_by: user?.id, updated_by: user?.id }])
      .select('*, mining_company:mining_companies(id, name)')
      .single();
    if (error) throw error;
    return data as AchatMine;
  },

  async changerStatut(id: string, statut: StatutAchat): Promise<AchatMine> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from(TABLE)
      .update({ statut, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, mining_company:mining_companies(id, name)')
      .single();
    if (error) throw error;
    return data as AchatMine;
  },
};
