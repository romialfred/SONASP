# Audit complet de sécurité, robustesse, performance et complétude

## Plateforme SONASP — Portail national, portail Société minière, portail Comptoir/Collecteur et profils partenaires

| Métadonnée | Valeur |
|---|---|
| Date de l'audit | 24 août 2026 |
| Dépôt | `F:\Development\SONASP` |
| Branche / commit | `SONASP_2026` / `42f1441308857f0a9deb720c597db4901d8e221f` |
| Base liée auditée | Supabase `yyverzuhkdonjjuficor`, PostgreSQL 17.6 |
| Nature | Audit en lecture seule, sans correction, déploiement ni mutation de données |
| Périmètre | Frontend, routes, formulaires, services, Edge Functions, schéma live, RLS, Storage, fonctions, contraintes, migrations, tests, dépendances et performance structurelle |

## 1. Conclusion exécutive

### Verdict

**La plateforme n'est pas apte à une mise en production multi-portails sécurisée en l'état.**

L'architecture possède de bonnes fondations — authentification PKCE, MFA global côté interface, modèle récent de capabilities, RLS activée partout, contrôles organisationnels récents, build de production fonctionnel et 1 023 tests unitaires réussis — mais ces protections sont contournées par plusieurs chemins plus anciens ou incomplets.

Les principaux bloqueurs sont :

1. des politiques RLS live globales sur des tables métier centrales, notamment les expéditions, les mines, les achats, les sessions et les journaux ;
2. des fonctions `SECURITY DEFINER` sensibles exécutables par `anon` ou `PUBLIC`, capables de contourner la RLS ;
3. des documents miniers et d'expédition insuffisamment cloisonnés ;
4. une gestion du quota d'export incohérente, non idempotente et affectée par une erreur d'unité ;
5. un schéma live impossible à reconstruire fidèlement depuis le dépôt ;
6. des workflows Collecteur et Comptoir→SONASP incomplets côté interface ;
7. un contrôle d'autorisation frontend fragmenté et un contrôle TypeScript qui échoue ;
8. une couverture de tests respectable en volume, mais insuffisante sur les frontières de sécurité et les parcours multi-acteurs.

### Décision recommandée

Mettre en place un **gel des changements fonctionnels et des migrations** jusqu'à la fermeture des P0, l'établissement d'une baseline SQL unique et la réussite d'une campagne négative multi-tenant. Toute mise en ligne antérieure doit être considérée comme une exposition contrôlée, non comme une homologation de sécurité.

## 2. Chiffres clés

### Base live

| Indicateur | Résultat |
|---|---:|
| Tables `public` | 165 |
| Tables avec RLS | 165 / 165 |
| Tables avec `FORCE RLS` | 0 / 165 |
| Policies | 561, dont 485 permissives |
| Opérations globales pour `authenticated` | 120, dont 70 écritures |
| Fonctions | 359 |
| Fonctions `SECURITY DEFINER` | 208 |
| `SECURITY DEFINER` exécutables par `anon` | 205 |
| `SECURITY DEFINER` conservant `PUBLIC` | 104 |
| `SECURITY DEFINER` sans `search_path` fixé | 79 |
| PK / FK / UNIQUE / CHECK | 162 / 369 / 82 / 370 |
| Colonnes suffixées `_id` sans FK | 45 |
| FK sans index couvrant en tête | 174 / 369 |
| Erreurs / avertissements du linter DB | 16 / 11 |
| Migrations communes local/live | 17 |
| Versions locales absentes du serveur | 28 |
| Versions serveur absentes du dépôt | 72 |

### Application et qualité

| Indicateur | Résultat |
|---|---:|
| Fichiers TS/TSX | 581 |
| Routes privées littérales | 148 |
| Routes uniquement authentifiées, sans rôle/capability explicite | 68 |
| Services | 131 |
| Pages | 185 |
| Edge Functions | 12 |
| Build production | Réussi |
| Lint ESLint | Réussi |
| Typecheck TypeScript | Échec, nombreux diagnostics structurants |
| Tests | 1 023 / 1 023 réussis, 135 fichiers |
| Couverture lignes / branches / fonctions | 65,17 % / 53,26 % / 59,12 % |
| Dépendances production vulnérables | 2 high, 1 moderate |

## 3. Méthode et limites

### Méthode

- revue statique du code React/TypeScript, des services Supabase et des Edge Functions ;
- inventaire de toutes les routes et rapprochement avec les menus ;
- analyse des migrations SQL, policies, fonctions, triggers, grants, buckets et appels `.from()` / `.rpc()` ;
- interrogation en lecture seule des catalogues de la base liée ;
- contrôles d'intégrité par agrégats et jointures sans mutation ;
- build, lint, typecheck, tests complets avec couverture et suites ciblées d'autorisation ;
- audit `npm`, analyse des bundles et mesures HTTP de la vitrine publique ;
- inspection du comportement public dans un navigateur.

### Limites

- aucune tentative d'exploitation active des vulnérabilités P0 ;
- aucun INSERT, UPDATE, DELETE, DDL ou test pgTAP sur la base live ;
- aucun accès authentifié fourni pour rejouer tous les portails en navigateur ;
- aucun test de charge ni `EXPLAIN ANALYZE` ;
- aucun secret n'a été extrait ;
- les performances des portails authentifiés restent à mesurer sur un environnement de recette avec des jeux de données représentatifs.

Ces limites n'invalident pas les constats de catalogue live : les policies, grants, fonctions, contraintes et divergences de tenant ont été observés directement.

## 4. Modèle de confiance attendu

```text
Utilisateur / navigateur
        |
        | JWT court + MFA AAL2 + capability + tenant
        v
API Supabase / Edge Function
        |
        | RPC transactionnelle à liste blanche
        v
RLS restrictive + contraintes + journal immuable
        |
        +--> données SONASP nationales
        +--> données Mine A strictement isolées
        +--> données Mine B strictement isolées
        +--> données Comptoir / Collecteur / Artisans assignés
        +--> Storage privé contrôlé par l'objet métier parent
```

Dans l'état actuel, plusieurs écritures navigateur→table, RPC anonymes et policies `TRUE` court-circuitent cette chaîne.

## 5. Constats P0 — bloqueurs immédiats

### P0-01 — RLS globale sur des tables métier centrales — confirmé live

**Preuves live** : 120 couples table/action offrent une policy permissive équivalente à `TRUE` pour `authenticated`, dont 70 écritures.

Cas critiques :

- `shipping_preparations` : SELECT, INSERT, UPDATE et DELETE globaux ;
- `mining_companies` : mutations globales ;
- `snp_achats_mines` : `ALL USING(true) WITH CHECK(true)` ;
- `user_sessions` : `ALL TRUE` ;
- `audit_logs` et `audit_trail` : lecture et insertion globales.

Références : `supabase/migrations/fix_shipping_rls_only.sql:39-62`, `supabase/migrations/20260819_007_achats_mines.sql:72`, `src/services/shippingPreparationService.ts:91`, `src/services/achatMineService.ts:190`.

**Impact** : lecture/altération inter-mine, suppression ou changement arbitraire de statut d'expéditions, modification de référentiels, vol de sessions et falsification des traces.

**Correction** :

1. supprimer toutes les policies héritées `TRUE` ;
2. ajouter des policies restrictives par `organization_id` / `mining_company_id` ;
3. rendre le tenant immuable ;
4. retirer INSERT/UPDATE/DELETE directs des rôles API ;
5. imposer des RPC transactionnelles pour toute transition métier ;
6. tester `anon`, AAL1, mine A, mine B, comptoir, collecteur, manager et SONASP.

### P0-02 — Fonctions privilégiées accessibles anonymement — confirmé live

La base contient 208 fonctions `SECURITY DEFINER`; 205 sont exécutables par `anon`, 104 gardent `PUBLIC` et 79 n'imposent pas de `search_path`.

Fonctions prioritaires :

- `create_artisan_sale_to_sonasp` : crée une vente financière sans identité/capability ;
- `release_license_quota` et `reserve_license_quota` : modifient les quotas sans contrôle de périmètre suffisant ;
- `snp_societes_eligibles_paiement` et `snp_factures_eligibles` : exposent des données financières ;
- `get_shipping_assay_certificates`, statistiques certificats et compteur d'expédition ;
- `log_security_event` et `log_user_activity` : forge des journaux ;
- `generate_activation_token` / `validate_activation_token` : modèle de jeton et mot de passe temporaire non sûr.

Références : `supabase/migrations/20260820_016_reglements_operations.sql:23-90`, `supabase/migrations/20260824235700_corriger_fonctions_metier_actives.sql:110-207`, `supabase/migrations/add_license_quota_functions.sql:31-205`, `scripts/IMPLEMENT-ARTISAN-SONASP-SALES-LOGIC-FIXED.sql:194`.

**Correction d'urgence** :

```sql
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
```

Puis réaccorder uniquement une liste blanche. Chaque RPC privilégiée doit :

- fixer `search_path = public, pg_temp` ;
- qualifier tous les objets ;
- dériver l'acteur depuis `auth.uid()` ;
- vérifier AAL2, capability et tenant avant toute lecture ;
- ignorer tout `actor_id` fourni par le client ;
- produire un audit serveur non modifiable.

### P0-03 — Documents métier insuffisamment cloisonnés — confirmé live/statique

- `mining-company-documents` est privé, mais tout `authenticated` peut lire, téléverser et supprimer les objets de toutes les mines ;
- les migrations historiques rendent `shipping-documents` et `ASSAY-CERTIFICATES` publics ou largement modifiables ;
- l'application génère des URL publiques ;
- les contrôles MIME/taille reposent principalement sur le client.

Références : `supabase/migrations/20260818_001_extend_mining_companies_localisation_documents.sql:43-58`, `supabase/migrations/20251113_011_fix_assay_certificates_storage.sql:16-88`, `src/components/shipping/DocumentUploadSection.tsx:55-78`, `src/services/assayCertificateService.ts:72-128`.

**Impact** : exfiltration, remplacement et destruction de documents réglementaires inter-tenant.

**Correction** : buckets privés, URL signées courtes, contrôle serveur de l'objet parent et du tenant, interdiction du listing global, zone de quarantaine, magic bytes, antivirus/CDR, limites MIME/taille, journalisation du téléchargement.

### P0-04 — Quota d'export incohérent et erreur d'unité — confirmé live

Le trigger de réservation transmet `total_weight_oz` à une fonction qui traite la valeur comme des grammes. Le quota peut être sous-réservé d'un facteur d'environ 28,35 à 31,10.

Autres défauts :

- deux colonnes concurrentes `license_id` et `export_license_id` ;
- 4 expéditions sur 16 ont des valeurs divergentes ;
- réservation sur une colonne et libération sur l'autre ;
- référence à `OLD.total_weight_grams`, colonne inexistante, avec exception absorbée ;
- triggers de libération dupliqués ;
- recalcul concurrent susceptible de neutraliser une réservation ;
- RPC de réservation/libération non suffisamment autorisées et acteur usurpable.

Références : `supabase/migrations/20251115_001_add_license_quota_functions.sql:32`, `supabase/migrations/20260824235700_corriger_fonctions_metier_actives.sql:110-165`, `src/services/shippingPreparationService.ts:397-431`.

**Correction** : une colonne licence canonique, un poids canonique en grammes, conversion explicite à la frontière, ledger idempotent unique `(license_id, shipping_id)`, verrou de ligne, transaction unique création/réservation/libération et tests concurrents.

## 6. Constats P1 — risques élevés et incomplétudes majeures

### P1-01 — Grants excessifs et absence de `FORCE RLS`

- `anon` possède SELECT sur 150 tables et DML sur 148 ;
- `authenticated` possède DML sur 161 tables ;
- `TRUNCATE`, `TRIGGER` et `REFERENCES` sont largement accordés aux rôles API ;
- aucune table n'active `FORCE RLS`.

La RLS seule ne compense pas un modèle de grants aussi large, surtout avec des fonctions détenues par `postgres`.

**Correction** : modèle de moindre privilège, aucun DML direct sur les agrégats financiers/réglementaires, retrait de TRUNCATE/TRIGGER/REFERENCES, `FORCE RLS` sur les tables où des propriétaires/fonctions pourraient contourner la RLS.

### P1-02 — Vues et RPC susceptibles de contourner RLS/MFA

Les vues `assay_certificates_with_shipping`, `shipments_for_refinery`, `shipments_for_presale` et `daily_production_with_metals` ne démontrent pas `security_invoker=true` dans les scripts applicables et sont accordées largement.

Références : `supabase/migrations/unified_status_system_fixed.sql:192-211,390-411,520-523`, `supabase/migrations/20251113_012_add_silver_tracking_to_production.sql:128-153`.

**Correction** : recréer en `security_invoker`, sélectionner uniquement les colonnes nécessaires et appliquer un prédicat de tenant explicite.

### P1-03 — Séparation des fonctions contournable par DML direct

Le modèle récent de capabilities et de transitions est bon, mais des policies `FOR ALL` sur règlements, contrats et réquisitions utilisent une notion trop générale d'agent SONASP. Des appels PostgREST directs peuvent contourner la RPC de transition et la séparation préparateur/approbateur/finance.

Références : `supabase/migrations/20260823180000_capacites_et_separation_fonctions.sql:80-212,467-568`, `supabase/migrations/20260820_013_achats_industriels_habilitations.sql:127-135`, `supabase/migrations/20260821_020_contrats_fourniture.sql:394-417`, `supabase/migrations/20260821_022_requisitions_or.sql:326-369`.

**Correction** : SELECT seulement pour les clients, mutation via RPC atomique, transitions strictes, acteurs dérivés, trigger bloquant toute modification directe de statut.

### P1-04 — Cartes professionnelles et moyens de paiement artisans

- tout compte actif AAL2 peut potentiellement modifier les cartes professionnelles ;
- un Collecteur ayant accès à un artisan peut modifier KYC et coordonnées de paiement ;
- les champs de vérification et d'audit sont contrôlables depuis le navigateur.

Références : `supabase/migrations/20251226120554_26122025_01_artisan_minier_migration.sql:356-420`, `supabase/migrations/20260823190000_comptoirs_collecteurs_et_stock.sql:246-279,1037-1086`, `src/services/carteProfessionnelleService.ts:161-349`, `src/services/artisanMoyenPaiementService.ts:127-200`.

**Correction** : RPC dédiées, capability distincte pour coordonnées de paiement, double validation indépendante, champs d'audit serveur, historique avant/après immuable et notification hors bande au bénéficiaire.

### P1-05 — Hiérarchie des comptes et messagerie trop permissives

`management` peut appeler des fonctions de consultation globale et de récupération de mot de passe sans comparaison hiérarchique complète. La configuration SMTP peut être modifiée avec une capability d'approbation opérationnelle trop large.

Références : `supabase/functions/reset-user-password/index.ts:47-121`, `supabase/functions/get-users/index.ts:30-121`, `supabase/migrations/20260821_029_configurations_courriel_multiples.sql:125-282`.

**Correction** : `accounts.manage`, contrôle de la hiérarchie cible, capability `email.settings.manage`, double validation, alerte hors bande et interdiction de réinitialiser owner/admin depuis un rôle inférieur.

### P1-06 — Relations inter-modules et tenant non garantis

45 colonnes `_id` n'ont pas de FK. Relations prioritaires :

- `freight_shipments.shipping_preparation_id` ;
- `assay_certificate_data.shipping_preparation_id` ;
- `user_profiles.invitation_id` ;
- `snp_artisans_miniers.collecteur_id`.

Le modèle des sites mélange `text` et `uuid` : 221 productions et 10 budgets utilisent des identifiants legacy sans correspondance dans `sites`; le défaut `daily_production.site_id='guinea'` est incohérent avec le contexte Burkina.

Une expédition et un item d'expédition présentent déjà une divergence de société avec la production liée.

**Correction** : migration vers UUID, FK composites `(id, mining_company_id)`, contraintes différées de cohérence tenant, suppression des defaults legacy et vérification de tous les transferts Mine→Expédition→Fret→Inventaire→Vente.

### P1-07 — Une mine peut administrer sa propre licence réglementaire

Les policies isolent la licence par société, mais permettent à la mine de modifier quantité autorisée/utilisée, statut et quota.

Référence : `supabase/migrations/20260823210000_cloisonner_licences_export_mines.sql:88`.

**Correction** : la mine consulte et soumet une demande ; seule SONASP ou l'autorité habilitée valide et modifie l'autorisation. Les consommations sont calculées par le ledger, jamais éditées.

### P1-08 — Schéma live non reproductible

- 133 fichiers SQL locaux, dont 11 ignorés par le CLI ;
- 11 préfixes de version dupliqués ;
- seulement 17 versions communes ;
- 28 versions locales absentes du serveur ;
- 72 versions serveur absentes du dépôt.

En parallèle, 44 tables utilisées dans `.from()` sont absentes des migrations et 18 RPC utilisées sont absentes des migrations ; plusieurs restent absentes de tous les SQL du dépôt.

**Impact** : impossibilité de reconstruire une recette fiable, drift des types, erreurs 404 PostgREST et risque de déploiement non déterministe.

**Correction** : geler les migrations, extraire une baseline du live, reconstruire une base vierge, comparer catalogues/checksums, renommer chaque migration avec un timestamp unique et rendre le reset Supabase obligatoire en CI.

> **Mise à jour Lot 4D — 24 août 2026** : l'inventaire local est désormais figé par checksum sans renommer ni appliquer l'historique. Le catalogue est un garde-fou de non-régression, pas une preuve d'équivalence avec le live. Les chiffres actualisés, la méthode de rapprochement et les limites sont documentés dans [BASELINE-MIGRATIONS-ET-REPRODUCTIBILITE-2026-08-24.md](BASELINE-MIGRATIONS-ET-REPRODUCTIBILITE-2026-08-24.md).

### P1-09 — Fonctions live cassées et drift des sessions

Le linter DB retourne 16 erreurs et 11 avertissements : tables/colonnes supprimées, SQL dynamique invalide, agrégats incorrects, comparaisons `uuid=text`, colonnes inexistantes et fonctions FX cassées.

La table live `user_sessions` ne correspond pas au code : `is_active`, `device_info`, `browser`, `location` et `last_activity` sont attendus mais absents. Le token est stocké brut et toutes les sessions sont exposées par une policy globale.

Références : `src/services/userLoginService.ts:237`, `src/components/admin/SessionsTab.tsx:11`, `src/lib/sessionManager.ts:164`.

**Correction** : décider du contrat canonique, migration et types régénérés, token haché, accès propriétaire/admin strict, fonctions mortes retirées de l'API et lint DB bloquant.

### P1-10 — Profil Collecteur incomplet

Le modèle SQL et des capabilities existent, mais aucun type de compte, garde, menu, portail ou routage Collecteur complet n'existe. Un `customer` muni de `collector.operate` risque de recevoir la navigation nationale par défaut.

Références : `src/lib/capabilities.ts:14-60`, `src/components/layout/sidebarNavigation.ts:419-436`, `src/pages/admin/UserManagementModern.tsx:74-81`, `src/services/userManagementService.ts:5-17`, `supabase/functions/create-user/index.ts:234-239`.

**Correction** : compte Collecteur de premier rang, rattachement atomique au comptoir, garde/menu dédiés, liste des seuls artisans affectés, tests RLS et E2E du paiement/taxe/stock.

### P1-11 — Workflow Comptoir→SONASP bloqué après soumission

L'interface permet la soumission, mais aucune boîte de réception SONASP ni appel aux transitions accept/reject/pay n'est branché.

Références : `src/pages/comptoir/ComptoirSonaspSalesPage.tsx:59-102`, `src/services/comptoirPortalService.ts:201-227`, `supabase/migrations/20260824230000_portail_comptoir_cessions_sonasp.sql:283-372`.

**Correction** : file SONASP, approbation et paiement multi-acteurs, commentaires, notifications, historique et E2E Comptoir→SONASP→Finance.

### P1-12 — Stock disponible Comptoir incorrect après réservation

L'UI calcule le stock depuis le ledger physique sans soustraire les cessions `submitted`; le serveur les soustrait correctement. L'interface peut donc accepter un montant qu'elle sait seulement refuser tardivement.

Références : `src/pages/comptoir/ComptoirSonaspSalesPage.tsx:31-102`, `src/services/comptoirPortalService.ts:172-175`, `supabase/migrations/20260824230000_portail_comptoir_cessions_sonasp.sql:240-247`.

**Correction** : vue/RPC atomique `physique`, `réservé`, `libre`, validation serveur et client sur `libre`, verrou et test de deux soumissions concurrentes.

### P1-13 — Modification de compte non atomique

La modification recharge seulement `user_profiles`, perd l'identité Comptoir et sauvegarde profil, permissions et capabilities séparément. Une panne partielle crée un compte incohérent.

Référence : `src/pages/admin/UserManagementModern.tsx:286-307,476-503`.

**Correction** : DTO complet et RPC transactionnelle unique pour profil, organisation/mine, rôle, capabilities, permissions et audit, avec rollback testé.

### P1-14 — Autorisation des routes fragmentée

68 routes ne demandent qu'une session authentifiée. Les guards dédiés Mine, Comptoir et Manager sont une bonne base, mais Admin, Factory, Airport, Refinery, Customer simple et Collecteur reçoivent des comportements incohérents.

Références : `src/PrivateApp.tsx:270-466,531-606,854-960,1160-1193`, `src/components/auth/ProtectedRoute.tsx:115-137`.

**Correction** : registre déclaratif unique `route + roles + accountTypes + capabilities + readOnly`, source commune des routes, menus et tests. La RLS reste l'autorité finale.

### P1-15 — Navigation d'expédition cassée

La route réelle est `/shipping/preparation/:id/details`, mais succès, retour et annulation utilisent `/shipping/preparations/:id/details`, qui tombe sur 404. Une ancienne route d'édition pointe aussi vers le mauvais composant.

Références : `src/PrivateApp.tsx:872-905`, `src/pages/shipping/ShippingPreparationEdit.tsx:130-178,335-339`.

**Correction** : route builder typé, redirection temporaire de l'ancien format et tests des boutons Enregistrer/Retour/Annuler.

## 7. Constats P2/P3 — durcissement, robustesse et performance

### Téléversements

Contrôles de taille, magic bytes, MIME réel, antivirus et quarantaine manquants sur plusieurs services. L'attribut HTML `accept` ne constitue pas un contrôle de sécurité.

### MFA et sessions

Le gate MFA frontend est fail-closed, mais certaines tables créées après la migration MFA restent lisibles en AAL1. L'expiration d'inactivité est principalement côté navigateur ; un JWT volé reste utilisable jusqu'à son expiration.

### Audit

Certains journaux sont écrits directement par le navigateur avec acteur et détails choisis par le client. L'audit doit être append-only, produit par trigger/RPC serveur, horodaté côté serveur et protégé de toute modification.

### En-têtes HTTP

La production expose `nosniff`, `DENY`, une politique de référent et HSTS. Il manque une CSP stricte, COOP/CORP et un `Cache-Control: no-store` adapté au shell authentifié. L'en-tête `Access-Control-Allow-Origin: *` sur l'HTML public mérite d'être retiré s'il n'est pas requis.

### Dépendances

- `xlsx@0.18.5` : avis high sans correctif npm ;
- Vite 5 / esbuild : avis high/moderate, migration majeure proposée ;
- `caniuse-lite` a huit mois de retard.

Prévoir remplacement de `xlsx`, migration Vite testée, audit OSV/npm bloquant et mises à jour automatisées.

### TypeScript et complexité

Le build Vite réussit parce qu'il transpile sans imposer le contrat TypeScript. `npm run typecheck` échoue sur de nombreux diagnostics : tables et vues absentes des types, propriétés nullables, composants aux contrats divergents, routes/services legacy et variables mortes. Ce défaut doit devenir bloquant en CI.

L'analyse statique donne un score indicatif de 77,4/100 (C), avec 388 fonctions longues, 179 complexités élevées et 8 classes/composants de type « god object ». Les plus gros composants métier dépassent 1 000 à 1 500 lignes.

### Couverture

Les 1 023 tests passent, mais la couverture est de 65,17 % en lignes et 53,26 % en branches. Sont notamment absents :

- tests RLS/Storage `shipping_preparations` et `shipping-documents` ;
- tests RPC anonymes ;
- parcours Collecteur ;
- E2E Comptoir→SONASP→Finance ;
- test contractuel des 148 routes ;
- tests de concurrence quota/stock ;
- tests de composants des formulaires critiques.

### Indexation et concurrence

- 174 FK sans index couvrant en tête ;
- nombreux index dupliqués ;
- 319 index hors contrainte sans scan enregistré, à confirmer avant suppression ;
- `MAX()+1` pour un numéro d'achat est sujet aux collisions concurrentes.

Priorités : taxes/retenues par comptoir, ventes artisanales par comptoir, réquisition d'achat, comptes collecteurs, memberships organisation et cessions SONASP.

### Bundle et performance web

Build observé : environ 90 secondes. Chunks lourds :

- Recharts ~531 kB brut / 160 kB gzip ;
- certificat d'analyse ~487 kB / 145 kB gzip ;
- `xlsx` ~428 kB / 143 kB gzip ;
- jsPDF ~390 kB / 129 kB gzip ;
- `PrivateApp` ~153 kB / 42 kB gzip.

La vitrine publique répond entre ~0,34 et 0,71 s lors de mesures simples depuis le poste d'audit. Cela ne remplace pas un test de charge ou des Web Vitals terrain. Déporter les exports lourds, découper les pages métier et charger graphiques/PDF/XLSX seulement à la demande.

### PWA et robustesse de version

La stratégie `CacheFirst` des assets pendant 30 jours, combinée à `skipWaiting`, mérite un protocole de version explicite. Ajouter un manifeste de build, une stratégie de mise à jour atomique et un test de reprise après déploiement pour éviter les écrans de « rechargement nécessaire » et les mélanges de chunks.

## 8. Matrice par profil

| Profil | État fonctionnel | Cloisonnement | Verdict |
|---|---|---|---|
| Owner | Portail national complet ; accès Mine par query fragile | Peut contourner largement par design | À formaliser et auditer séparément |
| Admin | Administration présente | Routes et capabilities incohérentes | Partiel |
| Direction / Manager | Portail lecture seule présent | `shipping_preparations` échappe au read-only DB | Non validé |
| SONASP / Management | Fonctions nationales nombreuses | SoD contournable par DML direct | Non validé |
| Société minière | Portail le plus abouti | Fuite critique shipping/licences/docs | Non validé |
| Comptoir | Achats/DGI/paiement/stock structurés | Organisation récente plutôt solide | Incomplet après soumission SONASP |
| Collecteur | Modèle SQL partiel | Pas de portail/guard/account type | Manquant |
| Factory | Dashboard dédié, menu national par défaut | Contrat de route faible | Faible |
| Airport | Dashboard dédié, menu national par défaut | Contrat de route faible | Faible |
| Refinery | Dashboard dédié | Vues/objets shipping à durcir | Faible |
| Customer | Consultation partielle | Menu national trop large | Faible |

## 9. Matrice des workflows croisés

| Workflow | UI | API/RPC | DB/RLS | Verdict |
|---|---:|---:|---:|---|
| Mine → production / prévisions | Oui | Oui | Cloisonnement récent | Plutôt complet |
| Mine → licence → expédition | Oui | Oui | Quota/RLS P0 | Bloqué sécurité |
| Mine ↔ SONASP : contrats/réquisitions/règlements | Oui | Oui | SoD contournable | À durcir |
| Comptoir → achat artisan → facture DGI → paiement/taxe | Oui | Partiel | Modèle récent positif | À éprouver live |
| Comptoir → stock → cession SONASP | Soumission seule | Transitions DB sans UI | Bon socle RPC | Incomplet |
| Collecteur → artisans assignés | Non | Non branché | Modèle partiel | Manquant |
| SONASP → vente internationale → paiement | Oui | Oui | Données financières/RPC à durcir | Non validé |
| Expédition → fret → aéroport → raffinerie | Oui | Mutations directes | Tenant non garanti | Non validé |
| Administration des comptes | Oui | Création mieux protégée | Modification non atomique | Partiel |
| Audit / sessions / sécurité | Oui | Drift API/DB | Policies globales | Non fiable |

## 10. Contrôles positifs à préserver

- RLS activée sur les 165 tables ;
- toutes les 369 FK déclarées sont validées ;
- aucun index invalide ;
- `ProtectedRoute` échoue fermé si profil absent/inactif ;
- guards distincts Mine et Comptoir ;
- PKCE, sessionStorage et MFA global côté interface ;
- modèle récent organisation/capability cohérent ;
- ledger artisanal append-only et contrôles Comptoir récents ;
- cessions Comptoir→SONASP mutées par RPC avec capability et verrou ;
- politiques récentes du portail Mine sur budgets/prévisions/production ;
- CORS partagé des Edge Functions administratives en allowlist ;
- build, lint et 1 023 tests réussis ;
- aucun secret confirmé dans les fichiers suivis.

## 11. Feuille de route recommandée

### 0–24 heures — containment

1. Geler migrations et déploiements fonctionnels.
2. Révoquer `PUBLIC`/`anon` sur toutes les fonctions, puis réaccorder une liste blanche minimale.
3. Fermer les policies globales de `shipping_preparations`, `mining_companies`, `snp_achats_mines`, `user_sessions`, `audit_logs`, `audit_trail` et tokens d'activation.
4. Rendre tous les buckets métier privés et suspendre les URL publiques.
5. Désactiver temporairement réservation/libération de quota et vente artisanale anonyme jusqu'à correction.
6. Vérifier les journaux d'accès et procéder à une analyse d'incident si des données sensibles sont déjà présentes.

### Jours 1–7 — base de sécurité et reproductibilité

1. Créer une baseline canonique du live, revue à quatre yeux.
2. Restaurer une base vierge depuis cette baseline et régénérer les types.
3. Corriger les 16 erreurs DB lint.
4. Réduire les grants table/fonction et activer `FORCE RLS` là où requis.
5. Corriger le quota d'export et ajouter un ledger idempotent.
6. Mettre en place les FK composites et contrôles de tenant prioritaires.
7. Créer une suite pgTAP négative multi-profils.

### Jours 8–30 — complétude métier

1. Terminer Collecteur : type de compte, portail, rattachement, menu, guard et workflows.
2. Terminer Comptoir→SONASP : réception, approbation, rejet, paiement, notifications et historique.
3. Centraliser les routes/capabilities.
4. Rendre l'administration des comptes transactionnelle.
5. Sécuriser cartes, KYC et coordonnées de paiement par double validation.
6. Corriger navigation shipping et routes dupliquées.
7. Ajouter les tests E2E multi-acteurs sur les chaînes de valeur.

### Jours 31–60 — robustesse et performance

1. Faire passer TypeScript à zéro erreur et rendre typecheck bloquant.
2. Remplacer `xlsx`, migrer Vite et épingler les imports Edge.
3. Décomposer les composants > 800 lignes et les bundles lourds.
4. Ajouter CSP, COOP/CORP et politiques de cache adaptées.
5. Implémenter audit immuable et gestion serveur des sessions sensibles.
6. Indexer les FK chaudes après `EXPLAIN ANALYZE`.
7. Tester concurrence, idempotence, reprise réseau et mise à jour PWA.

### Jours 61–90 — homologation

1. Pentest indépendant, incluant IDOR, RLS, Storage et RPC.
2. Tests de charge avec volumétrie cible et budgets de performance.
3. Revue de séparation des fonctions par les responsables métier.
4. Plan de reprise, sauvegarde/restauration et exercices d'incident.
5. Revue RGPD/archivage, rétention et traçabilité réglementaire.
6. Go-live uniquement après signature des critères ci-dessous.

## 12. Critères d'acceptation avant homologation

### Sécurité

- zéro P0/P1 ouvert ;
- zéro RPC `SECURITY DEFINER` exécutable par `anon` hors liste explicitement publique ;
- chaque RPC privilégiée a `search_path`, contrôle d'identité, tenant, AAL2 et capability ;
- aucune policy globale d'écriture sur table métier ;
- tests inter-tenant négatifs réussis pour chaque table et bucket ;
- documents accessibles uniquement par URL signée et autorisation serveur ;
- SoD démontrée sur contrats, achats, règlements, licences, ventes et paiements.

### Reproductibilité et qualité

- `supabase db reset` propre depuis le dépôt ;
- historique local/live identique et checksums contrôlés ;
- `supabase db lint` sans erreur ;
- types générés depuis la baseline et `npm run typecheck` réussi ;
- build/lint/tests réussis en CI ;
- test contractuel pour toute route, table et RPC consommée.

### Fonctionnel

- parcours E2E par profil, avec jeux de données distincts ;
- aucune donnée Mine A visible dans Mine B ;
- aucun Comptoir ne voit/modifie un autre Comptoir ;
- le Collecteur n'accède qu'aux artisans assignés ;
- quota/stock/facture/paiement restent cohérents après concurrence, rejeu et annulation ;
- tous les boutons, formulaires, redirections et retours arrière sont couverts.

### Performance et exploitation

- budgets Web Vitals et API définis et mesurés ;
- p95 documenté par parcours critique sous charge cible ;
- absence de requêtes N+1 et index validés par plans ;
- mise à jour PWA sans mélange de versions ;
- alertes sur erreurs RLS, RPC, Edge, auth, paiement et quota ;
- restauration testée et RTO/RPO approuvés.

## 13. Plan de tests minimal obligatoire

Pour chaque ressource sensible, exécuter la matrice :

| Acteur | AAL | Tenant | Lecture | Création | Modification | Suppression | Transition |
|---|---|---|---:|---:|---:|---:|---:|
| Anonyme | aucun | aucun | Refus sauf public explicite | Refus | Refus | Refus | Refus |
| Utilisateur sans profil | AAL1/AAL2 | aucun | Refus | Refus | Refus | Refus | Refus |
| Mine A | AAL2 | A | A seulement | Selon capability | A seulement | Très limité | Workflow strict |
| Mine B | AAL2 | B | B seulement | Selon capability | B seulement | Très limité | Workflow strict |
| Comptoir A | AAL2 | A | A seulement | Selon capability | A seulement | Très limité | Workflow strict |
| Collecteur A | AAL2 | A | Artisans assignés | Selon capability | Champs autorisés | Refus | Workflow strict |
| Direction | AAL2 | national | Lecture | Refus | Refus | Refus | Refus |
| SONASP préparateur | AAL2 | national | Selon capability | Oui | Préparation | Refus | Pas d'approbation propre |
| SONASP approbateur | AAL2 | national | Selon capability | Non | Approbation | Refus | Pas sur sa propre préparation |
| Finance | AAL2 | national | Paiements | Paiement | Paiement | Refus | Pas d'approbation opérationnelle |
| Owner | AAL2 | national | Administré | Administré | Administré | Exception auditée | Exception auditée |

Chaque test doit vérifier l'UI, l'appel direct PostgREST/RPC, les effets DB, le journal et l'absence de fuite dans les réponses d'erreur.

## 14. État du dépôt après audit

Lors de l'audit initial, aucun fichier source, aucune migration ni donnée n'avait été modifié ; le seul artefact ajouté était le présent rapport. Avant sa création, le dépôt local et `origin/SONASP_2026` pointaient tous deux sur `42f1441308857f0a9deb720c597db4901d8e221f` et l'arbre Git était propre. Cette phrase est une preuve historique, pas l'état courant après les lots correctifs. Le Lot 4D ajoute uniquement un catalogue de checksums, un contrôleur, ses tests, sa CI dédiée et le rapport de reproductibilité lié ci-dessus ; il ne renomme ni n'applique aucune migration.
