# Accès Administrateur — diagnostic et correctif du 30/08/2026

## État de livraison

Implémenté et compilé localement. **Non publié, aucune habilitation distante
modifiée.** La demande de publication ciblée et d'attribution au compte désigné
est en attente de confirmation. Aucun commit, push ou `db push` exécuté.

Le peuplement historique de développement reste hors du périmètre de ce correctif.

## Constats vérifiés

- Le profil `otingueri@gmail.com` est actif, de rôle `admin`, sans société minière.
- Son droit de consultation du module `refining` est déjà présent en base.
- Le frontend publié annonce le build `beb74d643101-mtbnb2my`, correspondant à HEAD.
  Les corrections locales du registre de routes, du garde de routes et de la
  navigation ne sont pas dans ce build. L'ancienne allowlist refuse le raffinage
  avant même que son attribution de module puisse être utilisée.
- `permissionCeilingFor` et `snp_user_permission_allowed` limitaient les écritures
  Admin aux domaines `users/settings`, y compris lorsque l'Owner les configure.
- La sidebar appliquait un second filtre de domaine, incohérent avec l'attribution
  d'un groupe canonique : notamment les contrats dans Achats et les paiements dans Ventes.
- Le catalogue SQL comporte aussi des racines historiques `customers/payments`
  non attribuées au compte. Ces pages sont rattachées, dans le catalogue frontend
  canonique, à Parties prenantes et Vente d'or international : ne pas créer de
  groupes en double pour corriger un refus de route.

## Correctif et limites de sécurité

- Plafond Admin configurable pour les cinq droits des domaines reconnus ; aucune
  exception par adresse e-mail, aucune promotion en Owner, aucun grant implicite.
- Le gabarit « Droits recommandés » conserve ses défauts conservateurs.
  « Tous les droits sur les modules » est une action explicite, réservée à l'acteur
  pouvant administrer la cible. Les cases individuelles restent modifiables.
- Les droits retirés ne réapparaissent pas lors d'une mise à jour du profil ou
  du catalogue. La continuité des droits Owner est préservée.
- Les codes canoniques priment sur le filtre de domaine secondaire de la sidebar.
- Les mutations de permissions passent par les RPC atomiques ; écritures directes
  révoquées aux clients. Les capacités métier sensibles, la hiérarchie,
  l'anti-auto-administration, les contrôles de session et la MFA restent en place.
- Un droit de module ne donne pas automatiquement une responsabilité financière,
  un droit d'auto-approbation ni l'accès au portail privé d'un partenaire.

La méthode de correction ciblée a limité les modifications aux plafonds, au
formulaire, à la projection de navigation et aux tests. Les autres modifications
préexistantes du chantier ont été conservées, sans être déployées.

## Preuves de vérification

- TypeScript : `npm run typecheck:compiler` sans diagnostic.
- `npm run build` réussi, 3 207 modules transformés.
- 148 tests dans 10 fichiers : plafonds, catalogue, registre de routes, sidebar,
  ProtectedRoute Admin, hiérarchie, formulaire et services de permissions.
  Exécution avec `--maxWorkers=1 --no-file-parallelism --pool=forks` après un
  premier essai interrompu par un timeout de démarrage des workers.
- SQL réel sur `sonasp_iam_audit_20260830` : 18 assertions Admin, 26 continuité
  Owner, 42 administration IAM, toutes réussies (86 distinctes).
- Les 18 assertions Admin passent également sur la copie du schéma publié
  `sonasp_seed_validation_live_20260830`, sans dépendre de tout le lot IAM local.
- Toutes les fixtures SQL sont annulées par ROLLBACK. Aucun profil de test conservé.
- Répétition distante **annulée** : 45 modules actifs deviennent attribuables,
  empreinte des permissions existantes identique avant/après la migration,
  écritures directes client bloquées. Dossier de preuve :
  `C:/Users/romia/AppData/Local/Temp/sonasp-admin-rehearsal-MwXPp8`.
- Lecture après répétition : ancien plafond toujours en place (6 modules éditables,
  raffinage non attribuable en écriture), confirmant l'absence de déploiement.
- Catalogue des migrations et checksums conformes ; dette historique inchangée.
- Navigateur local : ancien document Vite devenu invalide, puis page de connexion
  affichée après rechargement de la version compilée. **Pas de session authentifiée
  utilisée pour vérifier visuellement le formulaire ou le compte cible.**

## Reproduction des contrôles

```powershell
npx vitest run src/lib/accessControl.test.ts src/lib/routeAccessRegistry.test.ts src/lib/platformModuleCatalog.test.ts src/lib/roleHierarchy.test.ts src/components/auth/ProtectedRoute.admin.test.tsx src/components/layout/sidebarNavigation.test.ts src/pages/admin/UserManagementModern.test.tsx src/pages/admin/userPermissions.test.tsx src/pages/admin/RolesPermissionsPage.test.tsx src/services/userPermissionsService.test.ts --maxWorkers=1 --no-file-parallelism --pool=forks
node scripts/check-migration-integrity.mjs verify --json
```

`preflight.sql` et `postflight.sql` sont en lecture seule. `rehearse.mjs CHEMIN_CLI`
exécute uniquement une répétition annulée et refuse un projet lié différent de
`yyverzuhkdonjjuficor`. Ce script n'a aucun mode de publication.

## Publication restant à effectuer après autorisation

1. Isoler le correctif frontend de l'ensemble des changements locaux préexistants,
   en incluant ses dépendances de navigation/authentification déjà testées.
   Ne pas publier aveuglément tout le chantier en cours.
2. Sauvegarder les fonctions, ACL, plafonds et permissions concernés ; recontrôler
   la définition publiée et le checksum de la migration
   `20260830160000_habilitations_administrateur_configurables.sql`.
3. Appliquer cette migration seulement, sans réinitialisation ni réparation
   de l'historique ; vérifier le build effectivement servi après publication.
4. Depuis une session Owner authentifiée/MFA, attribuer explicitement les droits
   demandés au compte Admin par le formulaire canonique. Vérifier le payload,
   le résultat enregistré, la trace d'audit et la nouvelle session Admin.
5. Vérifier en navigateur le raffinage, stocks, réserve, achats, ventes,
   paiements et administration, ainsi que le refus d'auto-modification.

En cas de retour arrière, ne jamais tronquer une table de permissions : restaurer
uniquement les lignes et définitions sauvegardées pour ce déploiement. Avant de
réduire le plafond, ramener les seules attributions nouvellement ajoutées dans son
ancien périmètre ; conserver l'audit et les contrôles de sécurité.
