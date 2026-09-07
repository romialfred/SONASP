/**
 * Inventaire reproductible du code existant, sans navigateur, accès réseau ou écriture métier.
 * node docs/amelioration/outils/inventaire.mjs [--check]
 *
 * Important : les sorties sont des DETECTIONS STATIQUES, jamais une recette.
 * Le graphe d'imports sur-approxime les consommateurs ; les variantes locales
 * et conditions de rendu doivent encore être inspectées puis exécutées en UI.
 * Les identifiants sont dérivés des chemins/syntaxes, pas des numéros de ligne.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.join(root, 'docs/amelioration');
const baseline = '83f8c74e';
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const slash = (value) => value.replaceAll('\\', '/');
const rel = (file) => slash(path.relative(root, file));
const clean = (text) => text.replace(/\s+/gu, ' ').trim();
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
const id = (prefix, text) => `${prefix}-${hash(text)}`;
const unique = (values) => [...new Set(values)].sort();
const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = (rows, columns) => '\uFEFF' + [columns.map(quote).join(','), ...rows.map((row) => columns.map((c) => quote(Array.isArray(row[c]) ? unique(row[c]).join(' | ') : row[c])).join(','))].join('\n') + '\n';
const check = process.argv.includes('--check');
function write(name, rows, columns) {
  const content = csv(rows, columns);
  const file = path.join(out, name);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw new Error(`Inventaire périmé : ${name}`);
  } else fs.writeFileSync(file, content, 'utf8');
}

// Exécution en mémoire des fonctions pures du registre local (aucun service/API).
const compiled = await build({
  stdin: { contents: `export * from './src/lib/routeAccessRegistry'; export * from './src/lib/capabilities'; export * from './src/lib/platformModuleCatalog'; export * from './src/components/layout/portalThemes';`, resolveDir: root, sourcefile: 'inventory-entry.ts', loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', alias: { '@': path.join(root, 'src') },
});
const registry = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const policies = registry.PRIVATE_ROUTE_REGISTRY;
const accountTypes = Object.keys(registry.PORTAL_THEMES).filter((a) => a !== 'unknown');
const roleFor = { sonasp: 'management', direction: 'manager' };
const catalog = registry.PLATFORM_MODULE_CATALOG;
const adminCandidate = { role: 'admin', is_active: true, module_codes: catalog.map((m) => m.code), capabilities: Object.values(registry.CAPABILITIES) };
const candidateAccounts = (policy) => unique(['owner', ...policy.accountTypes, ...(registry.evaluatePrivateRouteAccess(adminCandidate, policy.route.replace(/:[^/]+/gu, 'identifiant-test').replace(/\/\*$/u, '')).allowed ? ['admin'] : [])]);

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(file) : /\.(tsx?|jsx?)$/u.test(file) && !/\.(test|spec)\./u.test(file) && !/\.d\.ts$/u.test(file) ? [file] : [];
  });
}
const files = walkFiles(path.join(root, 'src')).sort();
const sources = new Map(files.map((file) => [file, ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)]));
function visit(node, callback) { callback(node); ts.forEachChild(node, (child) => visit(child, callback)); }
const line = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const source = (sf, node) => `${rel(sf.fileName)}:${line(sf, node)}`;
const opening = (node) => ts.isJsxElement(node) ? node.openingElement : node;
const tag = (node) => opening(node).tagName.getText();
const attr = (node, name) => opening(node).attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
const attrText = (node, name) => attr(node, name)?.initializer?.getText() ?? (attr(node, name) ? 'true' : '');
function literal(node) {
  if (!node) return '';
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isJsxExpression(node)) return literal(node.expression);
  if (ts.isCallExpression(node) && node.arguments.length) return literal(node.arguments[0]);
  return '';
}
function resolveImport(from, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null;
  const base = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
  return [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')].find((p) => sources.has(p)) ?? null;
}
const imports = new Map();
const namedImports = new Map();
for (const [file, sf] of sources) {
  const imported = new Set();
  const named = new Map();
  visit(sf, (node) => {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const target = resolveImport(file, literal(node.moduleSpecifier));
      if (!target) return;
      imported.add(target);
      if (node.importClause?.name) named.set(node.importClause.name.text, target);
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) bindings.elements.filter((x) => !x.isTypeOnly).forEach((x) => named.set(x.name.text, target));
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
      visit(node.initializer, (child) => {
        if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const target = resolveImport(file, literal(child.arguments[0]));
          if (target) { imported.add(target); named.set(node.name.text, target); }
        }
      });
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const target = resolveImport(file, literal(node.moduleSpecifier));
      if (target) imported.add(target);
    }
  });
  imports.set(file, imported);
  namedImports.set(file, named);
}
const routes = [];
for (const filename of ['src/App.tsx', 'src/PrivateApp.tsx']) {
  const sf = sources.get(path.join(root, filename));
  visit(sf, (node) => {
    if ((!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) || tag(node) !== 'Route') return;
    const pathAttr = attr(node, 'path');
    const route = pathAttr ? literal(pathAttr.initializer) : attr(node, 'index') ? '/' : '';
    if (!route) return;
    const components = [];
    const guards = [];
    const element = attr(node, 'element')?.initializer;
    if (element) visit(element, (child) => {
      if (!ts.isJsxElement(child) && !ts.isJsxSelfClosingElement(child)) return;
      const name = tag(child);
      const target = namedImports.get(path.normalize(sf.fileName)).get(name);
      if (target && (rel(target).startsWith('src/pages/') || name === 'PrivateApp')) components.push({ name, file: target, props: clean(opening(child).attributes.getText()) });
      if (/ProtectedRoute|Guard|RegistryRoute/u.test(name)) guards.push(clean(opening(child).getText()));
    });
    const redirect = element && /Navigate\b|Redirect\b/u.test(element.getText()) && !components.length;
    const policy = registry.routePolicyFor(route.replaceAll(':', 'test-')) || policies.find((p) => p.route === route) || null;
    routes.push({ id: id('ECR', `${filename}|${route}`), route, filename, source: source(sf, node), components, guards, redirect, policy, method: 'AST_ROUTE', reviewed: false });
  });
}

// Les dix sections Direction sont des routes profondes interprétées sans <Route>.
const managerSf = sources.get(path.join(root, 'src/pages/manager/managerNavigation.ts'));
visit(managerSf, (node) => {
  if (!ts.isObjectLiteralExpression(node)) return;
  const prop = (name) => node.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === name)?.initializer;
  const section = literal(prop('id'));
  if (!section) return;
  const route = `/portail-direction/${section}`;
  routes.push({ id: id('ECR', `managerSection|${route}`), route, filename: rel(managerSf.fileName), source: source(managerSf, node), components: [{ name: `ManagerPortalPage:${section}`, file: path.join(root, 'src/pages/manager/ManagerPortalPage.tsx'), props: literal(prop('label')) }], guards: ['ProtectedRoute allowedRoles=manager hérité de /portail-direction/*'], redirect: false, policy: registry.routePolicyFor(route), method: 'AST_SECTION_DIRECTION', reviewed: true });
});

// Toute politique non directement déclarée demeure au dénominateur comme motif,
// à qualifier (alias de menu ou motif générique), jamais comme page UI validée.
for (const policy of policies) {
  if (routes.some((r) => r.route === policy.route)) continue;
  const sf = sources.get(path.join(root, 'src/lib/routeAccessRegistry.ts'));
  const position = sf.text.indexOf(`'${policy.route}'`);
  routes.push({ id: id('REG', policy.route), route: policy.route, filename: rel(sf.fileName), source: `${rel(sf.fileName)}:${sf.getLineAndCharacterOfPosition(position).line + 1}`, components: [], guards: [], redirect: false, policy, method: 'POLITIQUE_SANS_ROUTE_JSX_EXACTE', reviewed: false });
}

const moduleFor = (route) => registry.platformModuleCodeForPath(route) || (/^\/portail-direction/u.test(route) ? 'portal-direction' : /^\/portail-dgmg/u.test(route) ? 'portal-dgmg' : /^\/portail-dgi/u.test(route) ? 'portal-dgi' : /^\/portail-comptoir/u.test(route) ? 'portal-comptoir' : /^\/portail-collecteur/u.test(route) ? 'portal-collector' : /^\/portail-mine/u.test(route) ? 'portal-mine' : /login|password|mot-de-passe|activate-account|auth\/callback|recuperer-acces/u.test(route) ? 'authentification' : ['/profile', '/help'].includes(route) ? 'transverse' : 'public-et-alias');
const portalFor = (route) => route.policy ? candidateAccounts(route.policy) : route.filename === 'src/App.tsx' || moduleFor(route.route) === 'authentification' ? ['public'] : ['A_QUALIFIER'];
const ownerFor = (module) => ({ stakeholders: 'Lot référentiels (root pilote Clients)', administration: 'Lot administration et IAM', settings: 'Lot paramètres', 'artisan-minier': 'Lot artisans et affiliations', artisan_gold_market: 'Lot marché artisanal et paiements', mining_sites: 'Lot sites artisanaux', production: 'Lot production industrielle', gold_purchases: 'Lot achats et contrats', sales: 'Lot ventes internationales et paiements', shipping: 'Lot expéditions', refining: 'Lot raffinage', gold_inventory: 'Lot stocks', national_reserve: 'Lot réserve nationale', conciliation: 'Lot conciliation', dashboard: 'Lot pilotage national', documents: 'Lot documents' }[module] || `Lot ${module}`);
const uiReq = 'Master §§7–14 et annexe A : champs/actions existants, erreurs explicites, contexte autorisé, responsive, persistance et audit indépendants';
function screenType(route) {
  if (route.method === 'POLITIQUE_SANS_ROUTE_JSX_EXACTE') return 'MOTIF_AUTORISATION_A_QUALIFIER';
  if (route.route === '/*') return 'FRONTIERE_ROUTEUR';
  if (route.redirect) return 'REDIRECTION';
  if (/\/(new|nouveau|nouvelle|create|edit|modifier|record)(\/|$)/u.test(route.route)) return 'FORMULAIRE_ROUTE';
  if (/:[^/]+/u.test(route.route)) return 'DETAIL_ROUTE';
  if (/dashboard|portail/u.test(route.route) && !/\/(stock|documents|ventes-sonasp|paiements|reserve-validations)/u.test(route.route)) return 'DASHBOARD_OU_SECTION';
  if (/Form|Create|Wizard/u.test(route.components.map((c) => c.name).join(' '))) return 'FORMULAIRE_ROUTE';
  return 'PAGE_A_QUALIFIER';
}

// Imports métier transverses associés aux routes. Les primitives et le shell
// sont inventoriés séparément pour éviter de rendre chaque écran consommateur
// supposé de tous les modules par AuthContext/Sidebar/routeur.
const stop = /src\/(components\/(layout|ui|auth|common)|contexts|lib|services|hooks|utils|types)\//u;
const routeConsumers = new Map();
for (const route of routes) {
  const visited = new Set();
  function traverse(file) {
    if (visited.has(file)) return;
    visited.add(file);
    if (!routeConsumers.has(file)) routeConsumers.set(file, new Set());
    routeConsumers.get(file).add(route);
    if (stop.test(rel(file))) return;
    for (const dependency of imports.get(file) || []) if (dependency.endsWith('.tsx')) traverse(dependency);
  }
  route.components.forEach((c) => { if (c.name !== 'PrivateApp') traverse(c.file); });
}

const rows = [];
for (const route of routes) {
  const module = moduleFor(route.route);
  const componentSources = route.components.map((c) => `${rel(c.file)} (${c.name}; ${c.props || 'sans prop'})`);
  rows.push({ id: route.id, portail: portalFor(route), module, route: route.route, type: screenType(route), libelle: route.components.map((c) => c.name).join(' | ') || (route.redirect ? 'Redirection existante' : route.route), source: route.source, composants: componentSources, actions: 'Voir les lignes ACTION/FORMULAIRE/MODALE liées par routes_candidates', permissions: route.guards.join(' | '), politique_registre: route.policy ? JSON.stringify(route.policy) : 'Hors registre privé / à qualifier', defauts: 'NON_INSPECTE_EN_UI; absence de défaut démontrée impossible par inventaire', responsable: ownerFor(module), exigence_design: uiReq, methode: route.method, revue_statique: route.reviewed ? 'REVUE_STATIQUE_CIBLEE (sectionFromPath + navigation)' : 'DETECTION_AUTOMATIQUE_NON_REVUE', statut: 'À INVENTORIER', test_ui: 'NON EXÉCUTÉ', preuve_ui: '', baseline, version_source: commit });
}

const nodeOccurrences = new Map();
const candidates = [];
for (const [file, sf] of sources) {
  if (!file.endsWith('.tsx') || ['src/App.tsx', 'src/PrivateApp.tsx'].includes(rel(file))) continue;
  const consumers = [...(routeConsumers.get(file) || [])];
  const permissionCalls = [];
  visit(sf, (node) => {
    if (ts.isCallExpression(node) && /has.*(Permission|Capability)|can[A-Z]|isReadOnly|is.*ScopedUser/u.test(node.expression.getText())) permissionCalls.push(`${source(sf, node)} ${clean(node.getText()).slice(0, 220)}`);
  });
  const fileKind = /(?:Form|Wizard|Modal|Dialog|Details|Listing|Liste)(?:Page)?\.tsx$/u.test(file);
  if (fileKind) candidates.push({ type: /Modal|Dialog/u.test(path.basename(file)) ? 'COMPOSANT_MODALE' : /Form|Wizard/u.test(path.basename(file)) ? 'COMPOSANT_FORMULAIRE' : /Details/u.test(path.basename(file)) ? 'COMPOSANT_DETAIL' : 'COMPOSANT_LISTE', node: sf, name: path.basename(file, '.tsx'), label: path.basename(file, '.tsx'), handlers: '', file, sf, consumers, permissionCalls, method: 'NOM_COMPOSANT_CANDIDAT' });
  visit(sf, (node) => {
    if (!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    const name = tag(node);
    const role = literal(attr(node, 'role')?.initializer);
    const submit = attrText(node, 'onSubmit');
    const click = attrText(node, 'onClick');
    const actionHandler = submit || click || attrText(node, 'onConfirm') || attrText(node, 'onSave') || attrText(node, 'onSelect');
    let type;
    if (name === 'form') type = 'FORMULAIRE_HTML';
    else if (role === 'dialog' || /Modal$|Dialog$/u.test(name)) type = 'MODALE_JSX';
    else if (name === 'input' && literal(attr(node, 'type')?.initializer) === 'file') type = 'SOUS_FORMULAIRE_PIECE_JOINTE';
    else if (name === 'table' || /DataTable$/u.test(name)) type = 'TABLE_LISTE';
    else if (name === 'button' || /Button$/u.test(name) || actionHandler || (['a', 'Link', 'NavLink'].includes(name))) type = 'ACTION_JSX';
    else return;
    const texts = [];
    if (ts.isJsxElement(node)) node.children.forEach((c) => { if (ts.isJsxText(c)) texts.push(c.text); else if (ts.isJsxExpression(c) && c.expression) texts.push(`{${clean(c.expression.getText()).slice(0, 100)}}`); });
    const label = literal(attr(node, 'aria-label')?.initializer) || literal(attr(node, 'title')?.initializer) || clean(texts.join(' ')) || name;
    candidates.push({ type, node, name, label, handlers: actionHandler, file, sf, consumers, permissionCalls, method: 'AST_JSX' });
  });
}
for (const c of candidates) {
  const syntax = c.node === c.sf ? c.name : clean(opening(c.node).getText());
  const signature = `${rel(c.file)}|${c.type}|${syntax}`;
  const occurrence = (nodeOccurrences.get(signature) || 0) + 1;
  nodeOccurrences.set(signature, occurrence);
  const consumers = c.consumers;
  const modules = unique(consumers.map((r) => moduleFor(r.route)));
  const portals = unique(consumers.flatMap(portalFor));
  const routesCandidate = unique(consumers.map((r) => r.route));
  rows.push({ id: id(c.type === 'ACTION_JSX' ? 'ACT' : c.type.includes('FORMULAIRE') ? 'FRM' : c.type.includes('MODAL') ? 'MOD' : 'CMP', `${signature}|${occurrence}`), portail: portals.length ? portals : ['CONSOMMATEUR_NON_RESOLU'], module: modules.length ? modules : ['TRANSVERSE_OU_ORPHELIN_A_QUALIFIER'], route: routesCandidate, type: c.type, libelle: c.label, source: source(c.sf, c.node), composants: rel(c.file), actions: clean(c.handlers).slice(0, 800), permissions: unique(c.permissionCalls), politique_registre: consumers.length ? 'Hérite du contexte route candidat; conditions internes à relire; serveur non testé' : 'Aucune association statique résolue; conserver dans le périmètre de qualification', defauts: 'NON_INSPECTE_EN_UI', responsable: modules.length === 1 ? ownerFor(modules[0]) : 'Lot partagé : propriétaire à affecter par orchestrateur', exigence_design: uiReq, methode: c.method, revue_statique: 'DETECTION_AUTOMATIQUE_NON_REVUE; imports candidats ≠ visibilité prouvée', statut: 'À INVENTORIER', test_ui: 'NON EXÉCUTÉ', preuve_ui: '', baseline, version_source: commit });
}

// Entrées de navigation littérales : chemins de menus et variantes sous wildcard.
for (const [file, sf] of sources) {
  if (!/Navigation|navigation/u.test(path.basename(file))) continue;
  visit(sf, (node) => {
    if (!ts.isObjectLiteralExpression(node)) return;
    const prop = (name) => node.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === name)?.initializer;
    const route = literal(prop('path'));
    if (!route.startsWith('/')) return;
    const module = moduleFor(route);
    const navKey = `${rel(file)}|${route}|${literal(prop('label'))}`;
    const occurrence = (nodeOccurrences.get(navKey) || 0) + 1;
    nodeOccurrences.set(navKey, occurrence);
    rows.push({ id: id('NAV', `${navKey}|${occurrence}`), portail: registry.routePolicyFor(route)?.accountTypes || ['A_QUALIFIER'], module, route, type: 'ENTREE_MENU', libelle: literal(prop('label')), source: source(sf, node), composants: rel(file), actions: 'Navigation; filtrage de visibilité à tester avec profil réel', permissions: 'getNavigationSectionsForUser → canAccessPrivateRoute; disponibilité module et sous-module', politique_registre: JSON.stringify(registry.routePolicyFor(route)), defauts: 'NON_INSPECTE_EN_UI', responsable: ownerFor(module), exigence_design: 'Annexe A.5 : menus réels, libellés, état actif, clavier, contexte', methode: 'AST_MENU_LITERAL', revue_statique: 'DETECTION_AUTOMATIQUE_NON_REVUE', statut: 'À INVENTORIER', test_ui: 'NON EXÉCUTÉ', preuve_ui: '', baseline, version_source: commit });
  });
}
const inventory = [];
for (const type of accountTypes) {
  const theme = registry.PORTAL_THEMES[type];
  const associated = routes.filter((r) => r.policy && candidateAccounts(r.policy).includes(type));
  const mods = unique(associated.map((r) => moduleFor(r.route)));
  for (const module of mods) {
    const matching = associated.filter((r) => moduleFor(r.route) === module);
    const entry = catalog.find((m) => m.code === module);
    inventory.push({ id: `PM-${type}-${module}`, portail_id: `POR-${type}`, portail_libelle: theme.label, role: roleFor[type] || type, organisation: type === 'mine' ? 'mining_company_id autoritatif; 2 sociétés à tester' : ['dgmg', 'dgi'].includes(type) ? `organization_id + organization_type=${type}` : ['collector', 'comptoir'].includes(type) ? 'organization_id/rattachements autorisés; 2 organismes à tester' : 'Profil et organisation autoritatifs; aucun tenant choisi par UI', module_id: `LOT-${module}`, module_code: module, module_libelle: entry?.label || module, routes: matching.map((r) => r.route), donnees_visibles: type === 'direction' ? 'Vue consolidée en lecture seule; RLS/RPC à vérifier' : 'Périmètre candidat du registre frontend; RLS/RPC et permissions effectives NON vérifiés', theme: `${theme.id}; primary=${theme.primary}; sidebar=${theme.sidebar}; prescrit=${theme.prescribed}`, responsable_propose: ownerFor(module), sources: unique(['src/lib/routeAccessRegistry.ts', 'src/lib/platformModuleCatalog.ts', 'src/components/layout/portalThemes.ts', ...matching.map((r) => r.source)]), nb_routes_candidates: matching.length, niveau_preuve: 'DETECTION_AUTOMATIQUE; identité des 13 types relue statiquement; couples modules non audités', statut: 'À INVENTORIER', test_ui: 'NON EXÉCUTÉ', baseline, version_source: commit, limite: 'Association de politique ≠ accès réel; admin module_codes et Owner transversal hors liste brute; aucune validation UI/serveur' });
  }
}
// Conserver explicitement le périmètre public et les chemins sans politique.
for (const module of unique(routes.filter((r) => !r.policy).map((r) => moduleFor(r.route)))) {
  const matching = routes.filter((r) => !r.policy && moduleFor(r.route) === module);
  inventory.push({ id: `PM-public-${module}`, portail_id: 'POR-public', portail_libelle: 'Public / identité / alias à qualifier', role: 'sans session ou contexte à qualifier', organisation: 'Sans tenant pour les pages publiques; alias à suivre', module_id: `LOT-${module}`, module_code: module, module_libelle: module, routes: matching.map((r) => r.route), donnees_visibles: 'Contenus publics et parcours authentification existants', theme: 'Vitrine/login existants', responsable_propose: ownerFor(module), sources: matching.map((r) => r.source), nb_routes_candidates: matching.length, niveau_preuve: 'DETECTION_AUTOMATIQUE_NON_REVUE', statut: 'À INVENTORIER', test_ui: 'NON EXÉCUTÉ', baseline, version_source: commit, limite: 'Ce regroupement technique ne crée aucun nouveau portail métier.' });
}

const rights = [];
for (const type of accountTypes) {
  const role = roleFor[type] || type;
  const basic = { id: `inventaire-${type}`, role, is_active: true, organization_id: `test-${type}`, organization_type: ['dgi', 'dgmg'].includes(type) ? type : type === 'comptoir' ? 'comptoir' : 'sonasp', mining_company_id: type === 'mine' ? 'test-mine-a' : null, module_codes: catalog.map((c) => c.code), capabilities: Object.values(registry.CAPABILITIES) };
  for (const variant of ['CAPACITES_EXPLICITES_COMPLETES', 'CAPACITES_EXPLICITES_VIDES', 'PROFIL_INACTIF', 'TENANT_MINE_INCOHERENT', 'MODULES_EXPLICITES_VIDES']) {
    const profile = { ...basic, capabilities: variant === 'CAPACITES_EXPLICITES_VIDES' ? [] : basic.capabilities, is_active: variant !== 'PROFIL_INACTIF', mining_company_id: variant === 'TENANT_MINE_INCOHERENT' ? (type === 'mine' ? null : 'test-mine-non-autorisee') : basic.mining_company_id, module_codes: variant === 'MODULES_EXPLICITES_VIDES' ? [] : basic.module_codes };
    for (const policy of policies) {
      const decision = registry.evaluatePrivateRouteAccess(profile, policy.route.replace(/:[^/]+/gu, 'identifiant-test').replace(/\/\*$/u, ''));
      const declared = routes.find((r) => r.route === policy.route);
      rights.push({ id: id('DRT', `${type}|${variant}|${policy.route}`), portail: `POR-${type}`, profil_role: role, contexte: variant, compte_resolu: decision.accountType, organisation: basic.organization_type, route: policy.route, module: moduleFor(policy.route), roles_registre: policy.roles, types_registre: policy.accountTypes, capacites_registre_OR: policy.capabilities, lecture_seule_registre: policy.readOnly, national_registre: policy.national, gardes_route_JSX: declared?.guards || [], resultat_fonction_pure: decision.allowed ? 'ADMIS_PAR_REGISTRE_FRONTEND' : `REFUSE:${decision.reason}`, statut_controle_serveur: 'NON EXÉCUTÉ', statut_test_interface: 'NON EXÉCUTÉ', statut_audit: 'À TESTER', preuve: 'Fonction pure evaluatePrivateRouteAccess exécutée localement sur profil artificiel en mémoire; aucun compte réel/session/API', sources: ['src/lib/routeAccessRegistry.ts', 'src/components/auth/ProtectedRoute.tsx', 'src/lib/capabilities.ts', ...(declared ? [declared.source] : [])], limite: 'N’est pas une preuve des gardes JSX, AAL2, RLS, RPC, Storage ni des actions métier; résultats frontend à confirmer dans chaque session autorisée', baseline, version_source: commit });
    }
  }
}

rows.sort((a, b) => a.id.localeCompare(b.id));
inventory.sort((a, b) => a.id.localeCompare(b.id));
rights.sort((a, b) => a.id.localeCompare(b.id));
for (const [name, collection] of [['écrans', rows], ['portails/modules', inventory], ['droits', rights]]) {
  const ids = new Set();
  for (const row of collection) {
    if (ids.has(row.id)) throw new Error(`ID dupliqué ${name}: ${row.id}`);
    ids.add(row.id);
  }
}
fs.mkdirSync(out, { recursive: true });
write('01_INVENTAIRE_PORTAILS_MODULES.csv', inventory, ['id', 'portail_id', 'portail_libelle', 'role', 'organisation', 'module_id', 'module_code', 'module_libelle', 'routes', 'donnees_visibles', 'theme', 'responsable_propose', 'sources', 'nb_routes_candidates', 'niveau_preuve', 'statut', 'test_ui', 'baseline', 'version_source', 'limite']);
write('02_MATRICE_ECRANS_ET_ACTIONS.csv', rows, ['id', 'portail', 'module', 'route', 'type', 'libelle', 'source', 'composants', 'actions', 'permissions', 'politique_registre', 'defauts', 'responsable', 'exigence_design', 'methode', 'revue_statique', 'statut', 'test_ui', 'preuve_ui', 'baseline', 'version_source']);
write('04_MATRICE_DROITS_ET_CONTEXTES.csv', rights, ['id', 'portail', 'profil_role', 'contexte', 'compte_resolu', 'organisation', 'route', 'module', 'roles_registre', 'types_registre', 'capacites_registre_OR', 'lecture_seule_registre', 'national_registre', 'gardes_route_JSX', 'resultat_fonction_pure', 'statut_controle_serveur', 'statut_test_interface', 'statut_audit', 'preuve', 'sources', 'limite', 'baseline', 'version_source']);
const counts = (values, key) => Object.fromEntries(unique(values.map((x) => x[key])).map((v) => [v, values.filter((x) => x[key] === v).length]));
console.log(JSON.stringify({ baseline, version: commit, sourceFiles: files.length, accountTypes: accountTypes.length, visualPortals: new Set(accountTypes.map((a) => registry.PORTAL_THEMES[a].id)).size, moduleCodes: unique(inventory.map((r) => r.module_code)).length, portalModulePairs: inventory.length, routePolicies: policies.length, routeDefinitions: routes.length, methods: counts(routes, 'method'), screenRows: rows.length, screenTypes: counts(rows, 'type'), rightsScenariosPureFunctionOnly: rights.length, uiValidated: 0, serverValidated: 0, limitations: ['Présidence/Observatoire absent des types de compte réels : aucun portail inventé.', 'Détections non revues conservées ; pas de dénominateur fonctionnel exhaustif garanti avant qualification des états/modalités dynamiques.', 'Imports transitifs = routes candidates, pas portée réelle prouvée.', 'Les occurrences HTML/composant/route ne doivent pas être additionnées comme formulaires métier distincts.', 'Aucune recette UI, base de données, API, RLS ou Storage exécutée par cet outil.', 'Cet outil régénère la baseline de détection et écrase ces trois CSV ; préserver les preuves/revues enrichies avant relance.'] }, null, 2));
