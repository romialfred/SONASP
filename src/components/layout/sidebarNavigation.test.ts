import { describe, expect, it } from 'vitest';
import type { UserProfile } from '@/types/auth';
import {
  ALL_GROUPS,
  DGI_NAVIGATION_SECTIONS,
  NAVIGATION_SECTIONS,
  getNavigationSectionsForUser,
} from './sidebarNavigation';
import { CAPABILITIES } from '@/lib/capabilities';
import { routePolicyFor } from '@/lib/routeAccessRegistry';

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
  it('retire les ventes de collecte du module Artisans miniers', () => {
    const artisans = NAVIGATION_SECTIONS.flatMap((section) => section.groups)
      .find((group) => group.id === 'artisans');
    const routes = artisans?.children?.map((item) => item.path);
    expect(routes).not.toContain('/collecte/ventes');
    expect(routes).toContain('/artisan-minier/collecteurs');
    expect(routes).toContain('/artisan-minier/comptoirs');
  });

  it('réserve l’ellipse et l’infobulle aux intitulés métier volontairement longs', () => {
    const trop = ALL_GROUPS.filter((groupe) => groupe.children?.length).filter(
      (groupe) => largeurTexte(groupe.label, ['market', 'sales'].includes(groupe.id) ? 12 : 13)
        > BUDGETS.groupeAvecSigne - MARGE
    );
    expect(trop.map((groupe) => groupe.label)).toEqual([
      'Gestion de la production',
      'Achat aux mines industrielles',
      'Gestion des expéditions',
      'Réserve nationale d’or',
      'Ventes d’or internationales',
    ]);
  });

  it('tient sur une ligne pour chaque entrée sans sous-menu', () => {
    const trop = ALL_GROUPS.filter((groupe) => !groupe.children?.length).filter(
      (groupe) => largeurTexte(groupe.label, groupe.id === 'dgmg-productions' ? 12 : 13)
        > BUDGETS.lienSansSigne - MARGE
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
  it('suit la chaîne de valeur sans doublon entre les sections métier', () => {
    expect(NAVIGATION_SECTIONS.slice(0, 6).map((section) => section.id)).toEqual([
      'semi-mecanise',
      'industrielles',
      'vente-achat-or',
      'raffinage-stocks',
      'reserve-or-burkina',
      'vente-internationale',
    ]);
    expect(NAVIGATION_SECTIONS.find((section) => section.id === 'industrielles')?.groups.map((group) => group.id)).toEqual([
      'previsions-licences', 'production', 'achats-industriels', 'shipping',
    ]);
    expect(NAVIGATION_SECTIONS.find((section) => section.id === 'semi-mecanise')?.groups.map((group) => group.id))
      .not.toContain('marche-artisanal');
    expect(NAVIGATION_SECTIONS.find((section) => section.id === 'vente-achat-or')?.groups.map((group) => group.id))
      .toEqual(['marche-artisanal']);
    expect(ALL_GROUPS.find((group) => group.id === 'marche-artisanal')?.children?.map((item) => item.label))
      .toEqual(['Vue d’ensemble', 'Achat d’or local', 'Paiements']);
  });

  it('garde le pilotage des comptes dans le module achats et dans le registre RBAC', () => {
    const purchases = ALL_GROUPS.find((group) => group.id === 'achats-industriels');
    const overview = purchases?.children?.find((item) => item.path === '/achats/comptes-paiements');

    expect(overview).toEqual(expect.objectContaining({
      label: 'Vue d’ensemble',
      category: 'Suivi des comptes & paiements',
    }));
    expect(routePolicyFor('/achats/comptes-paiements')).toBeDefined();
  });

  it('projette tous les modules pour le Owner actif malgré un périmètre serveur vide', () => {
    const owner = {
      id: 'owner-user', email: 'owner@example.bf', full_name: 'Owner SONASP', phone: null,
      role: 'owner', mining_company_id: null, site_ids: [], is_active: true,
      module_domains: [], capabilities: [], is_sales_approver: false, two_factor_enabled: true,
      language: 'fr', email_notifications: true, batch_notifications: true,
      approval_notifications: true, created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;
    const sections = getNavigationSectionsForUser(owner);
    const routes = sections.flatMap((section) => section.groups.flatMap((group) => [
      group.path,
      ...(group.children?.map((item) => item.path) || []),
    ]));

    expect(sections.map((section) => section.id)).toEqual(expect.arrayContaining(
      NAVIGATION_SECTIONS.map((section) => section.id),
    ));
    expect(routes).toEqual(expect.arrayContaining([
      '/artisan-sites', '/conciliation', '/production/daily', '/users', '/admin/messagerie',
      '/national-reserve',
    ]));
  });

  it('sépare les stocks opérationnels de la Réserve nationale', () => {
    const inventory = ALL_GROUPS.find((group) => group.id === 'inventory');
    const reserve = ALL_GROUPS.find((group) => group.id === 'national-reserve');

    expect(inventory?.label).toBe('Suivi du stock d’or');
    expect(reserve?.label).toBe('Réserve nationale d’or');
    expect(reserve?.children).toContainEqual(expect.objectContaining({
      label: 'Affectations à la réserve',
      path: '/national-reserve/allocations',
      catalogCode: 'inventory-allocations',
    }));
  });

  it('applique les bascules du catalogue aux sous-modules des profils non Owner', () => {
    const admin = {
      id: 'admin-catalog', email: 'admin.catalog@example.bf', full_name: 'Admin Catalogue', phone: null,
      role: 'admin', mining_company_id: null, site_ids: [], is_active: true,
      module_codes: ['gold_inventory', 'national_reserve'],
      capabilities: [], is_sales_approver: false, two_factor_enabled: true, language: 'fr',
      email_notifications: true, batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;
    const enabled = { isActive: true, isVisibleInMenu: true };
    const hidden = { isActive: true, isVisibleInMenu: false };
    const sections = getNavigationSectionsForUser(admin, {
      gold_inventory: enabled,
      'inventory-overview': enabled,
      'inventory-silver': hidden,
      'inventory-new-entry': enabled,
      national_reserve: enabled,
      'reserve-overview': enabled,
      'inventory-allocations': enabled,
      'inventory-physical': enabled,
      'inventory-controls': hidden,
      'inventory-valuation': enabled,
      'inventory-audit': enabled,
    });
    const paths = sections.flatMap((section) => section.groups.flatMap((group) => (
      group.children?.map((item) => item.path) || [group.path]
    )));

    expect(paths).toContain('/inventory/add');
    expect(paths).toContain('/national-reserve/physical');
    expect(paths).not.toContain('/inventory/silver');
    expect(paths).not.toContain('/national-reserve/controls');
  });

  it.each(['absent', 'désactivé', 'masqué'] as const)(
    'conserve tous les modules et sous-modules au Owner avec un catalogue %s',
    (state) => {
      const owner = {
        id: 'owner-catalog', email: 'owner.catalog@example.bf', full_name: 'Owner Catalogue', phone: null,
        role: 'owner', mining_company_id: null, site_ids: [], is_active: true,
        module_codes: [], module_domains: [], capabilities: [], is_sales_approver: false,
        two_factor_enabled: true, language: 'fr', email_notifications: true,
        batch_notifications: true, approval_notifications: true,
        created_at: '2026-01-01', updated_at: '2026-01-01',
      } satisfies UserProfile;
      const expected = getNavigationSectionsForUser(owner);
      const codes = expected.flatMap((section) => section.groups.flatMap((group) => [
        group.moduleCode,
        ...(group.children?.map((item) => item.catalogCode) || []),
      ])).filter((code): code is string => Boolean(code));
      const availability = state === 'absent' ? {} : Object.fromEntries(codes.map((code) => [
        code, { isActive: state !== 'désactivé', isVisibleInMenu: state !== 'masqué' },
      ]));

      expect(getNavigationSectionsForUser(owner, availability)).toEqual(expected);
      expect(expected.flatMap((section) => section.groups).find((group) => group.id === 'national-reserve')
        ?.children).toHaveLength(6);
      expect(getNavigationSectionsForUser({ ...owner, is_active: false }, availability)).toEqual([]);
    },
  );

  it.each([
    ['dgmg', 'dgmg.supervise', 'dgmg-organization', 'dgmg', ['dashboard', 'mining_sites'], ['/portail-dgmg', '/artisan-sites', '/stakeholders/mining-companies', '/stakeholders/organizations']],
    ['dgi', 'dgi.fiscal.control', 'dgi-organization', 'dgi', ['dashboard', 'conciliation'], ['/portail-dgi', '/conciliation', '/conciliation/regles-fiscales']],
  ] as const)(
    'projette pour %s uniquement les modules institutionnels attribués',
    (role, capability, organizationId, organizationType, moduleCodes, expectedRoutes) => {
      const institutionalUser = {
        id: `${role}-user`, email: `${role}@example.bf`, full_name: role.toUpperCase(), phone: null,
        role, mining_company_id: null, organization_id: organizationId,
        organization_type: organizationType, site_ids: [], is_active: true,
        capabilities: [capability], module_codes: [...moduleCodes],
        is_sales_approver: false, two_factor_enabled: true, language: 'fr',
        email_notifications: true, batch_notifications: true, approval_notifications: true,
        created_at: '2026-01-01', updated_at: '2026-01-01',
      } satisfies UserProfile;
      const routes = getNavigationSectionsForUser(institutionalUser)
        .flatMap((section) => section.groups.map((group) => group.path));

      expect(routes).toEqual(expectedRoutes);
    },
  );

  it('structure le portail DGI selon le contrôle, les recettes et le rapprochement', () => {
    expect(DGI_NAVIGATION_SECTIONS.map((section) => section.title)).toEqual([
      'Contrôle fiscal', 'Paiements & recettes', 'Rapprochement',
    ]);
    expect(DGI_NAVIGATION_SECTIONS.map((section) => section.groups.map((group) => group.label))).toEqual([
      ['Vue fiscale', 'Productions', 'Ventes déclarées'],
      ['Paiements fiscaux', 'Taxes et redevances'],
      ['Conciliations', 'Règles fiscales'],
    ]);
  });

  it('affiche la validation Réserve DGMG seulement avec le module et la capability dédiés', () => {
    const validator = {
      id: 'dgmg-validator', email: 'validator@dgmg.bf', full_name: 'Validateur DGMG', phone: null,
      role: 'dgmg', mining_company_id: null, organization_id: 'dgmg-organization',
      organization_type: 'dgmg', site_ids: [], is_active: true,
      capabilities: [CAPABILITIES.DGMG_SUPERVISE, CAPABILITIES.RESERVE_ALLOCATIONS_VALIDATE_LEVEL_1],
      module_codes: ['dashboard', 'national_reserve'], is_sales_approver: false,
      two_factor_enabled: true, language: 'fr', email_notifications: true,
      batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;

    const routes = getNavigationSectionsForUser(validator)
      .flatMap((section) => section.groups.map((group) => group.path));
    expect(routes).toContain('/portail-dgmg/reserve-validations');
    expect(routes).not.toContain('/national-reserve');
  });

  it('ne construit aucun menu institutionnel pour une organisation incompatible', () => {
    const dgiDansDgmg = {
      id: 'dgi-user', email: 'dgi@example.bf', full_name: 'Agent DGI', phone: null,
      role: 'dgi', mining_company_id: null, organization_id: 'dgmg-organization',
      organization_type: 'dgmg', site_ids: [], is_active: true,
      capabilities: [CAPABILITIES.DGI_FISCAL_CONTROL], module_codes: ['dashboard'],
      is_sales_approver: false, two_factor_enabled: true, language: 'fr',
      email_notifications: true, batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;

    expect(getNavigationSectionsForUser(dgiDansDgmg)).toEqual([]);
  });

  it('organise la vente internationale et ses parties prenantes', () => {
    const marche = ALL_GROUPS.find((group) => group.id === 'market');
    const ventes = ALL_GROUPS.find((group) => group.id === 'sales');
    const partiesPrenantes = ALL_GROUPS.find((group) => group.id === 'stakeholders');

    expect(marche?.label).toBe('Marchés internationaux');
    expect(ventes?.label).toBe('Ventes d’or internationales');
    expect(ventes?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Ventes', path: '/sales' }),
      expect.objectContaining({ label: 'Paiements', path: '/payments' }),
      expect.objectContaining({ label: 'Dossiers de conciliation', path: '/conciliation', moduleCode: 'conciliation' }),
    ]));
    expect(ventes?.children?.map((item) => item.path)).not.toContain('/customers');
    expect(partiesPrenantes?.children).toContainEqual(
      expect.objectContaining({ label: 'Clients internationaux', path: '/customers' })
    );
  });

  it('conserve la conciliation selon son propre module quand le module ventes est masqué', () => {
    const user = {
      id: 'conciliation-admin', email: 'conciliation@example.bf', full_name: 'Conciliation', phone: null,
      role: 'admin', mining_company_id: null, site_ids: [], is_active: true,
      module_codes: ['conciliation'], capabilities: [CAPABILITIES.RECONCILIATION_READ],
      is_sales_approver: false, two_factor_enabled: true, language: 'fr',
      email_notifications: true, batch_notifications: true, approval_notifications: true,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } satisfies UserProfile;
    const sales = getNavigationSectionsForUser(user, {
      sales: { isActive: true, isVisibleInMenu: false },
      conciliation: { isActive: true, isVisibleInMenu: true },
    }).flatMap((section) => section.groups).find((group) => group.id === 'sales');

    expect(sales?.path).toBe('/conciliation');
    expect(sales?.children?.map((item) => item.path)).toEqual([
      '/conciliation', '/conciliation/regles-fiscales',
    ]);
  });

  it('supprime l’ancien écran Approbateurs au profit du wizard utilisateurs', () => {
    const partiesPrenantes = ALL_GROUPS.find((group) => group.id === 'stakeholders');
    const administration = ALL_GROUPS.find((group) => group.id === 'administration');

    expect(partiesPrenantes?.children?.map((item) => item.label)).not.toContain('Approbateurs');
    expect(partiesPrenantes?.children?.map((item) => item.path)).not.toContain('/stakeholders/approvers');
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

  it('ne duplique aucune destination fonctionnelle dans la navigation nationale', () => {
    const routes = NAVIGATION_SECTIONS.flatMap((section) => section.groups.flatMap((group) => (
      group.children?.length ? group.children.map((item) => item.path) : [group.path]
    )));
    expect(routes.filter((route, index) => routes.indexOf(route) !== index)).toEqual([]);
  });

  it('regroupe la prévision annuelle et le forecast dans une seule entrée', () => {
    const previsions = ALL_GROUPS.find((group) => group.id === 'previsions-licences');
    const planification = previsions?.children?.filter((item) =>
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

    expect(sections.map((section) => section.id)).toEqual([
      'industrielles', 'raffinage-stocks', 'vente-internationale', 'analytics',
    ]);
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
    expect(routes).toContain('/collecte/ventes');
    expect(routes).toContain('/artisan-minier/rapports/taxes');
    expect(routes).toContain('/portail-comptoir/stock');
    expect(routes).toContain('/portail-comptoir/ventes-sonasp');
    expect(routes).not.toContain('/sales');
    expect(routes).not.toContain('/gold-prices');
    expect(routes).not.toContain('/production/licenses');
  });

  it('projette un menu Collecteur local avec circuit de collecte et sans vente internationale', () => {
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
      '/portail-collecteur', '/artisan-minier/liste', '/collecte/ventes',
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

describe('navigation de la boîte Mine → SONASP', () => {
  const profile = (capabilities: string[] | undefined): UserProfile => ({
    id: 'sonasp-license-user', email: 'licences@sonasp.bf', full_name: 'Agent licences', phone: null,
    role: 'management', mining_company_id: null, site_ids: [], is_active: true,
    capabilities, is_sales_approver: false, two_factor_enabled: true, language: 'fr',
    email_notifications: true, batch_notifications: true, approval_notifications: true,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  });
  const paths = (user: UserProfile) => getNavigationSectionsForUser(user)
    .flatMap((section) => section.groups.flatMap((group) => [
      group.path,
      ...(group.children?.map((item) => item.path) || []),
    ]));

  it('affiche la boîte uniquement avec la capability AAL2 autoritative', () => {
    expect(paths(profile([CAPABILITIES.SONASP_APPROVE])))
      .toContain('/production/licenses/requests');
    expect(paths(profile([CAPABILITIES.SONASP_PREPARE])))
      .not.toContain('/production/licenses/requests');
    expect(paths(profile(undefined)))
      .not.toContain('/production/licenses/requests');
  });
});

describe('navigation des profils partenaires', () => {
  const partner = (
    role: UserProfile['role'],
    capabilities: string[],
    miningCompanyId: string | null = null,
  ): UserProfile => ({
    id: `${role}-partner`, email: `${role}@partner.bf`, full_name: role, phone: null,
    role, mining_company_id: miningCompanyId, site_ids: [], is_active: true,
    capabilities, is_sales_approver: false, two_factor_enabled: true, language: 'fr',
    email_notifications: true, batch_notifications: true, approval_notifications: true,
    created_at: '2026-01-01', updated_at: '2026-01-01',
  });
  const partners = [
    partner('mine', [CAPABILITIES.MINE_OPERATE], '9b3fcaaa-9367-4c91-a82d-788f043f33f1'),
    partner('customer', [CAPABILITIES.COMPTOIR_MANAGE]),
    partner('customer', [CAPABILITIES.COMPTOIR_MANAGE, CAPABILITIES.COLLECTOR_OPERATE]),
    partner('factory', [CAPABILITIES.FACTORY_OPERATE]),
    partner('airport', [CAPABILITIES.AIRPORT_OPERATE]),
    partner('refinery', [CAPABILITIES.REFINERY_OPERATE]),
    partner('customer', [CAPABILITIES.CUSTOMER_OPERATE]),
  ];

  it.each(partners)('ne présente aucune entrée nationale par défaut au profil $role/$id', (user) => {
    const routes = getNavigationSectionsForUser(user).flatMap((section) =>
      section.groups.flatMap((group) => [group.path, ...(group.children?.map((item) => item.path) || [])])
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => routePolicyFor(route)?.national)).toEqual([]);
  });

  it('ne présente rien pour un rôle inconnu ou un partenaire désactivé', () => {
    expect(getNavigationSectionsForUser({
      ...partners[0], role: 'unknown-role' as UserProfile['role'],
    })).toEqual([]);
    expect(getNavigationSectionsForUser({ ...partners[0], is_active: false })).toEqual([]);
  });
});
