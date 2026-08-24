import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import { ALL_GROUPS, NAVIGATION_SECTIONS, getNavigationSectionsForUser } from './sidebarNavigation';

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
      (groupe) => largeurTexte(groupe.label, ['market', 'sales'].includes(groupe.id) ? 12 : 13)
        > BUDGETS.groupeAvecSigne - MARGE
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
  it('organise la vente internationale et ses parties prenantes', () => {
    const marche = ALL_GROUPS.find((group) => group.id === 'market');
    const ventes = ALL_GROUPS.find((group) => group.id === 'sales');
    const partiesPrenantes = ALL_GROUPS.find((group) => group.id === 'stakeholders');

    expect(marche?.label).toBe('Marchés internationaux');
    expect(ventes?.label).toBe('Vente d’or international');
    expect(ventes?.children).toEqual([
      expect.objectContaining({ label: 'Ventes', path: '/sales' }),
      expect.objectContaining({ label: 'Paiements', path: '/payments' }),
    ]);
    expect(ventes?.children?.map((item) => item.path)).not.toContain('/customers');
    expect(partiesPrenantes?.children).toContainEqual(
      expect.objectContaining({ label: 'Clients internationaux', path: '/customers' })
    );
  });

  it('place les Approbateurs uniquement dans Parties prenantes', () => {
    const partiesPrenantes = ALL_GROUPS.find((group) => group.id === 'stakeholders');
    const administration = ALL_GROUPS.find((group) => group.id === 'administration');

    expect(partiesPrenantes?.children?.map((item) => item.label)).toContain('Approbateurs');
    expect(administration?.children?.map((item) => item.label)).not.toContain('Approbations');
    expect(administration?.children?.map((item) => item.path)).not.toContain('/approvals');
  });

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

  it('regroupe la prévision annuelle et le forecast dans une seule entrée', () => {
    const production = ALL_GROUPS.find((group) => group.id === 'production');
    const planification = production?.children?.filter((item) =>
      item.path === '/performance/budgets' || item.path === '/performance/forecasts'
    );

    expect(planification).toEqual([
      expect.objectContaining({
        label: 'Prévisions & Forecast',
        path: '/performance/budgets',
      }),
    ]);
  });

  it('projette pour une mine les modules industriels sans Achats aux mines', () => {
    const mine = {
      id: 'mine-user', email: 'mine@example.bf', full_name: 'Mine Exemple', phone: null,
      role: 'mine', mining_company_id: 'mine-1', site_ids: [], is_active: true,
      is_sales_approver: false, two_factor_enabled: true, language: 'fr',
      email_notifications: true, batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;
    const sections = getNavigationSectionsForUser(mine);
    const routes = sections.flatMap((section) => section.groups.flatMap((group) =>
      group.children?.map((item) => item.path) || [group.path]
    ));

    expect(sections.map((section) => section.id)).toEqual(['industrielles']);
    expect(routes).toContain('/production/daily');
    expect(routes).toContain('/shipping/preparation');
    expect(routes).toContain('/sales');
    expect(routes).toContain('/customers');
    expect(routes).toContain('/stakeholders/depositors');
    expect(routes).not.toContain('/production/achats-mines');
    expect(routes).not.toContain('/inventory/add');
  });

  it('projette pour un comptoir uniquement collecte, DGI, taxes, stock et SONASP', () => {
    const comptoir = {
      id: 'counter-user', email: 'counter@example.bf', full_name: 'Comptoir Exemple', phone: null,
      role: 'customer', mining_company_id: null, site_ids: [], is_active: true,
      capabilities: ['customer.operate', 'comptoir.manage'],
      is_sales_approver: false, two_factor_enabled: true, language: 'fr',
      email_notifications: true, batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;
    const sections = getNavigationSectionsForUser(comptoir);
    const routes = sections.flatMap((section) => section.groups.flatMap((group) =>
      group.children?.map((item) => item.path) || [group.path]
    ));

    expect(sections.map((section) => section.id)).toEqual([
      'comptoir-collecte', 'comptoir-conformite', 'comptoir-stock', 'comptoir-analyses',
    ]);
    expect(routes).toContain('/artisan-minier/ventes-or');
    expect(routes).toContain('/artisan-minier/rapports/taxes');
    expect(routes).toContain('/portail-comptoir/stock');
    expect(routes).toContain('/portail-comptoir/ventes-sonasp');
    expect(routes).not.toContain('/sales');
    expect(routes).not.toContain('/gold-prices');
    expect(routes).not.toContain('/production/licenses');
  });

  it('projette un menu Collecteur local, consultatif et sans vente internationale', () => {
    const collector = {
      id: 'collector-user', email: 'collector@example.bf', full_name: 'Collecteur Exemple', phone: null,
      role: 'customer', mining_company_id: null, site_ids: [], is_active: true,
      capabilities: ['collector.operate', 'comptoir.manage'],
      is_sales_approver: false, two_factor_enabled: true, language: 'fr',
      email_notifications: true, batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;
    const sections = getNavigationSectionsForUser(collector);
    const routes = sections.flatMap((section) => section.groups.flatMap((group) =>
      group.children?.map((item) => item.path) || [group.path]
    ));

    expect(sections.map((section) => section.id)).toEqual(['collecteur-collecte', 'collecteur-suivi']);
    expect(routes).toEqual(expect.arrayContaining([
      '/portail-collecteur', '/artisan-minier/liste', '/artisan-minier/ventes-or',
      '/portail-collecteur/stock', '/artisan-minier/paiements/historique',
      '/artisan-minier/rapports/taxes', '/portail-collecteur/documents',
    ]));
    expect(routes).not.toContain('/artisan-minier/ventes-or/nouvelle');
    expect(routes).not.toContain('/portail-comptoir/ventes-sonasp');
    expect(routes).not.toContain('/sales');
    expect(routes).not.toContain('/gold-prices');
  });
});

describe('navigation de la boîte Comptoir → SONASP', () => {
  const profile = (capabilities: string[]): UserProfile => ({
    id: 'sonasp-user', email: 'agent@sonasp.bf', full_name: 'Agent SONASP', phone: null,
    role: 'management', mining_company_id: null, site_ids: [], is_active: true,
    capabilities, is_sales_approver: false, two_factor_enabled: true, language: 'fr',
    email_notifications: true, batch_notifications: true, approval_notifications: true,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  });
  const paths = (user: UserProfile) => getNavigationSectionsForUser(user)
    .flatMap((section) => section.groups.map((group) => group.path));

  it('affiche la boîte aux agents SONASP opérationnels uniquement', () => {
    expect(paths(profile(['sonasp.prepare']))).toContain('/sonasp/cessions-comptoirs');
    expect(paths(profile(['reports.read']))).not.toContain('/sonasp/cessions-comptoirs');
  });

  it('ne remplace jamais le menu dédié du comptoir', () => {
    const comptoir = profile(['comptoir.manage', 'sonasp.approve']);
    comptoir.role = 'customer';
    expect(paths(comptoir)).toContain('/portail-comptoir/ventes-sonasp');
    expect(paths(comptoir)).not.toContain('/sonasp/cessions-comptoirs');
  });
});
