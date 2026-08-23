# Audit préalable — rôles, workflows, sécurité et compatibilité

**Projet :** SONASP

**Date de référence :** 23 août 2026

**Branche analysée :** SONASP_2026

**Commit de référence :** 98c1b45f2cec44bd5310fa397dd9f7dd2a3dff8a

**Base distante :** projet Supabase yyverzuhkdonjjuficor

**Décision :** **NO-GO pour une rationalisation structurelle ou une mise en production supplémentaire**

## 0. Résumé de décision

La plateforme existante ne doit pas être reconstruite. Elle contient déjà des portails spécialisés, des machines d’état, des fonctions transactionnelles, des données et des contrôles qu’il faut préserver.

La capture du formulaire utilisateur montre neuf rôles. Elle ne justifie pas leur suppression :

- Société minière, Usine, Aéroport, Raffinerie et Client sont utilisés par des portails, des routes, des tableaux de bord et du code serveur ;
- Direction et Manager : lecture seule ont des intentions distinctes mais leur nomenclature et leurs permissions sont encore incohérentes ;
- Administrateur possède actuellement des permissions métier trop larges pour la cible demandée ;
- Propriétaire est toujours attribuable par un Propriétaire depuis le formulaire et l’Edge Function. La cible impose au contraire un rôle exceptionnel attribuable uniquement par script sécurisé ;
- les capacités SONASP Gestionnaire, SONASP Approbateur, SONASP Finances, Comptoir d’achat et Agent Collecteur ne sont pas encore des périmètres serveur cohérents de bout en bout.

Le code local et le dépôt distant Git sont alignés sur le commit 98c1b45, mais cela ne signifie pas que la base distante est alignée :

- 121 fichiers de migration sont présents dans le dépôt ;
- la commande Supabase liste 182 entrées : 4 seulement sont reconnues à la fois localement et à distance, 106 sont locales uniquement et 72 distantes uniquement ;
- la migration 20260823153000 de hiérarchie des comptes est commitée mais non appliquée à la base distante ;
- plusieurs migrations de sécurité du 22 août, dont le verrouillage MFA/RLS et des opérations atomiques de vente, sont locales uniquement ;
- 153 tables publiques ont la RLS activée, mais 247 politiques utilisent encore un prédicat universel true, dont 140 politiques d’écriture sur 65 tables ;
- le lint SQL distant reproduit de nombreuses fonctions cassées par dérive de schéma.

La version est compilable, mais elle n’est pas libérable :

- build de production : réussi ;
- lint ESLint : réussi ;
- tests : 919 réussis, 11 échoués sur 930 ;
- typecheck : aucun résultat après plus de dix minutes, processus actif à environ 2,6 Go ; contrôle interrompu ;
- audit des dépendances de production : 2 vulnérabilités hautes sur xlsx sans correctif publié et 1 vulnérabilité modérée liée à esbuild/Vite ;
- aucun secret confirmé dans les emplacements inspectés ; trois alertes lexicales ont été vérifiées comme faux positifs.

## 1. Méthode et niveaux de preuve

L’audit distingue trois états qui ne doivent pas être confondus :

1. **Dépôt traçable** : commit 98c1b45, présent localement et sur origin/SONASP_2026.
2. **Application compilée** : résultat du build réalisé depuis ce commit.
3. **État réellement appliqué** : schéma, politiques et fonctions observés sur la base Supabase distante.

Les preuves utilisées sont :

- code React/TypeScript ;
- routes et guards ;
- services et appels directs Supabase ;
- Edge Functions ;
- migrations SQL ;
- dump du schéma public distant ;
- liste des migrations distantes ;
- lint SQL distant ;
- tests Vitest, build Vite, ESLint et typecheck ;
- audits techniques déjà présents dans docs, recoupés avec l’état du 23 août.

Ce rapport ne déclare aucun workflow complet sans preuve croisée code + serveur + test.

## 2. Architecture comprise

### 2.1 Vue générale

    Navigateur React/Vite
        |
        +-- AuthContext, ProtectedRoute, MandatoryMfaGate
        |
        +-- pages et composants
        |      |
        |      +-- services TypeScript
        |      +-- appels Supabase directs
        |
        +-- Supabase Auth
        +-- PostgREST/RLS
        +-- RPC PostgreSQL SECURITY DEFINER
        +-- Storage
        +-- Edge Functions d’administration et de messagerie

La plateforme est un frontend React 18 + Vite 5 + TypeScript, connecté directement à Supabase. Le backend métier est partagé entre :

- politiques RLS ;
- fonctions PostgreSQL transactionnelles ;
- Edge Functions Deno ;
- logique de services TypeScript ;
- quelques écritures directes depuis les pages.

Preuves :

- [package.json](../package.json) ;
- [src/PrivateApp.tsx](../src/PrivateApp.tsx) ;
- [src/lib/supabase.ts](../src/lib/supabase.ts) ;
- [supabase/config.toml](../supabase/config.toml) ;
- [vercel.json](../vercel.json).

### 2.2 Taille et complexité constatées

| Élément | Mesure |
|---|---:|
| Routes privées nommées | 142 |
| Utilisations de ProtectedRoute | 132 |
| Guards avec allowedRoles | 49 |
| Guards avec requiredPermission | 18 |
| Pages TSX | 176 |
| Composants TSX | 158 |
| Services TypeScript | 121 |
| Fichiers de migration SQL | 121 |
| Edge Functions | 9 |
| Fichiers de test | 119 |
| Appels .from dans les pages | 194 |
| Appels .from dans les services | 571 |
| Fichiers utilisant RPC | 33 |

PrivateApp concentre plus de cent routes et une grande partie de la composition des guards. Les accès directs et les RPC coexistent ; une permission frontend ne suffit donc jamais à établir l’autorisation réelle.

### 2.3 Déploiement et cache

Vercel sert une SPA avec réécriture vers index.html. Le plugin PWA génère un service worker. Les en-têtes X-Content-Type-Options, X-Frame-Options, Referrer-Policy et Permissions-Policy existent, mais aucune CSP ni HSTS n’est configurée dans vercel.json.

Le service worker et le mécanisme de cache sont des dépendances importantes des problèmes historiques de rechargement. Toute modification future doit tester :

- première visite ;
- mise à jour d’une version déjà ouverte ;
- retour d’onglet ;
- mode hors ligne ;
- chunk obsolète après déploiement.

## 3. Modules concernés et éléments à préserver

| Domaine | Éléments existants à préserver |
|---|---|
| Authentification | Supabase Auth, récupération de mot de passe, enrôlement TOTP, AAL2, session courte |
| Administration | création, édition, désactivation, réinitialisation, suppression conditionnelle, habilitations |
| Mines industrielles | production, coffre, budgets, prévisions, licences, expéditions, raffinage, stocks, marché, ventes |
| Achats SONASP | plans, demandes, réponses des mines, transactions, factures, règlements |
| Contrats et réquisitions | machines d’état détaillées, pièces, notifications, historiques |
| Raffinage et expédition | lots, documents, certificats, douane, réception |
| Artisanat minier | artisans, cartes, sites, productions, ventes, achats, paiements, taxes |
| Ventes | décisions, factures, paiements, audit, notifications |
| Documents | buckets Storage, métadonnées en tables, liens aux dossiers |
| Rapports et tableaux de bord | vues agrégées par rôle et données réelles |

Les rôles Usine, Aéroport, Raffinerie et Client ont des tableaux de bord dédiés dans src/pages/dashboards et des politiques ou services associés. Leur suppression casserait des portails existants.

## 4. Rôles existants et décision de compatibilité

Le type autoritatif frontend contient neuf valeurs dans [src/types/auth.ts](../src/types/auth.ts). Le même ensemble est repris dans [src/lib/roleLabels.ts](../src/lib/roleLabels.ts) et dans la contrainte SQL de [20260822154000_referentiel_roles_comptes.sql](../supabase/migrations/20260822154000_referentiel_roles_comptes.sql).

| Rôle actuel | Usage observé | Décision |
|---|---|---|
| owner | accès transversal, administration hiérarchique | conserver techniquement ; retirer du formulaire ordinaire ; attribution/récupération par script sécurisé uniquement |
| admin | comptes, référentiels, paramètres, mais aussi permissions métier complètes | conserver ; réduire aux fonctions globales d’administration et de support autorisé |
| management | direction interne, validation et actuellement accès complet | conserver comme compatibilité ; découpler les capacités Gestionnaire/Approbateur/Finances |
| manager | portail Direction en lecture seule | conserver ; clarifier le libellé et empêcher toute écriture serveur |
| mine | portail et données d’une société minière | conserver ; périmètre strict par mining_company_id |
| factory | production/expédition/usine | conserver |
| airport | fret et réception | conserver |
| refinery | réception, raffinage, certificats | conserver |
| customer | ventes, commandes, paiements client | conserver |

### 4.1 Rôles/capacités métier manquants

La cible ne doit pas nécessairement ajouter immédiatement cinq nouvelles valeurs à la colonne role. Une approche compatible consiste à introduire d’abord des **capacités serveur** et des rattachements organisationnels :

- sonasp_gestionnaire ;
- sonasp_approbateur ;
- sonasp_finances ;
- comptoir_operateur ;
- agent_collecteur.

La décision finale entre rôle exclusif, rôle + capacités, ou multi-rôles doit attendre :

- l’inventaire des comptes actifs ;
- la résolution des incompatibilités ;
- la validation métier des cumuls autorisés ;
- les tests de migration et de retour arrière.

### 4.2 Problème spécifique de la capture

Le formulaire utilise ALL_ROLES puis filtre selon assignableRoles. [src/lib/roleHierarchy.ts](../src/lib/roleHierarchy.ts) autorise encore un Owner à attribuer owner. La migration 20260823153000 protège le dernier Owner et hiérarchise les comptes, mais autorise également un Owner à gérer un Owner.

Cette conception améliore la hiérarchie, mais ne satisfait pas le mandat « Propriétaire uniquement par script sécurisé ». La correction cible doit :

- exclure owner de toute réponse destinée au formulaire ;
- rejeter côté Edge Function et RPC toute création ou promotion owner issue d’une session utilisateur ;
- fournir un script de bootstrap/rotation audité, hors interface ;
- tester l’impossibilité de s’auto-promouvoir, de promouvoir autrui et de désactiver le dernier compte de secours.

## 5. Permissions effectives et sources concurrentes

Il n’existe pas encore une source unique de vérité. Au moins six modèles coexistent :

1. ROLE_PERMISSIONS statique dans [src/lib/permissions.ts](../src/lib/permissions.ts) ;
2. une seconde matrice ROLE_PERMISSIONS dans [src/components/admin/UserPermissionsTab.tsx](../src/components/admin/UserPermissionsTab.tsx) ;
3. allowedRoles et requiredPermission dans [src/PrivateApp.tsx](../src/PrivateApp.tsx) ;
4. allowlist spéciale Mine dans [src/lib/mineAccess.ts](../src/lib/mineAccess.ts) ;
5. habilitations dynamiques user_permissions administrées via [src/services/userPermissionsService.ts](../src/services/userPermissionsService.ts) ;
6. RLS, RPC et Edge Functions côté serveur.

Anomalies prouvées :

- owner, admin et management reçoivent FULL_ACCESS_PERMISSIONS dans src/lib/permissions.ts ;
- admin est donc encore un acteur métier général, contraire à la cible ;
- UserPermissionsTab maintient une matrice différente, sans mine ni manager et sans permissions explicites pour admin ;
- les habilitations dynamiques ne pilotent pas la majorité des guards de routes et actions ;
- seulement 18 routes demandent une permission explicite, contre 142 routes privées ;
- le serveur possède ses propres listes de rôles, parfois différentes.

Décision proposée : le serveur doit exposer une fonction unique du type snp_actor_capabilities() et chaque RPC sensible doit vérifier une capacité et un périmètre. Le frontend ne fait qu’afficher les décisions du serveur.

## 6. Authentification, sessions et MFA

### 6.1 Comportement actuel

- les jetons sont conservés dans sessionStorage ;
- Supabase renouvelle automatiquement le token ;
- AuthContext charge le profil autoritatif user_profiles ;
- MandatoryMfaGate bloque le contenu privé si l’enrôlement n’est pas confirmé ;
- UpdatePassword intègre également TwoFactorSetup ;
- les Edge Functions sensibles vérifient le bearer token, le profil actif, le rattachement, la date d’enrôlement MFA et le niveau AAL2 ;
- les fonctions Edge ont verify_jwt=false au gateway, mais réalisent elles-mêmes admin.auth.getUser(token).

Preuves :

- [src/lib/supabase.ts](../src/lib/supabase.ts) ;
- [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx) ;
- [src/components/auth/MandatoryMfaGate.tsx](../src/components/auth/MandatoryMfaGate.tsx) ;
- [src/pages/auth/UpdatePassword.tsx](../src/pages/auth/UpdatePassword.tsx) ;
- [src/services/mfaService.ts](../src/services/mfaService.ts) ;
- [supabase/functions/create-user/index.ts](../supabase/functions/create-user/index.ts).

### 6.2 Sessions

[src/lib/sessionManager.ts](../src/lib/sessionManager.ts) applique dix minutes d’inactivité et un avertissement une minute avant expiration. Le retour sur un onglet vérifie l’expiration sans constituer une activité.

Trois fonctions de persistance serveur des sessions sont présentes mais sans appel constaté hors tests/définition :

- createSessionRecord ;
- cleanupExpiredSessions ;
- invalidateAllSessions.

La désactivation d’un compte est vérifiée lors du chargement du profil et dans les Edge Functions, mais la révocation globale de tous les refresh tokens actifs n’est pas démontrée. Le Lot 1 doit caractériser ce scénario.

### 6.3 Risques à traiter

- double orchestration MFA entre UpdatePassword et MandatoryMfaGate ;
- possibilité de divergence entre mfa_enrolled_at et les facteurs Supabase ;
- migrations MFA locales non appliquées à distance ;
- fonction invalidateAllSessions dangereuse si elle est appelée un jour sans restriction serveur ;
- réinitialisation MFA à documenter et tester en AAL2 avec audit.

## 7. Workflows actuels, statuts et transitions

### 7.1 Achats industriels SONASP

Point d’entrée : plans d’achat puis demandes par mine.

Chaîne observée :

    plan brouillon
      -> répartition entre mines
      -> soumission
      -> demande par mine
      -> réponse mine
      -> transaction/facture
      -> règlement
      -> exécution/rapprochement

La migration [20260820_012_achats_industriels_operations.sql](../supabase/migrations/20260820_012_achats_industriels_operations.sql) fournit des fonctions atomiques, des verrous de ligne, des contrôles de quantité et des numéros de dossier.

Faiblesse majeure : snp_est_agent_sonasp considère comme agent toute personne active sans mining_company_id. snp_peut_valider autorise owner, admin et management. Il n’y a donc pas de séparation explicite Gestionnaire/Approbateur/Finances.

### 7.2 Règlements

[20260820_016_reglements_operations.sql](../supabase/migrations/20260820_016_reglements_operations.sql) définit :

| Statut | Transitions |
|---|---|
| brouillon | soumis, annule |
| soumis | valide, rejete, annule |
| valide | en_execution, rejete, annule |
| en_execution | execute, rejete |
| execute | rapproche |

Points positifs :

- montant positif ;
- compte bancaire lié au bénéficiaire ;
- verrouillage de la ligne ;
- motif requis pour rejet/annulation ;
- preuve bancaire obligatoire avant execute ;
- journalisation des acteurs et dates.

Écart de séparation :

- le même groupe owner/admin/management valide, exécute et rapproche ;
- l’interdiction de valider son propre ordre comporte une exception lorsque le système compte un seul validateur ;
- aucune capacité Finances distincte n’est exigée pour exécuter ou rapprocher.

La cible doit interdire toute exception de séparation en production. L’absence d’un second acteur doit bloquer le dossier, pas abaisser le contrôle.

### 7.3 Contrats

[20260821_021_contrats_operations.sql](../supabase/migrations/20260821_021_contrats_operations.sql) conserve une machine d’état riche :

brouillon -> soumis -> revue_juridique -> validation_metier -> validation_financiere -> approuve -> signe -> actif, avec rejet, annulation, suspension, résiliation et clôture.

Les transitions, motifs, historiques et verrous sont à préserver. Les étapes existent, mais les acteurs sont encore réduits aux helpers de rôle génériques.

### 7.4 Réquisitions

[20260821_023_requisitions_operations.sql](../supabase/migrations/20260821_023_requisitions_operations.sql) couvre :

brouillon -> vérification juridique -> validation métier -> validation direction -> autorisée -> notifiée -> accusée/contestée -> exécutoire -> enlèvement -> collecte -> analyse -> acceptation -> facturation -> paiement -> clôture.

Ce workflow ne doit pas être simplifié. Il doit être relié à des capacités précises, aux preuves, au stock et aux notifications.

### 7.5 Ventes

Les migrations [20260822171500_ventes_decisions_atomiques.sql](../supabase/migrations/20260822171500_ventes_decisions_atomiques.sql) et [20260822173000_ventes_export_atomiques.sql](../supabase/migrations/20260822173000_ventes_export_atomiques.sql) apportent MFA, verrous, contrôles d’assignation, audit et réservation de lots.

Elles sont locales uniquement selon la liste distante. Leur protection ne peut donc pas être invoquée comme garantie de production.

Le recentrage du portail Mine, [20260823133000_recentrer_portail_mine_modules_nationaux.sql](../supabase/migrations/20260823133000_recentrer_portail_mine_modules_nationaux.sql), est en revanche reconnu localement et à distance.

### 7.6 Artisanat, comptoirs et collecteurs

Les tables et écrans couvrent déjà artisans, cartes, sites, productions, ventes, achats, paiements et taxes. Cependant :

- le rattachement autoritatif d’un Agent Collecteur à ses orpailleurs n’est pas établi comme périmètre serveur uniforme ;
- Comptoir d’achat n’est pas un rôle/périmètre complet avec stock, paiements, taxes et ventes ;
- des politiques universelles persistent sur des tables artisanales ;
- les historiques de rattachement et les tests croisés collecteur A / collecteur B sont insuffisants.

La mise en œuvre doit étendre l’existant et non créer un second module parallèle.

## 8. Relations de données et dépendances

### 8.1 Graphe métier principal

    user_profiles
       +-- mining_company_id -> mining_companies
       +-- site_ids / user_site_assignments
       +-- user_permissions

    mining_companies
       +-- daily_production
       +-- budgets / forecasts
       +-- export_licenses
       +-- shipments / documents
       +-- inventory / transactions
       +-- sales / payments
       +-- demandes / contrats / requisitions

    artisans / sites
       +-- activities / cartes / documents
       +-- productions
       +-- achats / ventes
       +-- paiements / taxes / factures

    sale or achat
       +-- status history
       +-- audit trail
       +-- documents
       +-- payment
       +-- inventory movement
       +-- notification

### 8.2 Risque de périmètre sur les tables enfant

Les tables parentes portent souvent mining_company_id, mais plusieurs tables enfant, historiques, documents, quotas ou liaisons n’ont pas de périmètre autonome. Leur sécurité dépend d’un join correct vers le parent dans chaque policy ou RPC.

Le test obligatoire est un scénario à deux organisations :

- acteur A crée ou lit un objet A ;
- acteur B tente SELECT, UPDATE, DELETE, RPC et Storage sur l’identifiant A ;
- toutes les opérations doivent échouer côté serveur sans dépendre de l’interface.

## 9. État des migrations et de la base distante

### 9.1 Divergence de chaîne de migration

Résultat de supabase migration list --linked :

| État | Nombre |
|---|---:|
| Entrées totales | 182 |
| Reconnues local + distant | 4 |
| Locales uniquement | 106 |
| Distantes uniquement | 72 |

Onze fichiers sont ignorés car leur nom ne respecte pas le format de timestamp Supabase. Cela rend impossible une reconstruction fiable d’un environnement à partir du dépôt seul.

Migrations récentes reconnues des deux côtés :

- 20260822154000 ;
- 20260823103000 ;
- 20260823130000 ;
- 20260823133000.

Migrations récentes locales uniquement :

- 20260822163500 ;
- 20260822164500 ;
- 20260822170000 ;
- 20260822171500 ;
- 20260822173000 ;
- 20260822174500 ;
- 20260822180000 ;
- 20260823153000.

### 9.2 RLS distante

Mesure sur le dump public distant :

| Mesure | Valeur |
|---|---:|
| Tables publiques | 153 |
| Tables avec RLS activée | 153 |
| Politiques | 533 |
| Politiques avec USING(true) ou WITH CHECK(true) | 247 |
| Politiques d’écriture universelles | 140 |
| Tables touchées par ces écritures universelles | 65 |
| Mentions SECURITY DEFINER | 173 |

Exemples de domaines exposés par des politiques d’écriture universelles :

- user_profiles et user_sessions ;
- mining_companies ;
- gold_inventory et inventory_transactions ;
- payments ;
- freight shipments et documents ;
- clients, banques et raffineries ;
- ventes et notifications ;
- artisans, cartes, activités, paiements, taxes et documents.

L’activation RLS est donc réelle, mais son effet est neutralisé sur de nombreux objets par des politiques trop permissives.

### 9.3 Fonctions distantes cassées

supabase db lint --linked reproduit notamment :

- références à des tables absentes : essai_resultats, batches, batch_status_history ;
- colonnes absentes : permission/resource, batch_id, user_id et plusieurs colonnes FX ;
- types incompatibles uuid/text dans user_accessible_companies et user_has_company_access ;
- fonctions de prix ambiguës ou mal formées ;
- erreurs GROUP BY ;
- format specifier invalide dans check_sale_authorization ;
- gen_random_bytes indisponible dans generate_activation_token ;
- séquence absente dans generate_bar_reference ;
- trigger add_audit_fields en erreur.

Ces erreurs montrent une dérive entre fonctions déployées et schéma courant. Elles doivent être inventoriées et classées avant toute nouvelle migration.

## 10. Vulnérabilités et menaces

### 10.1 Registre priorisé

| ID | Menace | DREAD / 50 | Priorité | Preuve |
|---|---|---:|---|---|
| SEC-01 | écriture inter-organisation via RLS universelle | 46 | critique | 140 politiques d’écriture universelles |
| SEC-02 | privilèges incohérents entre six référentiels | 43 | critique | permissions.ts, UserPermissionsTab, routes, mineAccess, user_permissions, SQL |
| SEC-03 | migrations de sécurité absentes du distant | 45 | critique | migration list |
| SEC-04 | fonctions SECURITY DEFINER cassées ou obsolètes | 42 | critique | db lint distant |
| SEC-05 | attribution Owner depuis un compte Owner | 38 | haute | roleHierarchy, create-user, migration 153000 |
| SEC-06 | absence de vraie séparation Gestionnaire/Approbateur/Finances | 40 | haute | snp_est_agent_sonasp, snp_peut_valider |
| SEC-07 | documents Storage lisibles/écrits sans périmètre suffisant | 39 | haute | policies historiques ; migration restrictive non appliquée |
| SEC-08 | révocation de sessions après désactivation non démontrée | 32 | haute | sessionManager et Edge Functions |
| SEC-09 | absence de CSP/HSTS | 24 | moyenne | vercel.json |
| SEC-10 | xlsx vulnérable sans correctif | 29 | haute | npm audit |

### 10.2 STRIDE

- **Spoofing** : ancien token, divergence MFA, réinitialisation 2FA.
- **Tampering** : écritures universelles, modification directe de payload, RPC obsolète.
- **Repudiation** : certaines opérations ont un historique solide, d’autres reposent sur audit_trail ouvert à tout utilisateur authentifié.
- **Information disclosure** : SELECT universels sur audit, documents, clients, stocks et paiements.
- **Denial of service** : typecheck excessif, service worker/chunks obsolètes, fonctions SQL cassées.
- **Elevation of privilege** : multiples matrices, Owner attribuable, admin et management trop puissants.

### 10.3 Secrets et dépendances

Le scan des sources et Edge Functions n’a identifié aucun secret confirmé. Trois occurrences ont été examinées et correspondent à des libellés/traductions ou à un jeton de test.

npm audit --omit=dev :

- xlsx : deux vulnérabilités hautes, sans correctif disponible ;
- esbuild/Vite : une vulnérabilité modérée, correction proposée seulement via changement majeur.

Action : isoler l’import Excel, limiter taille/type, désactiver les fonctions non requises, tester une alternative compatible et ne pas lancer npm audit fix --force.

## 11. Anomalies et risques de régression

### 11.1 Anomalies confirmées

- matrices de permissions contradictoires ;
- admin métier trop puissant ;
- Owner encore disponible dans le parcours ordinaire d’un Owner ;
- migration de hiérarchie non déployée ;
- migrations de sécurité et ventes atomiques non déployées ;
- RLS permissive ;
- fonctions distantes cassées ;
- tests administration rouges ;
- typecheck non borné ;
- documentation racine obsolète sur la taille du schéma ;
- aucun test SQL/pgTAP trouvé ;
- stockage documentaire non démontré par organisation sur l’état distant.

### 11.2 Régressions actuelles reproduites

Vitest :

- 919 tests réussis ;
- 11 tests échoués ;
- 2 fichiers sources de tests affectés.

Les quatre échecs de referentielForms concernent l’association accessible du libellé Nom du contact et le formulaire transport. Les sept échecs UserManagementModern couvrent les rôles proposés, les validations d’étapes, la création d’un compte interne, les dépendances de droits, le rattachement Mine, la restitution d’erreur et le chargement en édition.

### 11.3 Risques si les rôles sont modifiés immédiatement

- perte d’accès aux portails spécialisés ;
- politiques SQL qui continuent d’accepter l’ancien rôle ;
- comptes sans route d’accueil ;
- approbations bloquées ;
- historique attribué à un rôle devenu invalide ;
- contournement via une Edge Function non mise à jour ;
- données inter-organisations visibles à cause d’un fallback ;
- impossibilité de rollback si les valeurs sont renommées physiquement.

## 12. Architecture cible compatible

La cible ne remplace pas l’architecture. Elle consolide l’autorité serveur :

    profil Auth actif
        -> organisations et périmètres
        -> rôles de compatibilité
        -> capacités explicites
        -> RPC transactionnelle
        -> RLS restrictive
        -> historique immuable

Principes :

1. garder les neuf rôles tant que leurs portails existent ;
2. retirer Owner de l’interface et des endpoints interactifs ;
3. séparer rôle de portail, organisation et capacité métier ;
4. interdire les écritures sensibles directes depuis les pages ;
5. exiger des RPC atomiques pour transitions, paiements et stocks ;
6. dériver les menus et actions depuis les mêmes capacités que le serveur ;
7. refuser par défaut lorsqu’un périmètre manque ;
8. conserver les identifiants, données et historiques.

## 13. Améliorations proposées

### 13.1 Priorité immédiate

- geler les migrations structurelles ;
- corriger la chaîne de migration et créer un environnement de répétition ;
- sauvegarder schéma + données avant intervention ;
- produire un inventaire des politiques et fonctions réellement actives ;
- corriger les 11 tests actuels sans élargir les droits ;
- borner et optimiser le typecheck ;
- ajouter des tests SQL négatifs à deux organisations.

### 13.2 Rôles et administration

- masquer Owner partout dans l’UI ;
- refuser Owner dans create-user et dans les RPC interactives ;
- limiter Admin à comptes, référentiels techniques et support autorisé ;
- conserver Management pour compatibilité, puis migrer ses capacités ;
- rendre Manager strictement read-only côté SQL, pas seulement dans ProtectedRoute ;
- afficher les rôles selon le type d’organisation et les capacités de l’acteur.

### 13.3 Workflows

- Gestionnaire : créer, modifier brouillon, soumettre ;
- Approbateur : contrôler, approuver/rejeter avec motif, jamais son propre dossier ;
- Finances : exécuter, joindre la preuve, rapprocher ;
- Comptoir : achats, paiements, stock, taxes, ventes dans son périmètre ;
- Agent Collecteur : orpailleurs et productions assignés, avec historique de rattachement ;
- stock : ledger append-only, clé d’idempotence, contrainte de quantité positive et référence métier unique ;
- toute correction après validation par écriture compensatoire, jamais modification silencieuse.

## 14. Migrations nécessaires

Les migrations doivent être additives et répétées sur un clone avant production.

### Migration A — réconciliation

- normaliser les noms de fichiers ;
- établir une baseline signée du schéma distant ;
- rattacher les 72 migrations distantes à une histoire versionnée ;
- ne marquer une migration comme appliquée qu’après comparaison de checksum.

### Migration B — capacités et périmètres

- tables capability_catalog, role_capabilities et user_capabilities ou équivalent ;
- contraintes organisationnelles pour SONASP, mine, comptoir, collecteur ;
- fonction serveur unique de résolution des capacités ;
- compatibilité avec les neuf rôles.

### Migration C — Owner et administration

- interdiction de créer/promouvoir Owner via une session utilisateur ;
- script de bootstrap/rotation séparé ;
- journal immuable des actions comptes ;
- contrôle de hiérarchie transactionnel.

### Migration D — séparation des tâches

- capacités distinctes prepare, approve, execute, reconcile ;
- contraintes empêchant le même utilisateur de cumuler des étapes incompatibles sur un dossier ;
- suppression de l’exception « validateur unique » ;
- réauthentification AAL2 sur décisions et paiements.

### Migration E — RLS et Storage

- remplacer chaque politique universelle par un périmètre explicite ;
- protéger parents et enfants ;
- politiques Storage basées sur métadonnée propriétaire et organisation ;
- tests A/B pour SELECT, INSERT, UPDATE, DELETE et objets Storage.

### Migration F — stock et idempotence

- ledger append-only ;
- clés métier/idempotency_key uniques ;
- réservation atomique ;
- mouvements compensatoires ;
- rapprochement vente/paiement/stock.

## 15. Plan de tests

### 15.1 Caractérisation avant modification

| Domaine | Positif | Négatif |
|---|---|---|
| Auth | mot de passe + TOTP + AAL2 | token expiré, compte désactivé, MFA non confirmé |
| Comptes | Admin crée un rôle inférieur autorisé | auto-édition, promotion Owner, rôle supérieur |
| Mine | lit/écrit sa production | accède à une autre mine par ID ou RPC |
| Gestionnaire | prépare et soumet | approuve son propre dossier |
| Approbateur | approuve ou rejette avec motif | modifie le brouillon ou exécute le paiement |
| Finances | paie avec preuve et rapproche | approuve le dossier métier |
| Comptoir | gère ses achats et son stock | lit le stock d’un autre comptoir |
| Collecteur | suit ses orpailleurs | remplace l’identifiant par celui d’un autre collecteur |
| Documents | upload/type/taille autorisés | chemin d’un autre organisme, MIME falsifié |
| Stock | réservation et mouvement uniques | double clic, rejeu, concurrence |

### 15.2 Tests techniques obligatoires

- tests unitaires des capacités ;
- tests de guards comme confort UX ;
- tests d’intégration Edge Functions ;
- pgTAP ou équivalent sur RLS/RPC ;
- tests concurrents sur paiements et stocks ;
- tests de migration up et rollback logique ;
- tests E2E par portail ;
- vérification build, lint, typecheck et suite complète ;
- test de mise à jour PWA et de chunks obsolètes ;
- test des autres portails après chaque lot.

### 15.3 Critère de sortie

Aucun lot n’est vert si :

- un test négatif permet une action ;
- un workflow peut sauter une approbation ;
- un rôle voit une organisation étrangère ;
- une migration n’est pas reproductible ;
- un test existant critique échoue ;
- le typecheck ou le build n’est pas déterministe.

## 16. Plan de lots

### Lot 1 — socle et preuve

- réconcilier les migrations ;
- corriger les tests rouges ;
- borner le typecheck ;
- tests de caractérisation Auth/RLS ;
- corriger en priorité les politiques critiques et fonctions SQL cassées.

Sortie : environnement reproductible, aucune écriture inter-périmètre, tests de socle verts.

### Lot 2 — rôles

- Owner script-only ;
- Admin administratif ;
- capacités métier additives ;
- formulaire filtré ;
- compatibilité des portails.

Sortie : matrice serveur testée, aucun portail historique cassé.

### Lot 3 — SONASP

- Gestionnaire/Approbateur/Finances ;
- transitions et preuves ;
- audit et notifications ;
- suppression de toute exception de séparation.

Sortie : achats, ventes et règlements E2E positifs/négatifs.

### Lot 4 — Comptoir

- périmètre organisationnel ;
- achats, DGI, paiements, ventes, stocks et taxes ;
- tableau de bord et marché.

Sortie : isolation de deux comptoirs et cohérence stock/finance.

### Lot 5 — Agent Collecteur

- rattachements historisés ;
- orpailleurs et production ;
- périmètre strict ;
- conservation du module artisanal existant.

Sortie : tests croisés de deux collecteurs et reprise des données existantes.

### Lot 6 — validation globale

- sécurité ;
- migrations ;
- E2E ;
- non-régression ;
- performance ;
- build et déploiement contrôlé.

Sortie : rapport de preuve, rollback testé, approbation métier.

## 17. Plan de retour arrière

1. sauvegarde chiffrée et testée de la base avant chaque lot ;
2. migration additive : nouvelles colonnes/tables/capacités sans suppression immédiate ;
3. feature flag par lot et par portail ;
4. double lecture contrôlée pendant la transition, une seule source d’écriture ;
5. journal des mappings ancien rôle -> capacités ;
6. rollback applicatif vers le commit précédent ;
7. désactivation des nouvelles capacités sans supprimer les données ;
8. migrations compensatoires préparées et testées ;
9. aucune suppression de colonne, enum ou table avant une période de stabilité et un export vérifié.

## 18. Questions métier à arbitrer

Avant le Lot 2, le propriétaire produit doit confirmer :

1. Management correspond-il à la Direction approbatrice, au Gestionnaire, ou aux deux aujourd’hui ?
2. Manager lecture seule doit-il rester un rôle ou devenir une capacité de consultation ?
3. Un Approbateur peut-il aussi être Gestionnaire sur des domaines différents ?
4. Finances peut-il rapprocher un paiement qu’il a exécuté ?
5. Comptoir est-il une organisation distincte, un site, ou un type de stakeholder existant ?
6. Un Agent Collecteur dépend-il d’un seul comptoir à une date donnée ?
7. Quelle pièce DGI est obligatoire et à quel statut devient-elle immuable ?
8. Quels workflows nécessitent obligatoirement deux personnes distinctes en cas d’effectif réduit ?
9. Quelle procédure hors interface attribue et récupère le compte Owner ?

## 19. Conclusion

La plateforme possède un socle métier riche qu’il faut préserver. Les problèmes ne viennent pas d’un manque d’écrans, mais d’une autorité d’accès fragmentée, d’une chaîne de migration non reproductible et d’une séparation des tâches seulement partielle.

La prochaine action autorisée n’est pas la suppression de rôles dans le formulaire. C’est le **Lot 1 : réconciliation des migrations, correction du baseline de tests, verrouillage des écritures RLS critiques et ajout des tests de caractérisation serveur**.

Tant que ces preuves ne sont pas vertes, aucune modification structurelle de rôle, aucun déploiement de workflow et aucune déclaration de fin de mission ne sont justifiés.
