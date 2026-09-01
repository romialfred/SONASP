# Correctif d’entrée dans les portails — 31 août 2026

## Périmètre et cause

Base de travail : `4c70667`, branche `SONASP_2026`. Correctif local, sans déploiement distant.

La capture « Portail Mine non attribué » pour Owner correspond à deux décisions
contradictoires dans le parcours d’entrée :

1. Quatre liens génériques « Portail SONASP » de la vitrine (header bureau et
   mobile, introduction et appel final) pointaient vers `/portail-mine`.
2. Le registre des routes autorise Owner sur cette route, mais `MinePortalGuard`
   exigeait ensuite un `mining_company_id`, absent d’un propriétaire national.
3. Après connexion, `PublicRoute` conservait cette destination demandée.

Ce défaut ne démontrait donc pas une absence de droits Owner en base. Les tests
existants couvraient les permissions et le guard séparément ; deux tests du guard
attendaient même ce refus pour Owner. Le parcours vitrine → connexion → guards
imbriqués n’était pas couvert.

## Correction ciblée

- Les quatre liens génériques pointent désormais vers `/login`. Le mécanisme
  existant oriente le compte connecté vers son accueil propre. Un visiteur non
  connecté doit toujours s’authentifier.
- Un Owner actif et vérifié arrivant par un ancien lien Mine est redirigé vers
  `/dashboard`, avant le montage du contexte Mine. Il n’a pas à représenter une
  société pour exercer ses droits nationaux.
- Les liens explicitement intitulés « Portail Mine » restent dédiés aux mines.
- Aucun changement de rôle, capability, catalogue, permission individuelle,
  MFA, RPC, RLS, schéma ou donnée en base.
- Aucun choix de mine depuis l’URL ni simulation d’identité partenaire pour Owner.
  Les contrôles de session, de profil et de compte actif précèdent la redirection.

Le guide `focused-fix` a conduit à limiter le code applicatif à trois fichiers,
plutôt qu’à refondre le système d’autorisation pour résoudre ce défaut de routage.

## Preuves et contre-analyse

Les nouveaux tests du parcours Owner ont d’abord échoué avec le code initial.
La validation finale rassemble **26 fichiers et 276 tests réussis** :

```powershell
npx vitest run src/components/auth src/pages/public/PublicHomePage.test.tsx src/pages/public/PublicLayout.test.tsx src/lib/routeAccessRegistry.test.ts src/lib/permissions.test.ts src/lib/capabilities.test.ts src/components/layout/AccordionSidebar.test.tsx src/components/layout/sidebarNavigation.test.ts src/lib/platformModuleCatalog.test.ts src/lib/roleHierarchy.test.ts src/lib/accessControl.test.ts src/lib/mineAccess.test.ts src/lib/comptoirAccess.test.ts src/lib/collectorAccess.test.ts --maxWorkers=2 --reporter=dot
```

Cas couverts :

- Les 13 rôles, plus les variantes Mine et Collecteur historiques, depuis la
  vitrine avant et après connexion.
- Owner avec listes de permissions/capabilities/modules vides ; récupération
  de l’ancien lien Mine avec ou sans session préexistante.
- Mine A et Mine B : conservation exclusive du tenant autoritatif, paramètre
  d’URL d’une autre mine ignoré.
- Profil absent/en vérification/en erreur, compte désactivé, profil Owner
  incohérent portant un tenant : aucun contournement du contrôle d’accès.
- Paramètre `role=owner` sans effet sur un Client.
- Catalogue, sidebar, droits Owner sur les modules masqués/désactivés,
  hiérarchie d’administration et interdiction d’auto-administration.

L’identité est simulée dans les tests React ; les composants publics, les
redirections et les guards concernés sont réels. Ces tests ne constituent pas
une nouvelle validation du serveur Supabase ni un audit exhaustif de la plateforme.

## Vérifications techniques et version locale

- `npm run lint` : réussi.
- Build Vite/PWA : réussi, 3 220 modules transformés.
- `git diff --check` : réussi.
- Couverture des types Supabase : réussie.
- TypeScript : **une erreur préexistante**, `TS2322` dans
  `src/components/charts/PieChartWidget.tsx:27` (`PieChartData[]` / `ChartDataInput[]`).
  Le compilateur a été exécuté aussi avec les sources suivies de HEAD, substituées
  en mémoire sans écraser les modifications : même diagnostic unique. Aucune
  nouvelle erreur de typage introduite par ce lot ; le contrôle global reste rouge.

Build local servi sur `http://127.0.0.1:5180/` : **`local-mtgxoqgh`**, HTTP 200,
sans client HMR. La construction a été préparée dans un dossier temporaire, puis
les nouveaux fichiers ont été copiés en conservant les anciens assets afin de
ne pas casser les onglets déjà ouverts. Aucun rechargement forcé du formulaire
utilisateur en cours.

Le navigateur a confirmé les trois liens génériques visibles vers `/login` dans
la version locale reconstruite. Le menu mobile est également vérifié par test.
La vérification authentifiée de cette nouvelle version avec le compte Owner réel
reste à effectuer : l’onglet de test indépendant demande une connexion. Celle-ci
a été demandée à l’utilisateur, sans collecte de mot de passe ni de code MFA.
