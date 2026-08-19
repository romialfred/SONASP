import { describe, expect, it } from 'vitest';
import { ALL_GROUPS, NAVIGATION_SECTIONS } from './sidebarNavigation';

/**
 * Aucun intitulé de la barre latérale ne doit passer sur deux lignes.
 *
 * jsdom ne calcule pas de mise en page : ce garde-fou reconstitue la largeur du
 * texte à partir des avances de la police Inter, relevées dans le navigateur à
 * 100 px puis ramenées à 1 px. Le contrôle croisé face à `measureText` donnait un
 * écart maximal de 1,3 px sur les intitulés existants — la marge de 10 px retenue
 * l'absorbe largement.
 */
const AVANCES: Record<string, number> = {
  ' ': 0.27, "'": 0.31, '’': 0.31, '-': 0.46,
  A: 0.71, B: 0.66, C: 0.73, D: 0.72, E: 0.6, F: 0.59, I: 0.27, L: 0.57, M: 0.91,
  N: 0.76, O: 0.77, P: 0.64, R: 0.65, S: 0.65, T: 0.65, U: 0.74, V: 0.71,
  a: 0.57, b: 0.62, c: 0.58, d: 0.62, e: 0.59, f: 0.38, g: 0.62, h: 0.6, i: 0.25,
  j: 0.25, k: 0.56, l: 0.25, m: 0.89, n: 0.6, o: 0.6, p: 0.62, r: 0.39, s: 0.54,
  t: 0.34, u: 0.6, v: 0.57, x: 0.56, y: 0.58, ç: 0.58, è: 0.59, é: 0.59,
};

/** Avance la plus large du relevé : valeur de repli, jamais optimiste. */
const AVANCE_MAX = Math.max(...Object.values(AVANCES));

export function largeurTexte(libelle: string, taille: number): number {
  return Array.from(libelle).reduce((total, caractere) => total + (AVANCES[caractere] ?? AVANCE_MAX) * taille, 0);
}

/**
 * Largeurs disponibles pour le texte, relevées dans le navigateur sur la barre
 * réelle à 268 px : gouttière d'ascenseur, marges, pastille d'icône et signe de
 * dépliage déduits.
 */
const BUDGETS = {
  /** Groupe dépliable : la pastille d'icône et le signe +/− encadrent l'intitulé. */
  groupeAvecSigne: 149,
  /** Entrée sans sous-menu : pas de signe de dépliage, donc 26 px de plus. */
  lienSansSigne: 175,
  /** Entrée de sous-menu : indentée, précédée d'une puce, en 12 px. */
  enfant: 169,
};

const MARGE = 10;

describe('intitulés de la barre latérale', () => {
  it('tient sur une ligne pour chaque groupe dépliable', () => {
    const trop = ALL_GROUPS.filter((groupe) => groupe.children?.length).filter(
      (groupe) => largeurTexte(groupe.label, 13) > BUDGETS.groupeAvecSigne - MARGE
    );
    expect(trop.map((groupe) => groupe.label)).toEqual([]);
  });

  it('tient sur une ligne pour chaque entrée sans sous-menu', () => {
    const trop = ALL_GROUPS.filter((groupe) => !groupe.children?.length).filter(
      (groupe) => largeurTexte(groupe.label, 13) > BUDGETS.lienSansSigne - MARGE
    );
    expect(trop.map((groupe) => groupe.label)).toEqual([]);
  });

  it('tient sur une ligne pour chaque entrée de sous-menu', () => {
    const enfants = ALL_GROUPS.flatMap((groupe) => groupe.children || []);
    const trop = enfants.filter((item) => largeurTexte(item.label, 12) > BUDGETS.enfant - MARGE);
    expect(trop.map((item) => item.label)).toEqual([]);
  });

  it('mesure bien les intitulés connus', () => {
    // Valeurs relevées au canvas dans le navigateur : 147 px et 159 px.
    expect(Math.round(largeurTexte('Rapports institutionnels', 13))).toBe(147);
    expect(Math.round(largeurTexte("Vue d'ensemble des ventes", 12))).toBe(159);
  });
});

describe('section « Rapports et analyses »', () => {
  const section = NAVIGATION_SECTIONS.find((item) => item.id === 'analytics');

  it('porte les intitulés retenus', () => {
    expect(section?.groups.map((groupe) => groupe.label)).toEqual([
      'Analyses des ventes',
      'Rapports de production',
      'Assistant IA',
      'Rapports institutionnels',
      'Performance nationale',
    ]);
  });

  it('ne présente aucun sous-menu', () => {
    // Sans enfant, ces entrées sont des liens : un signe de dépliage y promettrait
    // un repli qui n'existe pas.
    expect(section?.groups.every((groupe) => !groupe.children)).toBe(true);
  });
});

describe('navigation', () => {
  it("n'expose qu'un seul intitulé « Tableau de bord »", () => {
    // Celui de la barre, hors sections, qui mène à la vue nationale.
    const doublons = ALL_GROUPS.flatMap((groupe) => [groupe, ...(groupe.children || [])]).filter(
      (item) => item.label === 'Tableau de bord'
    );
    expect(doublons).toEqual([]);
  });

  it("ne pointe jamais deux entrées d'une même section vers la même route", () => {
    // Le contrôle est propre à chaque section : `/sales` et `/reports` sont
    // volontairement atteignables depuis « Mines industrielles » et depuis
    // « Rapports et analyses », qui répondent à deux usages distincts.
    const doublons = NAVIGATION_SECTIONS.flatMap((section) => {
      const routes = section.groups.flatMap((groupe) =>
        groupe.children?.length ? groupe.children.map((item) => item.path) : [groupe.path]
      );
      return routes.filter((route, index) => routes.indexOf(route) !== index);
    });
    expect(doublons).toEqual([]);
  });
});
