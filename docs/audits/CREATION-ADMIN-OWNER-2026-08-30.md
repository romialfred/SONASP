# Création des comptes Admin et Owner — diagnostic vérifié

Date : 30 août 2026. État : **déploiement ciblé autorisé et effectué ; trois migrations appliquées et `create-user` v7 ACTIVE, sources vérifiées**. La recette authentifiée avec livraison effective du courriel reste à effectuer sur des adresses convenues.

## Cause des deux refus

Avant le déploiement, la fonction `create-user` réellement active sur le projet lié `yyverzuhkdonjjuficor` était la **version 6**.
Son code a été téléchargé en lecture seule et comparé au code local, y compris ses dépendances partagées.

- Cette version interdit explicitement le rôle Owner avec le message exact de la capture : « Le rôle Propriétaire est réservé au script sécurisé de continuité. »
- Son catalogue ne connaît pas les quatre responsabilités `comptoir.invoices.issue`, `comptoir.payments.execute`, `comptoir.payments.reconcile`, `comptoir.tax.execute`.
- Le formulaire envoyait toutes les responsabilités, même décochées, dans deux champs (`capabilities` et `responsibilities`). Le validateur distant rejetait un code inconnu même associé à `false`. Cela explique l'échec d'un Admin sans responsabilité métier sélectionnée.
- Les trois migrations ci-dessous ne figuraient pas dans l'historique distant. La lecture des définitions SQL confirmait que le configurateur et le verrou Owner conservaient les anciennes restrictions ; il ne s'agissait pas simplement d'une absence d'inscription dans l'historique.

| Migration locale déjà présente | Fonction du correctif |
| --- | --- |
| `20260830103000_securiser_administration_owner_et_profils.sql` | Hiérarchie Owner, promotion par RPC authentifié, protection anti-auto-élévation, audit et MFA |
| `20260830111500_raccorder_habilitations_financieres_comptoir.sql` | Catalogue des quatre responsabilités, validation et cohérence de la configuration |
| `20260830160000_habilitations_administrateur_configurables.sql` | Plafond des droits Admin configurable par Owner sans attribution automatique des écritures |

Le correctif du frontend seul ne permettait donc pas de créer un Owner sur ce serveur.

## Changements de ce lot

1. `userManagementService.ts` sérialise une seule carte de responsabilités, sans les entrées strictement `false`, uniquement à la création. Les droits sélectionnés et les valeurs invalides restent transmis au validateur serveur ; aucun droit n'est accordé côté navigateur. Le chemin d'édition n'est pas modifié.
2. Un délai réseau ne prétend plus qu'aucun compte n'a été créé : le service demande de vérifier la liste avant de réessayer.
3. `create-user` ne masque plus l'échec d'une compensation. Si le nettoyage du compte ou du nouveau comptoir échoue, la réponse signale explicitement qu'une vérification administrative est nécessaire au lieu d'annoncer qu'aucun compte incomplet n'a été conservé.
4. Des tests exécutent l'entrée Edge et ses gardes réelles avec le SDK Supabase. Les seules frontières simulées sont les réponses HTTP Auth/PostgREST/messagerie. Les tests SQL complémentaires utilisent les vrais triggers et RPC PostgreSQL.
5. Un contrôle de livraison **en lecture seule** compare les sources distantes aux sources locales et vérifie les migrations requises. Il échoue si une ancienne version reste publiée, même si les tests locaux sont verts.

Aucune nouvelle migration, aucune modification de design, aucun changement des anciens fichiers de migration, aucune suppression de compte existant, aucun courriel réel envoyé. Les changements préexistants du workspace sont conservés.

## Vérifications effectuées

### Tests applicatifs : 109/109, six fichiers

```powershell
npx vitest run supabase/functions/create-user src/services/userManagementService.test.ts src/pages/admin/UserManagementModern.test.tsx supabase/functions/_shared/account-role-policy.test.ts src/lib/accessControl.test.ts --maxWorkers=2
```

Parmi eux, 22 tests d'exécution Edge : Owner → Admin/Owner, refus Admin → Admin/Owner, compte inactif, MFA absente, AAL1, session révoquée, capacité absente, JWT non vérifié, doublon, responsabilité inconnue/mal typée/hors plafond, séparation des fonctions, échec de profil/RPC/courriel, nettoyage incomplet. Les quatre nouveaux tests du service échouaient avant correction ; le test du nettoyage incomplet échouait également avant correction.

### SQL : 101/101 sur PostgreSQL isolé

Conteneur `supabase_db_SONASP-local-mirror`, base `sonasp_iam_audit_20260830`. Chaque fichier crée des comptes synthétiques et termine par `ROLLBACK`.

| Fichier | Assertions réussies |
| --- | ---: |
| `iam_owner_administration_flow_test.sql` | 42 |
| `admin_module_permissions_flow_test.sql` | 18 |
| `comptoir_finance_habilitations_test.sql` | 28 |
| `account_creation_compensation_test.sql` (nouveau) | 13 |

Le dernier scénario reproduit les insertions de profils effectuées par le service, la promotion Owner sous le JWT de l'acteur, l'attribution des droits au nouvel Admin non encore enrôlé et la compensation d'une création après échec du courriel, en préservant l'audit et le compte acteur. Les identités Auth de ces tests sont insérées dans PostgreSQL ; ce n'est pas un test de l'API GoTrue distante.

`npm run lint`, `npm run typecheck` et `npm run build` : réussis.

### Vérification du déploiement

```powershell
node scripts/account-creation/verify-deployment.mjs CHEMIN_CLI_SUPABASE
```

Exécutée le 30/08/2026 à 21:39 UTC : **code de sortie 1 attendu**, `ready: false`, fonction active v6, les trois migrations absentes, différences dans `create-user/index.ts` et `_shared/account-role-policy.ts`. Le script ne publie rien, n'applique aucun SQL, ne crée aucun compte et ne lit aucun secret.

## Mise en service autorisée — 30/08/2026

L'utilisateur a explicitement autorisé le déploiement de `create-user` et des trois correctifs SQL, sans suppression de comptes ni publication globale de la plateforme.

1. Le dry-run global `supabase db push --linked --dry-run` a détecté une divergence historique (`LegacyDbPushMissingLocalError`). Aucun `repair`, reset, faux fichier historique ou déploiement global n'a été effectué. Le lot autorisé a été isolé dans `scripts/account-creation/deploy-sql.mjs`, avec vérification des empreintes du catalogue.
2. Les définitions de fonctions, ACL, politiques et catalogues concernés ont été sauvegardés immédiatement avant les opérations. Une répétition du SQL sur la base PostgreSQL isolée puis une répétition distante avec `ROLLBACK` ont précédé l'application.
3. Les trois migrations et leurs entrées d'historique contenant leur SQL exact ont été appliquées dans une seule transaction. Les empreintes des **196 tables publiques hors catalogues volontairement modifiés** sont restées inchangées : profils, permissions individuelles, données métier et audit compris. Le compte Owner initial reste actif. Le contrôle après application est daté du **30/08/2026 à 22:02:44 UTC**.
4. Seul `create-user` a été publié, avec ses cinq dépendances partagées. À **22:08:39 UTC**, le contrôle de livraison renvoie `ready: true`, version **7 ACTIVE**, aucune migration manquante et concordance SHA-256 des **six fichiers**. Les versions des huit autres fonctions distantes sont inchangées.
5. À **22:09:20 UTC**, `scripts/account-creation/smoke-deployment.mjs` confirme les cinq contrôles HTTP suivants, sans identifiant valide ni création de compte :

| Contrôle distant | Résultat |
| --- | --- |
| GET non autorisé | 405 |
| POST sans session | 401 |
| POST avec jeton invalide | 401 |
| Prévol CORS depuis localhost autorisé | 204, origine exacte |
| Prévol CORS depuis une origine interdite | 403, aucune autorisation CORS |

Les réponses hors prévol comportent `Cache-Control: no-store`. Les 109 tests applicatifs ciblés ont été relancés avant publication : **109/109 réussis**. L'intégrité des 223 migrations du catalogue et les 10 tests de contrôle de cet historique passent également. `git diff --check` ne relève aucune erreur d'espacement.

### Preuves et sauvegardes locales

- Répétition distante annulée : `C:/Users/romia/AppData/Local/Temp/sonasp-creation-rehearse-t0i2zN`.
- Sauvegarde juste avant application et reçus SQL : `C:/Users/romia/AppData/Local/Temp/sonasp-creation-apply-6XPXba` (`before.json`, `after.json`, `receipt.json`, SQL exécuté).
- Sources distantes v6 avant publication : `C:/Users/romia/AppData/Local/Temp/sonasp-create-user-verification-lTu5Eo`.
- Sources distantes v7 après publication : `C:/Users/romia/AppData/Local/Temp/sonasp-create-user-verification-Vt8MXM`.
- Reçu synthétique sans secrets : `docs/audits/account-creation-deployment.receipt.json`.

Ces sauvegardes techniques ne remplacent pas une sauvegarde complète de la base. Les dossiers temporaires doivent être conservés avant un nettoyage du système.

### Conduite à tenir en cas d'incident

Le mode de répétition termine par `ROLLBACK` ; en application, une erreur SQL avant `COMMIT` annule tout le lot. Après validation, le lanceur refuse de rejouer les versions déjà inscrites. En cas de réponse réseau ambiguë, lire l'historique et les définitions avant toute nouvelle tentative.

Ne pas restaurer automatiquement la v6 ni les anciennes ACL : elles réintroduiraient les restrictions Owner ou supprimeraient des protections. Comparer les définitions sauvegardées, établir un correctif ciblé et obtenir l'autorisation de sa publication. Aucun retour arrière global, suppression de données ou réécriture de l'historique n'est autorisé. Les plans génériques générés dans `output/account-creation-*-plan.json` sont des aides de planification, **pas des scripts de restauration exécutables pour SONASP**.

## Recette fonctionnelle restant à effectuer

Effectuer deux créations par un Owner authentifié AAL2 sur des adresses de test expressément convenues ; vérifier l'apparition des comptes Admin et Owner, leurs droits, la réception réelle des courriels et le parcours d'activation/MFA. Ne pas utiliser l'adresse d'un tiers pour un envoi de test.

**Limite explicite :** les tests locaux valident les contrôles du code et de PostgreSQL corrigés ; les contrôles distants prouvent la mise en service du lot exact et les refus HTTP vérifiés. Ils ne prouvent pas encore une création Auth + livraison SMTP de bout en bout sur la plateforme distante. Aucun compte n'a été créé ni aucun courriel envoyé pendant ce déploiement. Le frontend distant n'a pas été republié dans ce périmètre.
