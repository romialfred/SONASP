# Accès Owner, Réserve nationale et audit du catalogue

## Périmètre et diagnostic confirmé

Demande : conserver tous les accès du Owner actif, y compris lorsque des modules
sont masqués ou désactivés pour les autres comptes, et corriger l’erreur SQL lors
d’une bascule de module. Le rôle vient du profil serveur, jamais d’une adresse
e-mail codée en dur.

Vérifications sur la base connectée, en lecture seule :

- `romuald.tiegnan@gmail.com` possède bien le rôle `owner`, est actif et n’est pas
  rattaché à une société minière.
- Le catalogue distant utilise encore `gold_inventory` pour l’ancienne Réserve.
  La racine `national_reserve` est absente ; plusieurs enfants pointent encore
  vers `/inventory` et sont masqués/désactivés.
- Les tables `reserve_allocations`, `reserve_allocation_items`,
  `reserve_allocation_events`, `reserve_allocation_documents` et la vue
  `snp_reserve_eligible_inventory` répondent HTTP 200. Cette vérification de
  disponibilité ne constitue pas un test de session Owner en navigateur.
- La contrainte `snp_account_admin_audit_action_check` ne permet que cinq anciennes
  actions. Les RPC déjà déployées produisent aussi `module_catalog_update` et
  `access_configuration` : leur insertion échoue et annule l’opération entière.
- Le filtre de disponibilité du menu s’exécutait avant l’exception Owner.
  Côté SQL, la recherche d’un module actif précédait également cette exception.

## Correctif local

1. Le menu Owner ignore les bascules de disponibilité et les entrées absentes
   d’un catalogue ancien. Les autres profils conservent exactement ce filtre.
2. Le message de confirmation et l’aide de Gestion des modules précisent que
   les bascules globales ne retirent jamais les accès Owner.
3. La migration additive `20260830070000_acces_owner_et_audit_modules.sql` :
   - ajoute uniquement les deux actions d’audit canoniques manquantes ;
   - conserve l’accès Owner aux modules existants, même désactivés ;
   - maintient le refus des modules/actions inconnus et des sessions révoquées ;
   - impose la MFA pour les mutations, y compris Owner ;
   - aligne l’API `get_user_modules` sans supprimer ses contrôles inter-comptes ;
   - attribue les droits complets aux Owners actifs pour les modules présents
     et futurs, y compris créés désactivés ;
   - conserve les plafonds Administrateur et les responsabilités des autres rôles.
4. La migration déjà préparée `20260829203000_separer_stock_et_reserve_nationale.sql`
   reste nécessaire pour synchroniser la base avec les routes Stock/Réserve du
   code local. Elle conserve les identifiants des sous-modules existants.

Pas de changement des formulaires métier, quantités, transitions de Réserve,
contrôles de séparation des tâches, données de stock ou design des écrans.
Les skills focused-fix, senior-security et senior-qa ont guidé le périmètre,
le maintien des frontières d’autorisation et les preuves négatives.

## Preuves

- Trois nouveaux scénarios de sidebar échouaient avant le correctif : catalogue
  absent, désactivé et masqué. Ils passent après correction.
- Un test de rendu charge un catalogue absent, puis simule sa désactivation :
  les six liens Réserve du Owner restent disponibles.
- Les tests de masquage historiques ont été adaptés au contrat demandé :
  filtrage pour Administrateur, accès conservé pour Owner.
- Suite applicative globale Vitest : **232/232 fichiers, 1 739/1 739 tests**.
  Contre-vérification ciblée après les derniers ajustements : **11/11 fichiers,
  119/119 tests** (menu, catalogue, routes, guards Owner/Admin et authentification).
- Contrat SQL `supabase/tests/owner_module_continuity_test.sql` : **26/26**.
  Exécution sur `supabase_db_SONASP-local-mirror`, en une transaction annulée.
  Les migrations IAM `20260828143000`, `20260828193000`, `20260829103000`
  préparent temporairement ce miroir plus ancien, puis les migrations
  `20260829203000` et `20260830070000` sont testées. Aucune n’a été persistée.
- TypeScript global, couverture des types Supabase, ESLint global : succès.
- Build Vite et génération PWA : succès, 3 204 modules transformés.
- Tests du vérificateur d’intégrité des migrations : **10/10** ; vérification
  du catalogue : succès. Aucun checksum SQL précédemment enregistré n’a changé.
  Le catalogue a également rattrapé 19 migrations préexistantes non enregistrées ;
  cela ne signifie pas qu’elles ont été déployées par cette intervention.
- `git diff --check` : succès.

### Limites des anciens contrats SQL sur le miroir

`owner_role_lock_test.sql` présente deux échecs sur dix, identiques avant et
après le nouveau correctif : fixture sans session applicative active et message
de refus émis par un verrou de statut plus récent. Les protections de refus
restent effectives ; aucun test n’a été neutralisé pour masquer ces écarts.

`access_control_matrix_test.sql` s’arrête sur l’absence de
`snp_sod_legacy_review` dans ce miroir. Il ne constitue donc pas une validation
globale du schéma distant. Le nouveau contrat de 26 tests reste indépendant et
complet sur le périmètre Owner/catalogue/audit.

## Application autorisée et réalisée le 30 août 2026

L’utilisateur a explicitement autorisé l’application isolée des deux migrations.
Elles sont désormais **appliquées et enregistrées sur Supabase**, projet
`yyverzuhkdonjjuficor`. Contrôle post-commit : **07:37:32 UTC**.

- `20260829203000_separer_stock_et_reserve_nationale.sql`
- `20260830070000_acces_owner_et_audit_modules.sql`

Aucun commit, push, déploiement Vercel, reset ou repair. Aucune autre migration
du worktree n’a été embarquée.

Le `supabase db push --linked --dry-run` a été exécuté : il refuse la chaîne
historique, avec `LegacyDbPushMissingLocalError` (versions distantes absentes
localement). La suggestion automatique de `migration repair` n’a pas été suivie.
La procédure isolée utilise `supabase db query --linked`, qui active le rôle SQL
de migration via l’authentification existante de la CLI. La tentative précédente
avec une connexion directe avait conservé `cli_login_postgres` sans activation
de son rôle `postgres`, d’où le refus d’écriture. Aucun privilège supplémentaire
n’a été accordé à ce compte technique ni aux clients navigateur.

Le script `scripts/deploy-owner-module-fix.mjs` vérifie le projet, les checksums
des deux fichiers, l’absence des versions dans l’historique et l’état Owner.
Il sauvegarde les catalogues, permissions, six fonctions et la contrainte
d’audit immédiatement avant la transaction. Les éléments de préparation et de
retour arrière suivent le skill migration-architect ; les validations effectives
sont les contrats SQL, pas les estimations génériques du plan généré.

### Contrôles sur la cible

1. Répétition complète avec ROLLBACK : **35/35 assertions SQL**.
2. Application transactionnelle : mêmes **35/35 assertions avant COMMIT**,
   avec fixtures dans des savepoints intégralement annulés.
3. Empreintes et nombres de lignes inchangés pour `gold_inventory`,
   `inventory_transactions`, `reserve_allocations`, `reserve_allocation_items`,
   `reserve_allocation_events` et `reserve_allocation_documents`.
4. Deux versions exactement enregistrées ; aucun droit Owner incomplet sur les
   **45 modules d’habilitation**. Le compte attendu demeure Owner actif.
5. Racines Stock/Réserve distinctes ; **six sous-modules Réserve actifs et visibles**
   avec les routes `/national-reserve`, `/allocations`, `/physical`, `/controls`,
   `/valuation` et `/audit` sous ce préfixe.
6. Contrainte d’audit contenant les deux actions canoniques manquantes.

Vérification Browser : l’application locale répond ; l’accès à
`/national-reserve` redirige vers la connexion dans l’onglet disponible, qui
ne contient pas de session Owner connectée. Aucun identifiant n’a été saisi.
L’onglet a été rendu à sa page d’accueil initiale. La validation d’accès ci-dessus
est donc serveur/SQL, et non une attestation visuelle d’une session Owner réelle.

Preuves privées et sauvegarde avant application :
`C:/Users/romia/AppData/Local/Temp/sonasp-owner-modules-xRi5dQ/`.
Le reçu sans données de comptes est aussi conservé dans
`docs/audits/owner-modules-deployment.receipt.json`.

En cas d’anomalie après commit : partir de cette sauvegarde et produire un
correctif prospectif relu ; ne pas rejouer automatiquement le déploiement ni
remplacer globalement les permissions. Le script refuse les versions déjà
enregistrées.
