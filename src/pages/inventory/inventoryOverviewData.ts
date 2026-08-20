import { supabase } from '@/lib/supabase';

export const GRAMMES_PAR_ONCE = 31.1034768;

export const ozVersKg = (onces: number) => (onces * GRAMMES_PAR_ONCE) / 1000;

/** Étapes où l'or est chez la raffinerie, ou en route : rien à faire ici. */
export const STATUTS_EN_ROUTE = ['shipped_to_refinery', 'received_at_refinery', 'processing'] as const;

/**
 * Raffinage terminé : l'or n'attend qu'une saisie d'entrée pour revenir en
 * stock. C'est un travail en attente, non un simple état de transport.
 */
export const STATUT_A_REINTEGRER = 'processed';

/** Étapes où l'or a quitté le site mais n'est pas encore revenu en stock raffiné. */
export const STATUTS_TRANSIT = [...STATUTS_EN_ROUTE, STATUT_A_REINTEGRER] as const;

/**
 * Étapes où le lot est constitué mais pas encore embarqué.
 * Les libellés sont ceux de l'énumération `shipping_preparation_status` : un
 * seul caractère de trop ou de moins fait échouer la requête entière, et la
 * source entière passe en « indisponible » (A197).
 */
export const STATUTS_AEROPORT = ['waiting_for_customs_approval', 'approved_by_customs', 'ready_for_expedition'] as const;

/** Ventes d'or artisanal dont la matière est bien entrée chez la SONASP. */
export const STATUT_ARTISANAL_ACQUIS = 'validee';

/** Statuts de paiement qui laissent une vente non réglée. */
export const STATUTS_NON_PAYE = ['pending', 'rejected'] as const;

export interface StockParMine {
  id: string;
  nom: string;
  totalOz: number;
  disponibleOz: number;
  allloueOz: number;
  venduOz: number;
  lignes: number;
}

export interface LigneTransit {
  reference: string;
  statut: string;
  quantiteOz: number;
  destination: string;
  date: string | null;
}

export interface StockNational {
  /** Or raffiné détenu, toutes mines confondues. */
  totalOz: number;
  disponibleOz: number;
  allloueOz: number;
  venduOz: number;
  /** Or expédié, pas encore réintégré au stock raffiné. */
  transitOz: number;
  /** Parti chez la raffinerie ou en cours de traitement. */
  enRouteOz: number;
  /** Raffinage terminé : n'attend qu'une saisie d'entrée en stock. */
  aReintegrerOz: number;
  aReintegrerLots: number;
  /** Lots constitués, en attente d'embarquement. */
  aeroportOz: number;
  /** Or vendu dont le règlement n'est pas encaissé. */
  venduNonPayeOz: number;
  venduNonPayeMontant: number;
  venduNonPayeDevise: string | null;
  /**
   * Or acheté aux artisans, détenu en l'état — poudre, pépites, petits lingots.
   * Il n'est pas dans `gold_inventory` : cette table ne porte que de l'or
   * raffiné rattaché à une mine industrielle. Il est donc compté à part, et
   * n'entre pas dans le socle national tant qu'il n'a pas été fondu.
   */
  artisanalGrammes: number;
  artisanalFinGrammes: number;
  artisanalLots: number;
  parMine: StockParMine[];
  transit: LigneTransit[];
  /** Sources qui n'ont pas répondu ; leur indicateur reste à zéro. */
  indisponibles: string[];
}

export const STOCK_VIDE: StockNational = {
  totalOz: 0,
  disponibleOz: 0,
  allloueOz: 0,
  venduOz: 0,
  transitOz: 0,
  enRouteOz: 0,
  aReintegrerOz: 0,
  aReintegrerLots: 0,
  aeroportOz: 0,
  venduNonPayeOz: 0,
  venduNonPayeMontant: 0,
  venduNonPayeDevise: null,
  artisanalGrammes: 0,
  artisanalFinGrammes: 0,
  artisanalLots: 0,
  parMine: [],
  transit: [],
  indisponibles: [],
};

type Resultat = PromiseSettledResult<{ data: unknown; error: unknown }>;

/** Lignes d'un résultat Supabase, ou `null` si la source a échoué. */
export function lireLignes<T>(resultat: Resultat): T[] | null {
  if (resultat.status !== 'fulfilled') return null;
  const valeur = resultat.value;
  if (valeur?.error || !Array.isArray(valeur?.data)) return null;
  return valeur.data as T[];
}

export const somme = <T,>(lignes: T[], champ: (ligne: T) => number) =>
  lignes.reduce((total, ligne) => total + (Number(champ(ligne)) || 0), 0);

/**
 * Or fin contenu dans un lot artisanal. Un carat vaut un vingt-quatrième de
 * métal fin ; sans pureté déclarée, le lot ne contribue pas au fin plutôt que
 * de le supposer pur.
 */
export const orFin = (lot: { quantite_grammes?: number | null; purete_karat?: number | null }) => {
  const masse = Number(lot.quantite_grammes || 0);
  const karat = Number(lot.purete_karat || 0);
  return karat > 0 ? (masse * karat) / 24 : 0;
};

/**
 * Regroupe le stock détenu par société minière.
 * Les lignes sans société rattachée sont comptées à part plutôt qu'écartées :
 * les ignorer ferait mentir le total par mine face au total national.
 */
export function grouperParMine(
  lignes: Array<{
    mining_company_id: string | null;
    final_fine_oz?: number | null;
    quantity_available_oz?: number | null;
    quantity_allocated_oz?: number | null;
    quantity_sold_oz?: number | null;
  }>,
  societes: Array<{ id: string; name: string }>
): StockParMine[] {
  const parId = new Map(societes.map((societe) => [societe.id, societe]));
  const groupes = new Map<string, StockParMine>();

  lignes.forEach((ligne) => {
    const cle = ligne.mining_company_id || '__sans_rattachement';
    const societe = ligne.mining_company_id ? parId.get(ligne.mining_company_id) : undefined;
    const groupe =
      groupes.get(cle) ||
      {
        id: cle,
        nom: societe?.name || (ligne.mining_company_id ? 'Société inconnue' : 'Sans société rattachée'),
          totalOz: 0,
        disponibleOz: 0,
        allloueOz: 0,
        venduOz: 0,
        lignes: 0,
      };

    groupe.totalOz += Number(ligne.final_fine_oz || 0);
    groupe.disponibleOz += Number(ligne.quantity_available_oz || 0);
    groupe.allloueOz += Number(ligne.quantity_allocated_oz || 0);
    groupe.venduOz += Number(ligne.quantity_sold_oz || 0);
    groupe.lignes += 1;
    groupes.set(cle, groupe);
  });

  return [...groupes.values()].sort((a, b) => b.totalOz - a.totalOz);
}

/**
 * Ventes dont le règlement n'est pas encaissé.
 * Une vente sans ligne de paiement compte comme non réglée : c'est de l'or sorti
 * du stock sans contrepartie constatée.
 */
export function venduNonPaye(
  ventes: Array<{ id: string; quantity_oz?: number | null; total_amount?: number | null; currency?: string | null }>,
  paiements: Array<{ sale_id: string | null; status?: string | null }>
) {
  const regleesParVente = new Set(
    paiements.filter((paiement) => paiement.status === 'approved').map((paiement) => paiement.sale_id)
  );
  const enSouffrance = ventes.filter((vente) => !regleesParVente.has(vente.id));
  const devises = new Set(enSouffrance.map((vente) => vente.currency).filter(Boolean));

  return {
    quantiteOz: somme(enSouffrance, (vente) => Number(vente.quantity_oz || 0)),
    montant: somme(enSouffrance, (vente) => Number(vente.total_amount || 0)),
    // Un total n'a de sens qu'en devise unique ; l'écran affiche « — » sinon.
    devise: devises.size === 1 ? ([...devises][0] as string) : null,
    nombre: enSouffrance.length,
  };
}

/**
 * Charge la vue nationale du stock.
 *
 * Chaque source est interrogée indépendamment : une table absente ne vide pas
 * l'écran, elle est nommée dans `indisponibles` et son indicateur reste à zéro.
 */
export async function chargerStockNational(): Promise<StockNational> {
  const [inventaire, societes, fret, preparations, ventes, paiements, artisanal] = await Promise.allSettled([
    supabase
      .from('gold_inventory')
      .select('final_fine_oz, quantity_available_oz, quantity_allocated_oz, quantity_sold_oz, mining_company_id'),
    supabase.from('mining_companies').select('id, name'),
    supabase
      .from('freight_shipments')
      .select('reference_number, status, total_pure_gold_oz, shipment_date, destination_refinery:refineries(name)')
      .in('status', [...STATUTS_TRANSIT]),
    supabase
      .from('shipping_preparations')
      .select('total_weight_oz, status')
      .in('status', [...STATUTS_AEROPORT]),
    supabase.from('sales').select('id, quantity_oz, total_amount, currency'),
    supabase.from('payments').select('sale_id, status'),
    supabase
      .from('snp_artisan_ventes_or')
      .select('quantite_grammes, purete_karat, type_or')
      .eq('statut', STATUT_ARTISANAL_ACQUIS),
  ]);

  const lignesInventaire = lireLignes<{
    final_fine_oz: number | null;
    quantity_available_oz: number | null;
    quantity_allocated_oz: number | null;
    quantity_sold_oz: number | null;
    mining_company_id: string | null;
  }>(inventaire);
  const lignesSocietes = lireLignes<{ id: string; name: string }>(societes);
  const lignesFret = lireLignes<{
    reference_number: string;
    status: string;
    total_pure_gold_oz: number | null;
    shipment_date: string | null;
    destination_refinery?: { name?: string } | Array<{ name?: string }> | null;
  }>(fret);
  const lignesPreparations = lireLignes<{ total_weight_oz: number | null }>(preparations);
  const lignesVentes = lireLignes<{ id: string; quantity_oz: number | null; total_amount: number | null; currency: string | null }>(ventes);
  const lignesPaiements = lireLignes<{ sale_id: string | null; status: string | null }>(paiements);
  const lignesArtisanal = lireLignes<{
    quantite_grammes: number | null;
    purete_karat: number | null;
    type_or: string | null;
  }>(artisanal);

  const indisponibles: string[] = [];
  if (lignesInventaire === null) indisponibles.push('le stock raffiné');
  if (lignesFret === null) indisponibles.push('les expéditions');
  if (lignesPreparations === null) indisponibles.push('les préparations');
  if (lignesVentes === null || lignesPaiements === null) indisponibles.push('les ventes et règlements');
  if (lignesArtisanal === null) indisponibles.push('la collecte artisanale');

  const detenu = lignesInventaire || [];
  const impayes =
    lignesVentes && lignesPaiements
      ? venduNonPaye(lignesVentes, lignesPaiements)
      : { quantiteOz: 0, montant: 0, devise: null, nombre: 0 };

  const nomRaffinerie = (destination: { name?: string } | Array<{ name?: string }> | null | undefined) =>
    (Array.isArray(destination) ? destination[0]?.name : destination?.name) || 'Destination non renseignée';

  const artisanalDetenu = lignesArtisanal || [];
  const enRoute = (lignesFret || []).filter((ligne) => ligne.status !== STATUT_A_REINTEGRER);
  const aReintegrer = (lignesFret || []).filter((ligne) => ligne.status === STATUT_A_REINTEGRER);

  return {
    totalOz: somme(detenu, (ligne) => Number(ligne.final_fine_oz || 0)),
    disponibleOz: somme(detenu, (ligne) => Number(ligne.quantity_available_oz || 0)),
    allloueOz: somme(detenu, (ligne) => Number(ligne.quantity_allocated_oz || 0)),
    venduOz: somme(detenu, (ligne) => Number(ligne.quantity_sold_oz || 0)),
    transitOz: somme(lignesFret || [], (ligne) => Number(ligne.total_pure_gold_oz || 0)),
    enRouteOz: somme(enRoute, (ligne) => Number(ligne.total_pure_gold_oz || 0)),
    aReintegrerOz: somme(aReintegrer, (ligne) => Number(ligne.total_pure_gold_oz || 0)),
    aReintegrerLots: aReintegrer.length,
    aeroportOz: somme(lignesPreparations || [], (ligne) => Number(ligne.total_weight_oz || 0)),
    venduNonPayeOz: impayes.quantiteOz,
    venduNonPayeMontant: impayes.montant,
    venduNonPayeDevise: impayes.devise,
    artisanalGrammes: somme(artisanalDetenu, (ligne) => Number(ligne.quantite_grammes || 0)),
    artisanalFinGrammes: somme(artisanalDetenu, (ligne) => orFin(ligne)),
    artisanalLots: artisanalDetenu.length,
    parMine: grouperParMine(detenu, lignesSocietes || []),
    transit: (lignesFret || []).map((ligne) => ({
      reference: ligne.reference_number,
      statut: ligne.status,
      quantiteOz: Number(ligne.total_pure_gold_oz || 0),
      destination: nomRaffinerie(ligne.destination_refinery),
      date: ligne.shipment_date,
    })),
    indisponibles,
  };
}
