import {
  ALLOWED_TRANSITIONS,
  WorkflowModule,
  getModuleForStatus,
} from '@/services/statusTransitionControlService';
import { formatStatusFr } from '@/utils/statusFormatter';

/**
 * Graphe du circuit de traçabilité, dérivé de la table de transitions du service de
 * contrôle.
 *
 * L'écran de workflow présentait un diagramme BPMN entièrement écrit à la main, décrivant
 * un processus « Batch Management » qui n'existe pas dans la plateforme : ni module de
 * lots, ni route `/batches`. La documentation affichée aux administrateurs ne correspondait
 * donc à aucun circuit réel. Le graphe est désormais calculé à partir des transitions
 * effectivement appliquées : il ne peut plus diverger.
 */

export const MODULE_LABELS: Record<WorkflowModule, string> = {
  [WorkflowModule.PRODUCTION]: 'Production',
  [WorkflowModule.SHIPPING_PREPARATION]: 'Préparation d’expédition',
  [WorkflowModule.FREIGHT_CUSTOMS]: 'Fret et douane',
  [WorkflowModule.REFINERY]: 'Raffinerie',
  [WorkflowModule.INVENTORY]: 'Stock',
  [WorkflowModule.SALE]: 'Vente',
};

/** Ordre d'affichage des couloirs, du plus amont au plus aval. */
export const ORDRE_COULOIRS: Array<WorkflowModule | 'transverse'> = [
  WorkflowModule.PRODUCTION,
  WorkflowModule.SHIPPING_PREPARATION,
  WorkflowModule.FREIGHT_CUSTOMS,
  WorkflowModule.REFINERY,
  WorkflowModule.INVENTORY,
  WorkflowModule.SALE,
  'transverse',
];

export const COULEURS_COULOIR: Record<string, string> = {
  [WorkflowModule.PRODUCTION]: '#0f7a56',
  [WorkflowModule.SHIPPING_PREPARATION]: '#2f6fd0',
  [WorkflowModule.FREIGHT_CUSTOMS]: '#b8860b',
  [WorkflowModule.REFINERY]: '#8b5cf6',
  [WorkflowModule.INVENTORY]: '#0e7490',
  [WorkflowModule.SALE]: '#c2410c',
  transverse: '#64748b',
};

export interface NoeudWorkflow {
  statut: string;
  libelle: string;
  couloir: string;
  couloirLabel: string;
  couleur: string;
  /** Profondeur dans la chaîne : nombre maximal d'étapes depuis un point d'entrée. */
  profondeur: number;
  transitions: string[];
  entrantes: string[];
  estInitial: boolean;
  estFinal: boolean;
  x: number;
  y: number;
}

export interface LienWorkflow {
  id: string;
  de: string;
  vers: string;
}

export interface CouloirWorkflow {
  id: string;
  label: string;
  couleur: string;
  y: number;
  hauteur: number;
}

export interface GrapheWorkflow {
  noeuds: NoeudWorkflow[];
  liens: LienWorkflow[];
  couloirs: CouloirWorkflow[];
  largeur: number;
  hauteur: number;
}

export const LARGEUR_COLONNE = 190;
export const HAUTEUR_LIGNE = 78;
export const MARGE_GAUCHE = 190;
export const MARGE_HAUT = 34;

/** Transitions entrantes de chaque statut. */
export function entrantes(transitions: Record<string, string[]>): Record<string, string[]> {
  const resultat: Record<string, string[]> = {};
  Object.keys(transitions).forEach((statut) => {
    resultat[statut] = resultat[statut] || [];
  });
  Object.entries(transitions).forEach(([source, cibles]) => {
    cibles.forEach((cible) => {
      resultat[cible] = [...(resultat[cible] || []), source];
    });
  });
  return resultat;
}

/**
 * Profondeur de chaque statut : longueur du plus long chemin depuis un point d'entrée.
 * Le parcours est borné par le nombre de statuts, ce qui neutralise un éventuel cycle.
 */
export function profondeurs(transitions: Record<string, string[]>): Record<string, number> {
  const arrivees = entrantes(transitions);
  const statuts = Object.keys(arrivees);
  const profondeur: Record<string, number> = {};
  statuts.forEach((statut) => {
    profondeur[statut] = 0;
  });

  for (let passe = 0; passe < statuts.length; passe += 1) {
    let stable = true;
    statuts.forEach((statut) => {
      (transitions[statut] || []).forEach((cible) => {
        if (profondeur[cible] < profondeur[statut] + 1) {
          profondeur[cible] = profondeur[statut] + 1;
          stable = false;
        }
      });
    });
    if (stable) break;
  }

  return profondeur;
}

/** Construit le graphe positionné du circuit. */
export function construireGraphe(transitions: Record<string, string[]> = ALLOWED_TRANSITIONS): GrapheWorkflow {
  const arrivees = entrantes(transitions);
  const niveaux = profondeurs(transitions);
  const statuts = Object.keys(arrivees);

  const couloirDe = (statut: string): string => getModuleForStatus(statut) || 'transverse';

  const couloirsUtilises = ORDRE_COULOIRS.filter((couloir) =>
    statuts.some((statut) => couloirDe(statut) === couloir)
  );

  const couloirs: CouloirWorkflow[] = couloirsUtilises.map((couloir, index) => ({
    id: String(couloir),
    label: couloir === 'transverse' ? 'Transverse' : MODULE_LABELS[couloir as WorkflowModule],
    couleur: COULEURS_COULOIR[String(couloir)] || COULEURS_COULOIR.transverse,
    y: MARGE_HAUT + index * HAUTEUR_LIGNE,
    hauteur: HAUTEUR_LIGNE,
  }));

  const indexCouloir = new Map(couloirs.map((couloir, index) => [couloir.id, index]));

  const noeuds: NoeudWorkflow[] = statuts
    .map((statut) => {
      const couloir = couloirDe(statut);
      const couloirId = String(couloir);
      const ligne = indexCouloir.get(couloirId) ?? couloirs.length - 1;
      return {
        statut,
        libelle: formatStatusFr(statut),
        couloir: couloirId,
        couloirLabel: couloirs[ligne]?.label || 'Transverse',
        couleur: COULEURS_COULOIR[couloirId] || COULEURS_COULOIR.transverse,
        profondeur: niveaux[statut] ?? 0,
        transitions: transitions[statut] || [],
        entrantes: arrivees[statut] || [],
        estInitial: (arrivees[statut] || []).length === 0,
        estFinal: (transitions[statut] || []).length === 0,
        x: MARGE_GAUCHE + (niveaux[statut] ?? 0) * LARGEUR_COLONNE,
        y: MARGE_HAUT + ligne * HAUTEUR_LIGNE + HAUTEUR_LIGNE / 2,
      };
    })
    .sort((a, b) => a.profondeur - b.profondeur || a.libelle.localeCompare(b.libelle, 'fr'));

  const liens: LienWorkflow[] = Object.entries(transitions).flatMap(([source, cibles]) =>
    cibles.map((cible) => ({ id: `${source}->${cible}`, de: source, vers: cible }))
  );

  const profondeurMax = Math.max(0, ...Object.values(niveaux));

  return {
    noeuds,
    liens,
    couloirs,
    largeur: MARGE_GAUCHE + (profondeurMax + 1) * LARGEUR_COLONNE + 40,
    hauteur: MARGE_HAUT + couloirs.length * HAUTEUR_LIGNE + MARGE_HAUT,
  };
}
