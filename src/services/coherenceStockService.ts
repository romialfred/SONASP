import { supabase } from '@/lib/supabase';
import { STATUTS_VENTE_ENGAGEANTS } from './stockSonaspService';

/**
 * Contrôle de cohérence du stock exportable.
 *
 * Le stock de la SONASP se mesure de deux façons qui doivent coïncider :
 *
 *   en masse : total acheté − total vendu
 *   pièce à pièce : somme des lots d'achat affectés aux ventes
 *
 * Elles ne coïncident que si **toute** vente écrit sa composition. Une vente
 * créée hors du formulaire — par script, par import, en base — échapperait au
 * chaînage sans que rien ne le signale : le stock paraîtrait entamé sans qu'on
 * sache par quel or. Ce contrôle nomme ces ventes plutôt que de laisser l'écart
 * se dissoudre dans un total.
 */

export interface VenteSansOrigine {
  id: string;
  numero: string;
  quantiteOz: number;
  /** Onces effectivement rattachées à des lots d'achat. */
  traceeOz: number;
  manquantOz: number;
}

export interface Coherence {
  /** Onces vendues par la SONASP, ventes annulées exclues. */
  venduOz: number;
  /** Onces rattachées à un lot d'achat. */
  traceeOz: number;
  /** Onces vendues sans origine connue. */
  ecartOz: number;
  ventesSansOrigine: VenteSansOrigine[];
  coherent: boolean;
}

const arrondi = (valeur: number) => Math.round(valeur * 10000) / 10000;
const TOLERANCE = 0.001;

export function comparer(
  ventes: Array<{ id: string; sale_number: string | null; quantity_oz: number | null; status: string | null }>,
  lots: Array<{ sale_id: string; quantite_oz: number | null }>
): Coherence {
  const traceeParVente = new Map<string, number>();
  lots.forEach((lot) => {
    traceeParVente.set(lot.sale_id, (traceeParVente.get(lot.sale_id) || 0) + Number(lot.quantite_oz || 0));
  });

  const engageantes = ventes.filter((vente) => STATUTS_VENTE_ENGAGEANTS.includes(vente.status || ''));

  let venduOz = 0;
  let traceeOz = 0;
  const ventesSansOrigine: VenteSansOrigine[] = [];

  engageantes.forEach((vente) => {
    const quantiteOz = Number(vente.quantity_oz || 0);
    // Une vente peut porter plus de lots que sa quantité : le surplus n'est pas
    // une traçabilité en trop, c'est une anomalie à part. On ne compte donc
    // jamais plus que la quantité vendue.
    const tracee = Math.min(quantiteOz, traceeParVente.get(vente.id) || 0);
    venduOz += quantiteOz;
    traceeOz += tracee;

    if (quantiteOz - tracee > TOLERANCE) {
      ventesSansOrigine.push({
        id: vente.id,
        numero: vente.sale_number || 'Vente sans numéro',
        quantiteOz: arrondi(quantiteOz),
        traceeOz: arrondi(tracee),
        manquantOz: arrondi(quantiteOz - tracee),
      });
    }
  });

  const ecartOz = arrondi(venduOz - traceeOz);
  return {
    venduOz: arrondi(venduOz),
    traceeOz: arrondi(traceeOz),
    ecartOz,
    ventesSansOrigine: ventesSansOrigine.sort((a, b) => b.manquantOz - a.manquantOz),
    coherent: ecartOz <= TOLERANCE,
  };
}

export const coherenceStockService = {
  /**
   * Les deux sources sont lues ensemble : une seule en échec rendrait un écart
   * imaginaire, donc l'erreur remonte plutôt que d'être avalée.
   */
  async controler(sonaspId: string): Promise<Coherence> {
    const [ventes, lots] = await Promise.all([
      supabase.from('sales').select('id, sale_number, quantity_oz, status').eq('seller_id', sonaspId),
      supabase.from('snp_ventes_lots').select('sale_id, quantite_oz'),
    ]);

    if (ventes.error) throw ventes.error;
    if (lots.error) throw lots.error;

    return comparer(ventes.data || [], lots.data || []);
  },
};
