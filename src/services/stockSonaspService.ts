import { supabase } from '@/lib/supabase';
import { GRAMMES_PAR_ONCE, STATUTS_ENGAGEANTS, type StatutAchat } from './achatMineService';

/**
 * Stock d'or de la SONASP disponible à l'export.
 *
 * La plateforme inscrivait la mine comme vendeur des ventes internationales :
 * l'or passait du producteur au raffineur sans jamais appartenir à la SONASP,
 * et rien ne reliait ce qu'elle achetait à ce qu'elle revendait. Le stock
 * exportable se construit de deux entrées et d'une sortie :
 *
 *   entrées  = achats aux mines industrielles + achats aux artisans miniers
 *              + cessions des comptoirs (leur vente à la SONASP est obligatoire)
 *   sorties  = ventes déjà conclues hors du Burkina
 *   disponible = entrées − sorties
 *
 * Tout est ramené à l'once troy, unité des ventes internationales, alors que
 * l'achat artisanal se compte en grammes.
 */

/** Code de la société institutionnelle SONASP dans `mining_companies`. */
export const CODE_SONASP = 'SONASP';

/** Statuts d'une vente export qui immobilisent la quantité. */
export const STATUTS_VENTE_ENGAGEANTS = [
  'for_sale',
  'sold',
  'paid',
  'create_sales',
  'pending_management_approval',
  'management_approved',
  'pending_for_customer_approval',
  'customer_approved',
  'waiting_for_payment',
  'virtual_payment',
  'payment_received',
  'completed',
];

/** Statuts d'un achat artisanal qui font entrer l'or au stock. */
export const STATUTS_ARTISAN_ACQUIS = ['validee', 'payee'];

/**
 * Statuts d'une cession comptoir acquise : acceptée par la SONASP, payée ou
 * non. Une cession soumise, rejetée ou annulée ne transfère rien.
 */
export const STATUTS_CESSION_ACQUISES = ['accepted', 'paid'];

export interface StockSonasp {
  /** Onces acquises auprès des mines industrielles. */
  achatMinesOz: number;
  /** Onces acquises auprès des artisans miniers. */
  achatArtisansOz: number;
  /** Onces cédées par les comptoirs, dont la vente à la SONASP est obligatoire. */
  cessionComptoirsOz: number;
  /** Onces déjà engagées par une vente à l'international. */
  venduOz: number;
  entreesOz: number;
  disponibleOz: number;
  disponibleGrammes: number;
  /** Vrai quand les ventes dépassent les entrées : anomalie à signaler, pas à masquer. */
  decouvert: boolean;
}

const arrondi = (valeur: number) => Math.round(valeur * 1000) / 1000;

export function calculerStockSonasp(
  achatsMines: Array<{ quantite_oz: number | null; statut: StatutAchat }>,
  achatsArtisans: Array<{ quantite_grammes: number | null; statut: string | null }>,
  ventesExport: Array<{ quantity_oz: number | null; status: string | null }>,
  cessionsComptoirs: Array<{ quantity_grams: number | null; status: string | null }> = []
): StockSonasp {
  const achatMinesOz = achatsMines
    .filter((achat) => STATUTS_ENGAGEANTS.includes(achat.statut))
    .reduce((total, achat) => total + Number(achat.quantite_oz || 0), 0);

  const achatArtisansGrammes = achatsArtisans
    .filter((vente) => STATUTS_ARTISAN_ACQUIS.includes(vente.statut || ''))
    .reduce((total, vente) => total + Number(vente.quantite_grammes || 0), 0);
  const achatArtisansOz = achatArtisansGrammes / GRAMMES_PAR_ONCE;

  const cessionComptoirsGrammes = cessionsComptoirs
    .filter((cession) => STATUTS_CESSION_ACQUISES.includes(cession.status || ''))
    .reduce((total, cession) => total + Number(cession.quantity_grams || 0), 0);
  const cessionComptoirsOz = cessionComptoirsGrammes / GRAMMES_PAR_ONCE;

  const venduOz = ventesExport
    .filter((vente) => STATUTS_VENTE_ENGAGEANTS.includes(vente.status || ''))
    .reduce((total, vente) => total + Number(vente.quantity_oz || 0), 0);

  const entreesOz = achatMinesOz + achatArtisansOz + cessionComptoirsOz;
  const solde = entreesOz - venduOz;

  return {
    achatMinesOz: arrondi(achatMinesOz),
    achatArtisansOz: arrondi(achatArtisansOz),
    cessionComptoirsOz: arrondi(cessionComptoirsOz),
    venduOz: arrondi(venduOz),
    entreesOz: arrondi(entreesOz),
    disponibleOz: arrondi(Math.max(0, solde)),
    disponibleGrammes: arrondi(Math.max(0, solde) * GRAMMES_PAR_ONCE),
    decouvert: solde < -1e-6,
  };
}

export const stockSonaspService = {
  /** Identifiant de la SONASP, vendeuse de toutes les ventes à l'export. */
  async identifiant(): Promise<{ id: string; name: string; country: string | null } | null> {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('id, name, country, code')
      .ilike('code', CODE_SONASP)
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, name: data.name, country: data.country } : null;
  },

  /**
   * Les quatre sources sont lues ensemble : une seule en échec afficherait un
   * disponible faux, donc l'erreur remonte plutôt que d'être avalée.
   */
  async stock(sonaspId: string): Promise<StockSonasp> {
    const [mines, artisans, ventes, cessions] = await Promise.all([
      supabase.from('snp_achats_mines').select('quantite_oz, statut'),
      supabase.from('snp_artisan_ventes_or').select('quantite_grammes, statut'),
      supabase.from('sales').select('quantity_oz, status').eq('seller_id', sonaspId),
      supabase.from('snp_comptoir_ventes_sonasp').select('quantity_grams, status'),
    ]);

    if (mines.error) throw mines.error;
    if (artisans.error) throw artisans.error;
    if (ventes.error) throw ventes.error;
    if (cessions.error) throw cessions.error;

    return calculerStockSonasp(
      (mines.data || []) as Array<{ quantite_oz: number; statut: StatutAchat }>,
      artisans.data || [],
      ventes.data || [],
      cessions.data || []
    );
  },
};
