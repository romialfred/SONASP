# Journal d'Implémentation — SONASP

Suivi des lots livrés, testés et prouvés. Ordre = plan `PLAN-IMPLEMENTATION-SONASP.md`.
Statuts : ✅ livré+testé · 🔄 en cours · ⏳ à faire · ⚠️ nécessite action client/deploy.

---

## Itération — 2026-08-19 — Approbateurs & workflow d'approbation des ventes

### Demande
Nettoyer la barre latérale (doublons *Transporteurs* / *Raffineries* présents sous
*Parties prenantes* et *Administration*), renommer « Déposants » en « Approbateurs », et
formaliser le workflow : **une vente artisanale doit être approuvée par un approbateur ;
la facture n'est générée et le paiement émis qu'après cette approbation.**

### Décision de modélisation
Approche **rôle / permission** retenue avec l'utilisateur (plutôt que réutiliser l'entité
`depositors`, qui reste un référentiel distinct et vivant). Un approbateur est un
utilisateur portant le drapeau `user_profiles.is_sales_approver`. La direction
(Propriétaire / Direction) approuve **d'office**.

### Livré ✅
- Migration additive `20260819_006_add_sales_approver_flag` : colonne
  `user_profiles.is_sales_approver boolean NOT NULL DEFAULT false`. **Appliquée** sur
  `SONASP_OPS` (`yyverzuhkdonjjuficor`).
- `UserProfile.is_sales_approver` ajouté au type et aux **trois** constructeurs de profil
  d'`AuthContext` (fetch `select('*')`, profil minimal, profil de repli).
- `permissions.ts` : helper `isSalesApprover(user)` = drapeau **ou** direction, compte actif.
- `salesApproverService` : `list()` des utilisateurs + `setApprover(id, valeur)`.
- Page **Approbateurs** (`/stakeholders/approvers`, route protégée management/admin) :
  liste, recherche, synthèse, accorde/retire le droit ; la direction est affichée
  « D'office » et verrouillée. La barre latérale y pointe désormais.
- `VenteOrDetails` : l'action « Approuver la vente » n'est offerte qu'aux approbateurs ;
  les autres voient un badge « En attente d'approbation ». La porte facture/paiement
  (statut `validee`) reste inchangée en aval.
- Barre latérale : doublons *Transporteurs* / *Raffineries* retirés d'Administration.
  Terminologie « Valider » → « Approuver », statut « Validée » → « Approuvée ».

### Portes
- `npx vitest run` : **525/525 verts** (61 fichiers). Mock `useAuth` ajouté au test
  `VenteOrDetails` (approbateur) pour conserver l'action à l'écran.
- `npm run build` : vert.
- `npx tsc --noEmit -p tsconfig.app.json` : **141** — baseline inchangé, **0 erreur
  ajoutée** (drapeau propagé à tous les littéraux `UserProfile` typés, dont les tests
  `permissions` et `ProfileGuard`).

---

## Itération 1 — 2026-08-08

### Constat de départ (baseline)
- `npm run typecheck` : **ROUGE, 829 erreurs préexistantes** (373 imports/vars inutilisés TS6133, 135 TS2322, 130 TS2339, 75 TS2304 dont refs au modèle mort `batches`…). L'app tourne car Vite/esbuild ne typecheck pas. → chantier d'assainissement à mener en continu (Sprint 7 / F10-F11) ; à réduire gate par gate.
- `npm run build` : vert. Tests : 3 fichiers (dont 1 sur page morte).

### Lots livrés ✅

**S0.4 — Suppression code mort** ✅
- 18 fichiers supprimés (pages/composants non routés, vérifiés non importés) : UserManagement(.tsx/Page.tsx/Page.test.tsx), AnalyticsDashboard, AnalyticsPage, PaymentCreateProfessional, AssayCertificatesPage, ShippingPreparationDetails, ShippingPreparationComplete, CustomersPage, SalesPage, RefiningPage, ReportGeneration, ReportsPage, SettingsPage, admin/AuditTrail, layout/Sidebar, ui/InfoPanelExamples.
- Preuve : `npm run build` **vert** après suppression (aucun import cassé) ; ~90 erreurs de type éliminées au passage.
- Couvre : F7, UX-05, UX-06.

**S0.1 — Mesure de couverture** ✅
- `@vitest/coverage-v8@^4` installé ; `npx vitest run --coverage` opérationnel.
- Couvre : Q8.

**S2.0/S2.1/S2.2 (cœur) — Intégrité financière : source de vérité unique** ✅
- Nouveau module canonique `src/constants/goldConstants.ts` : `TROY_OZ_GRAMS = 31.1034768` (valeur EXACTE, plus de 31.1035), `GOLD_ROYALTY_RATE = 0.03`, helpers `gramsToTroyOz/troyOzToGrams`.
- Refactor moteur financier vers la source unique :
  - `utils/weightConversion.ts` (importe la constante ; avoirdupois 28,3495 marqué @deprecated pour l'or),
  - `utils/salesUtils.ts` (conversions + royalties par défaut = GOLD_ROYALTY_RATE ; param inutilisé corrigé),
  - `services/salesService.ts` et `services/preSalesService.ts` (`ROYALTY_RATE = GOLD_ROYALTY_RATE`),
  - `services/businessRulesService.ts` (repli grams_to_ounces = TROY_OZ_GRAMS).
- **18 tests golden** créés et **VERTS** : `goldConstants.test.ts` (6), `salesUtils.test.ts` (8), `weightConversion.test.ts` (4).
- Preuve : `npx vitest run` → **36/36 tests passés** (dont 18 nouveaux), 0 régression ; `npm run build` vert.
- Couvre (partiel) : F1, F2 (moteur), F4, Q2, Q3 (rate), C-11 (rate) ; **reste** le balayage des ~24 fichiers d'affichage/aide contenant encore `31.1035` (littéraux non-calculatoires) et la correction d'assiette royalties du dashboard/facture (F3) → itération suivante.

### Reste à faire (rappel priorisé)
- S2 (suite) : balayage littéraux `31.1035` restants (affichage), assiette royalties facture=`net_proceeds` (F3), fusion des 3 `calculateSaleProceeds` (F5), arrondi unique (F6), zod étendu (Q7/F9).
- S0.2 : infra de test partagée (mock Supabase, renderWithProviders) + supabase.ts testable.
- S0.3 : migration baseline (schéma réel non versionné).
- Sprint 1 (Sécurité) : suppression backdoor + undeploy ⚠️, rotation clé ⚠️, trigger anti-élévation `role`, rôle repli minimal, MFA réel…
- Sprint 3+ : enums/migrations/RLS, Orpailleurs, workflow, modules manquants, i18n/a11y, conformité.
- Assainissement typecheck : 829 → 0 (progressif).

### Actions hors code (à la charge du client / deploy) ⚠️
- Rotation de la clé `service_role` (console Supabase).
- Désactivation de l'inscription publique (console Supabase).
- Undeploy de l'edge function backdoor sur le projet déployé.
- Validation juridique des taux fiscaux (redevance progressive, TVA/retenue artisan).
- Décision hébergement souverain.

---

## Itération 2 — 2026-08-08 — Sprint 1 Sécurité (priorité n°1)

### Lots livrés ✅ (validés build + 36/36 tests, 0 régression)

**V1 — Backdoor supprimée** ✅ : `supabase/functions/fix-rls-and-grant-access/` retirée du dépôt (⚠️ undeploy Supabase requis côté client ; RPC `exec_sql` déjà absente en base → fonction inerte).

**V4 — Insecure default corrigé** ✅ : `AuthContext.tsx` — rôle de repli et profil minimal passent de `management` à `customer` (moindre privilège). Un profil non résolu ne déverrouille plus l'admin.

**V6 — Auto-inscription avec rôle libre supprimée** ✅ : `UserManagementModern.tsx` crée désormais les utilisateurs via l'edge function sécurisée `createUser` (authZ serveur) ; fonction `createUserDirect` (signUp client + rôle libre) **supprimée**, `generateRandomPassword` mort supprimé. Aucune référence résiduelle.

### Lots livrés (code correct, effet au REDÉPLOIEMENT des edge functions) ⚠️

**V8 — `scheduled-tasks` authentifié** : secret partagé `CRON_SECRET` requis (en-tête `x-cron-secret`), comparaison à temps constant. Sinon 401.
**V11 — CORS restreignable** : `Access-Control-Allow-Origin` = `ALLOWED_ORIGIN` (env) sur create-user, get-users, reset-user-password, scheduled-tasks (repli `*` si non défini → non régressif).
**V12 — CSPRNG** : mots de passe temporaires via `crypto.getRandomValues` (16 car.) dans create-user et reset-user-password (fini `Math.random`).
**V15 — Fuite d'info** : `error.stack` retiré des réponses de create-user et reset-user-password (loggué serveur uniquement).

### Migration préparée (déployable via gate sauvegarde/staging) ⚠️

**V3 — Trigger anti-élévation** : `supabase/migrations/20260808_001_security_protect_user_profile_privileges.sql` — bloque toute modif de `role`/`is_active`/`site_ids` sauf service_role ou admin (`is_admin_user`). Réversible.

### Reste Sprint 1 (itérations suivantes)
- V2 (réécriture RLS — 185 policies `USING(true)` : migration XL, cf. Sprint 3.4).
- V5 (MFA réel via `auth.mfa`).
- V7 (arrêt du renvoi des secrets — coordonné avec le flux email V16 + UI admin).
- V9 (audit trail écrit côté serveur, append-only).
- V10 (rotation clé — client), V13 (historique mdp réel), V16 (send-email réel), V17 (lockout).

---

## Itération 3 — 2026-08-08 — Fin cluster financier + nettoyage

### Lots livrés ✅ (build vert, 36/36 tests, 0 régression)

**S2.1 (complet) — Unification de la conversion once** ✅
- **27 fichiers** : toutes les occurrences `31.1035` (58) → valeur exacte `31.1034768`. Aucun résidu (hors test intentionnel).
- `AddInventoryEntry.tsx` : 4 conversions d'or utilisaient l'once **avoirdupois** `28.3495` (erreur +9,7 %) → corrigées en troy. (F2)

**S2.2 (complet) — Assiette de royalties unique** ✅
- Facture (`invoiceGenerationService.ts`) : royalties calculées sur `final_proceeds` (double soustraction) → désormais montant stocké `royalty_amount`, repli `net_proceeds × taux`. (F3)
- Dashboard (`GlobalDashboardEnhanced.tsx`) : royalties sur `total_amount` (×2) → montant stocké, repli `net_proceeds × taux` ; taux centralisé `GOLD_ROYALTY_RATE`. (F3)

**Nettoyage code mort supplémentaire** ✅
- `validationService.validateStatusTransition` supprimé (jamais utilisé, référençait `BATCH_STATUSES` jamais défini — modèle mort A). −32 erreurs de type.

### Métrique typecheck : **829 → 708** (−121 cumulé)
- Bloc restant dominant : TS6133 (imports/vars inutilisés, ~347) — sans impact runtime, à balayer ; puis vraies erreurs TS2339/TS2322/TS2304 (modèle mort A à purger, Sprint 5).

### Cluster financier (le plus critique) — état
- Once troy exacte + centralisée, royalties (taux + assiette) unifiées, avoirdupois éliminée pour l'or, 18 tests golden. **F1, F2, F3, F4, Q2, Q3, C-11 : traités et testés.** Restent F5 (fusion des 3 fonctions de calcul) et F6 (arrondi unique) — non bloquants.

---

## Itération 4 — 2026-08-08 — Assainissement typecheck (imports inutilisés)

### Lot livré ✅ (build vert, 36/36 tests, 0 régression)
- Plugin `eslint-plugin-unused-imports` installé + règle `no-unused-imports` intégrée globalement à `eslint.config.js` (hygiène permanente, audit F7/F10).
- Autofix sûr sur **106 fichiers** : suppression de tous les imports inutilisés.
- Filet git en place ; validation post-fix : build OK, 36/36 tests OK.

### Métrique typecheck : **708 → 535** (cumulé **829 → 535, −294, −35 %**)
- Restant : TS2339/TS2322 (types) et TS2304 (modèle mort A : `batches`, `BATCH_STATUSES`, helpers non importés dans `ReceivingConfirm/ReceivingDashboard/RefineryReceivingConfirm`). La purge du modèle A (Sprint 5.1) est enchevêtrée au routage (`/shipping` pointe vers `ReceivingDashboard`) → lot coordonné à traiter proprement.
- `npm run lint` : les 157 problèmes restants proviennent de la whitelist `strictTypeChecked` préexistante (SaleDetails/SalesDashboard/schemas), pas du nettoyage — relèvent de Sprint 7 (F10/F11).

---

## Itération 5 — 2026-08-08 — Purge modèle A + réparation de features cassées (Sprint 5.1 amorcé)

### Lots livrés ✅ (build vert, 36/36 tests, 0 régression)

**Sprint 5.1 (amorcé) — Purge du modèle de données mort « batches »** ✅
- `/shipping` **réparé** : pointait vers `ReceivingDashboard` (cassé, modèle A) → repointé vers la vraie page `ShippingDashboard` (modèle B).
- Routes mortes retirées d'`App.tsx` : `/receiving`, `/receiving/:id/confirm`, `/refining/:id/receive` (pages qui plantaient — table `batches` inexistante en base).
- 4 fichiers modèle A supprimés : `ReceivingDashboard`, `ReceivingConfirm`, `RefineryReceivingConfirm`, `RefiningDashboard` (aucun n'était fonctionnel ; aucun lien nav orphelin).

**Réparation `FxAnalysisTab`** (feature vivante mais cassée) ✅
- Appelait `analyzeFxTransaction(customerId, dates)` (signature réelle : `amount, currencyPair, customerRate`) et lisait une forme de données inexistante (44 erreurs de type).
- Réécrit en analyseur FX fonctionnel correct branché sur le vrai service (comparaison taux client vs sources marché, gain/manque à gagner).

**Composant `Input` — support `icon`** ✅
- Ajout d'une prop `icon` optionnelle (rétrocompatible) → corrige les usages `<Input icon=… />` qui échouaient.

**`UserManagementModern` — permissions RBAC réellement implémentées** ✅
- Fonctions `loadUserPermissions`/`saveUserPermissions` **inexistantes** → implémentées sur la vraie table `user_permissions` (colonnes vérifiées en base : can_view/create/edit/delete/approve + can_read/write).
- Type `ModulePermission` défini ; champs `Module` corrigés (français réel : `code`, `nom`, `parent_nom`) ; `t` inutilisé retiré.
- La sauvegarde des permissions par module fonctionne désormais (remplacement propre, robuste sans contrainte d'unicité).

### Métrique typecheck : **535 → 426** (cumulé **829 → 426, −403, −49 %**)
- Vraies features cassées réparées (pas seulement du cosmétique) : analyse FX, permissions utilisateur, pages de réception.

---

## Itération 6-7 — 2026-08-09 — Burndown typecheck systématique + durcissement des composants UI

### Composants UI enrichis (corrigent en cascade dans des dizaines de formulaires) ✅
- **`Input`** : props `icon`, `label` (avec `htmlFor`/`id` auto — a11y UX-07), `helperText`, et `error` polymorphe (`boolean | string` → message affiché). Rétrocompatible.
- **`Alert`** : prop `icon` (surcharge LucideIcon).
- **`FormField`** : prop `htmlFor` (association label/champ — a11y).
- **`Loading`** : prop `message`.
- **`StatusBadge`** : `status` élargi à `string` (mappé en interne).
- **`useAlert`** : méthode `showAlert(message, type)` (dispatch générique).

### Fichiers ramenés à 0 erreur (chacun buildé + 36/36 tests) ✅
- `FxAnalysisTab` (réécrit fonctionnel), `UserManagementModern` (permissions RBAC réelles), `BudgetManagementPage` (Recharts formatters/percent), `CustomerForm` (suppression bloc mock mort), `PreSaleDetails` (showAlert + Alert icon), `PaiementForm` (garde null + Input label), `DailyProductionFormEnhanced` (dead code + bug `document` shadow corrigé dans productionDocumentService), `PaymentCreate` (FormField/Loading).

### Bug réel corrigé au passage
- `productionDocumentService.downloadDocument` : le paramètre `document` masquait le `document` du DOM → `document.createElement` aurait planté. Paramètre renommé `doc` + type `Pick`.

### Métrique typecheck : **426 → 325** (cumulé **829 → 325, −504, −61 %**)

---

## Itération 8-10 — 2026-08-09 — Poursuite du burndown + purge de services morts

### Fichiers ramenés à 0 (chacun buildé + 36/36 tests) ✅
`AnalyticsIntelligenceCenter` (API Tabs réelle : id/onChange/icon-composant/enfants-fonction + labels Pie `any`), `AuthContext` (`withTimeout` accepte désormais les thenables Supabase → `PromiseLike` : 8 erreurs levées), `ArtisanMinierDashboard`, `GoldTradeSpace` (useAlert rebranché), `ArtisanMinierFormWithTabs` (casts `Partial<ArtisanMinier>`/`CarteProfessionnelle` + icônes), `ArtisanMinierDetails`, `ChangeStatusModal` (`Partial<Record<Status>>`), `PaymentCreate`.

### Composant/lib durcis (levier)
- `withTimeout(promise: PromiseLike<T>)` — corrige tous les appels enveloppant un query-builder Supabase.

### Services morts supprimés (confirmés non importés)
- `refineryValidationService.ts` (modèle A, `BATCH_STATUSES`).
- `salesApprovalService.ts` (moteur d'approbation orphelin — audit P-C4/P-C6).

### Bug réel corrigé
- `productionDocumentService.downloadDocument` : paramètre `document` masquait le DOM `document`.

### Métrique typecheck : **325 → 251** (cumulé **829 → 251, −578, −70 %**)

### 🔴 Constat CRITIQUE C-01/Q1 traité — QR code réel
- `carteProfessionnelleGeneratorService.generateQRCode` : remplacement du **bruit aléatoire non scannable** (`Math.random` + texte « QR CODE ») par un **vrai QR code** via la lib `qrcode` (déjà installée), encodant réellement les données de la carte → **scannable et vérifiable sur le terrain**.
- Champs corrigés au passage (schéma réel `ArtisanMinier` : `adresse`/`region`, plus de `site_exploitation`/`adresse_complete` fantômes).
- typecheck : 251 → **245**.

---

## Itération 11-14 — 2026-08-09 — Poursuite burndown (composants UI + long tail)

### Composants UI enrichis (levier cascade) ✅
- `Select` : `label` + `htmlFor` + `helperText` + `error` polymorphe (comme `Input`).
- `Loading` : `message`. `FreightStatusBadge`/`StatusBadge` : statut élargi à `string`.

### Fichiers ramenés à 0 (chacun buildé + 36/36 tests) ✅
`ShippingPreparationNew` (type `DailyProduction` local complété), `RefiningProcess` (`shipment_date`→`created_at`, exports castés, inutilisés), `FreightShipmentCreate`, `CarteValidation` (ordre args `showAlert` corrigé), `SaleCreate` (cluster invoice mort supprimé), `LiveGoldPricePanel`, `FreightStatusBadge`, `PreSaleCreate` (freight/other depuis formData), `carteProfessionnelleGeneratorService`.

### Correctifs de fond
- `withTimeout` accepte les thenables Supabase (`PromiseLike`).
- Bug `document` shadow corrigé (productionDocumentService).

### Métrique typecheck : **245 → 203** (cumulé **829 → 203, −626, −76 %**)

---

## Itération 15 — 2026-08-17 — Refonte des deux tableaux de bord territoriaux (maquettes)

### Contexte
Livraison des maquettes des écrans « Gestion des sites artisanaux → Vue d'ensemble » et
« Artisans Miniers → Tableau de bord ». Les deux pages sont réalignées sur le langage visuel
`NationalDashboardLayout` (déjà utilisé par le tableau de bord national), données réelles conservées.

### Lots livrés ✅ (typecheck sans nouvelle erreur, 77/77 tests, build vert)

**Socle cartographique partagé** ✅
- `src/data/burkinaRegions.ts` : 13 régions positionnées sur leur chef-lieu + découpage territorial
  par médiatrices (Sutherland-Hodgman sur la frontière nationale) — contours adjacents sans
  fichier GeoJSON. Projection **uniforme** (le pays garde ses proportions réelles).
- `BurkinaTerritoryMap` (2 variantes) : `sites` (statuts + zoom + légende) et `density`
  (choroplèthe par nombre d'artisans). Remplace `BurkinaSitesMap` (supprimé).

**Page 1 — Tableau de bord des sites miniers artisanaux** (`/artisan-sites`) ✅
- Barre de filtres (période, région, statut, type d'exploitation, recherche, réinitialiser),
  5 indicateurs (dont sparkline production), bloc « Implantation et performance » (onglets
  Carte/Régions + top 4 des sites), « Vigilance opérationnelle » (jauge d'indice + 4 alertes
  cliquables), 3 graphiques (production mensuelle vs objectif, répartition, contribution régionale),
  tableau « Suivi opérationnel » (périmètres Tous/À surveiller/Suspendus, pagination, export CSV).
- Logique métier extraite et testée : `services/artisanalSiteInsights.ts`
  (indice de conformité, statut dérivé « sous surveillance », vigilance, série mensuelle,
  contribution régionale). 8 tests.

**Page 2 — Gestion des Artisans Miniers** (`/artisan-minier`) ✅
- 6 indicateurs, choroplèthe régionale + classement par région, tableau « État des sites miniers »,
  anneau par type d'artisan, état administratif des cartes, évolution des enregistrements.
- Logique extraite et testée : `services/artisanTerritoryInsights.ts` (rattachement artisan↔site
  par localité — seule clé disponible tant que `snp_artisans_miniers` n'a pas de `site_id`,
  dernière carte par artisan, état administratif, séries). 6 tests.
- L'ancien écran (Math.random pour la tendance mensuelle, `any` non typés) est retiré.

**Navigation** ✅
- Libellé « Gestion des sites artisanaux » : **9 px → 12 px**, affiché en entier (2 lignes au besoin)
  au lieu d'être tronqué — dans les deux barres latérales (`NationalDashboardLayout`, `AccordionSidebar`).
- En-tête aligné sur les maquettes : « Système National de Collecte et du Suivi de la Traçabilité de l'Or ».

### Preuves
- `npx vitest run` : **77/77 verts** (57 → 77, +20 tests dont 2 tests de rendu de page).
- `npm run build` : vert. `typecheck` : 190 erreurs (inchangé, aucune sur les fichiers touchés).
- Rendu vérifié dans le navigateur (1536/1280 px) : aucun débordement horizontal, aucune étiquette
  de région superposée, libellé de menu non tronqué.

### Écart assumé vs maquette
La hauteur totale des pages (~1330 px à 1536 px de large) dépasse celle de la maquette (~1024 px) :
la densité a été réduite au maximum compatible avec la lisibilité (typo ≥ 11 px, lignes de tableau 36 px).
Composition, blocs, couleurs et composants sont conformes.

---

## Itération 16 — 2026-08-18 — Refonte plateforme, vague 2 : audit fonctionnel et module Cartes

### Audit fonctionnel de la plateforme (mesuré)
- **103 pages sur 109 sont routées** ; les 6 restantes sont des onglets internes du module
  Analyses, pas des pages orphelines. **Aucune page morte.**
- Dettes chiffrées : 34 dialogues natifs `alert()`/`confirm()`, **878 appels `console.*`**,
  459 `any` explicites, 25 chaînes anglaises en dur, 21 pages sans `catch`.

### Lots livrés ✅

**Journalisation de production** — `vite.config.ts` retire `console.*` et `debugger` du
bundle en mode production (`esbuild.drop` branché sur le mode Vite, pas sur `NODE_ENV`
qui n'était pas positionné par `npm run build`). Vérifié sur le bundle : **878 → 12**
appels résiduels, tous issus de dépendances tierces. Constat F14 traité sans toucher au
code applicatif.

**`CarteValidation` refondue** — première page reconstruite sur les primitives du design
system : en-tête avec fil d'Ariane, 4 indicateurs (en attente / validées / expirées /
suspendues), section à bandeau ambre, recherche, tableau avec état de chargement par
ligne, état vide explicite. Le rechargement après validation est confirmé par test.
**5 tests.**

**`CarteExpirations` refondue** — la logique de classement est extraite et testable
(`groupByHorizon`) : chaque carte n'apparaît que dans **une seule** fenêtre d'échéance,
triée par urgence croissante. L'ancienne version filtrait quatre fois la même liste avec
des bornes qui se recouvraient et restreignait à tort au statut `en_exploitation` — une
carte `validee` arrivant à échéance était invisible. Puces de fenêtre avec compteurs,
badge d'échéance coloré, recherche. **6 tests.**

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **108/108 verts** (+11)
- `npm run typecheck` : **185** (187 avant)

### Dialogues natifs : décision
Les 34 `alert()`/`confirm()` restants changent le flux de contrôle (`if (!confirm(x)) return`).
Une transformation mécanique introduirait des régressions ; ils sont donc repris page par
page lors de chaque refonte, là où le gestionnaire est de toute façon réécrit.


---

## Itération 17 — Lot 4 : dossier artisan, infractions et rapports

### Périmètre
Huit écrans refondus : `ArtisanMinierDetails`, `InfractionForm`, `InfractionDetails`,
`ArtisanMinierForm` (qui remplace `ArtisanMinierFormWithTabs`, 973 lignes supprimées),
`ArtisanMinierEdit`, `CentreRapportsAnalyse`, `RapportChiffreAffaires`,
`RapportQuantites`, `RapportTaxesRoyalties` — plus le service `artisanAnalyticsService`
qui les alimente.

### Ce que l'audit a trouvé
Le module « rapports » ne fonctionnait pas du tout : le service interrogeait
`artisan_ventes_or`, `artisan_factures_definitives` et `artisans_miniers`, alors que les
tables réelles portent le préfixe `snp_`. Chaque requête échouait en base. À cela
s'ajoutaient une colonne `prenom` inexistante (c'est `prenoms`), une quantité en onces
lue depuis une colonne qui n'est pas stockée, et des royalties calculées par un forfait
inventé de 3 % appliqué au total des taxes. Les royalties reposent désormais sur la
taxe de développement communal réellement portée par la vente.

Côté saisie, trois pertes de données silencieuses : joindre une nouvelle pièce à un
constat **effaçait toutes les pièces déjà versées** ; une qualification d'infraction hors
nomenclature revenait sur un select vide et disparaissait au ré-enregistrement ; et pour
un artisan hors Burkina, la chaîne d'effets du formulaire remettait région et commune à
zéro dès le chargement de la fiche. La photo d'identité, elle, était écrite en base64
dans la colonne `photo_url` avant tout dépôt au stockage.

### Décisions de conception
- Les formulaires passent des onglets aux sections : l'agent voit l'ensemble du dossier
  sans navigation, et chaque écran de saisie porte un volet contextuel (artisan mis en
  cause et ses antécédents pour un constat ; photo, badges et jauge de complétude pour
  une fiche artisan).
- Toute page qui agrège plusieurs sources indépendantes charge en `Promise.allSettled` et
  nomme explicitement les blocs indisponibles, plutôt que de rendre un écran vide.
- Les totaux qui ne sont pas additionnables — effectifs d'artisans par région ou par
  période — affichent « — » accompagné de la note qui l'explique, au lieu d'une somme
  fausse.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **224/224 verts** (37 fichiers, +64 sur l'itération)
- `npm run typecheck` : **172** (179 avant — les 7 erreurs du module rapports sont
  résorbées)
- 16 anomalies fonctionnelles corrigées (A20 à A35)

### Exploitation locale
Le port de développement est fixé à **5180** (`strictPort`) : le 5173 par défaut est
occupé par un autre projet Vite du poste, et l'aperçu ouvrait cette autre application.


---

## Itération 18 — Lot 5 : les sept tableaux de bord

### Le constat central
Sur les sept tableaux de bord, **six affichaient des chiffres inventés**.

Le tableau de bord national embarquait un jeu de repli codé en dur — 1 244,23 onces
collectées, 2,84 milliards de FCFA de ventes, quatre transactions nominatives — servi
tel quel dès que la base ne répondait pas, sans le moindre signal à l'écran. Sur une
plateforme nationale de traçabilité de l'or, un agent pouvait donc lire des statistiques
entièrement fabriquées en les prenant pour des données officielles. S'y ajoutaient une
répartition par origine figée à 62 / 24 / 14 %, des variations de période écrites en dur,
un taux de redevance annoncé à 3 %, une heure d'actualisation « 10:42 » et des bornes de
période bloquées au 17 août 2026 que la pastille de sélection n'a jamais reflétées.

Les cinq tableaux de bord de rôle étaient, eux, des maquettes intégrales : numéros de
lots inventés, sites situés en Guinée, au Mali et en Côte d'Ivoire, montants en dollars,
interface en anglais, et un bouton « Create New Batch » pointant vers une route
inexistante.

### Ce qui a été fait
La maquette du tableau de bord national est conservée — c'est l'écran de référence dont
le design system est issu — mais son alimentation est entièrement réécrite. Les cinq
tableaux de bord de rôle sont reconstruits sur un socle commun branché sur les tables
réelles, en français et en FCFA. Le tableau de bord production, seul écran déjà
data-driven, est refondu sur la charte et corrigé.

### Règle retenue
Un indicateur qui ne peut pas être calculé n'est pas comblé : il affiche « — » ou une
mention explicite, et la source manquante est nommée à l'écran. Une variation sans
période de référence, un taux sans assiette, un titre sans déclaration : tous se lisent
désormais comme des absences, pas comme des zéros.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **252/252 verts** (39 fichiers, +28)
- `npm run typecheck` : **167** (172 avant)
- 11 anomalies fonctionnelles corrigées (A36 à A46)


---

## Itération 19 — Lot 6 : administration (premier tiers)

### Périmètre
Cinq écrans : comptes utilisateurs (liste et fiche), référentiels des raffineries et des
transporteurs, demandes d'approbation. Plus deux briques transverses.

### Ce que l'audit a trouvé
Le module d'administration était **le dernier bastion anglophone** de la plateforme :
« Users Management », « Never », « Refinery Plants », des rôles affichés sous leur
identifiant technique (« Owner », « Factory ») et des dates au format américain.

Trois défauts touchaient la sécurité d'exploitation. Le filtre par rôle omettait
« propriétaire » et « administrateur » — les deux rôles les plus privilégiés étaient donc
impossibles à isoler dans la liste. La désactivation d'un compte se faisait en un clic,
sans confirmation. Et rien n'empêchait un administrateur de désactiver son propre compte,
donc de se verrouiller lui-même hors de la plateforme.

Deux défauts rendaient des écrans trompeurs. Sur les référentiels, une requête en échec
produisait un tableau vide strictement indiscernable d'un référentiel réellement vide.
Sur les approbations, **les trois compteurs étaient faux** : ils portaient sur la liste
déjà filtrée, si bien qu'« Approuvées » et « Rejetées » affichaient toujours zéro tant
que le filtre « en attente » — celui par défaut — restait actif.

Enfin, la recherche des référentiels appelait `.toLowerCase()` sur des colonnes
facultatives : un établissement dont le contact n'était pas renseigné faisait planter le
filtre.

### Deux briques transverses
`errorMessage()` extrait le message d'une erreur quelle que soit sa forme. Les erreurs
Supabase sont des objets simples portant `message`, pas des instances d'`Error` : le test
`instanceof Error` employé partout les remplaçait par un libellé générique, et la cause
réelle n'atteignait jamais l'utilisateur.

Le délai des utilitaires asynchrones de Testing Library passe à 5 secondes. Sous charge,
un test *différent* échouait à chaque exécution de la suite complète, sans traduire la
moindre régression — la seconde de patience par défaut ne suffisait plus. Deux exécutions
consécutives sont désormais vertes.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **281/281 verts** (42 fichiers, +29), deux exécutions consécutives
- `npm run typecheck` : **166** (167 avant)
- 8 anomalies fonctionnelles corrigées (A47 à A54)


---

## Itération 20 — Lot 6 : référentiels et modules

### Périmètre
Trois écrans : les deux formulaires de référentiel (raffineries, transporteurs) et la
gestion des modules de la plateforme. Plus un correctif d'outillage.

### Ce que l'audit a trouvé
Les deux formulaires chargeaient leur fiche avec `single()`. Sur une référence inconnue,
cette méthode lève une exception : le message d'erreur partait au journal, et l'écran
restait un **formulaire vide mais parfaitement enregistrable**, visant une ligne qui
n'existe pas. Ils passent à `maybeSingle()` avec un écran « fiche introuvable » explicite.

Sur les modules, la désactivation se faisait en un clic. Or elle retire une section
entière de l'application à **tous** les utilisateurs et emporte les sous-modules
rattachés. Elle passe désormais par une confirmation qui annonce combien de sous-modules
seront emportés.

### Le correctif le plus important n'est pas dans l'application
En vérifiant la stabilité de la suite par exécutions répétées, une exécution a rapporté
**285 tests verts là où la précédente en rapportait 299**. La cause : avec un fork par
fichier de test sur 22 cœurs, trois workers n'ont pas réussi à démarrer. Vitest a alors
retiré ces fichiers du décompte et **annoncé un résultat vert portant sur moins de tests
qu'il n'en existe** — une perte de couverture invisible, la pire espèce.

Le parallélisme est borné à six workers. Trois exécutions consécutives couvrent
maintenant les 44 fichiers et les 299 tests.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **299/299 verts** (44 fichiers), trois exécutions consécutives
- `npm run typecheck` : **165** (166 avant)
- 3 anomalies fonctionnelles corrigées (A55 à A57)


---

## Itération 21 — Lot 6 : les habilitations

### Le sous-ensemble le plus abîmé rencontré jusqu'ici
La gestion des droits d'accès reposait sur deux écrans qui écrivaient dans la même table
`user_permissions` avec des **jeux de colonnes incompatibles** : l'un posait
`can_read / can_write / can_delete` et les permissions par champ, l'autre
`can_view / can_create / can_edit / can_delete / can_approve`. Comme chacun remplaçait
l'existant à l'enregistrement, régler les droits depuis un écran effaçait silencieusement
ce que l'autre avait posé.

L'enregistrement lui-même procédait par suppression totale puis réinsertion. Si
l'insertion échouait — coupure réseau, règle RLS —, l'utilisateur se retrouvait **sans
aucun droit**, sans rollback. Et le scénario le plus grave enchaînait les deux défauts :
un chargement en échec laissait l'écran avec toutes les cases vides ; un administrateur
qui cliquait alors sur « Enregistrer » **révoquait la totalité des habilitations
réelles**, en croyant n'avoir rien changé.

Deux autres défauts rendaient une partie du dispositif inerte. `user_permissions.module_id`
référence la table `modules`, mais l'un des écrans alimentait ses cases à cocher depuis
`snp_modules`, un référentiel distinct : les droits accordés depuis cet écran portaient
des identifiants qu'aucun lecteur ne pouvait résoudre. Et les permissions par champ
étaient écrites sous la forme `{ read, write }` alors que le lecteur attend
`{ can_view, can_edit }` — aucune n'a donc jamais pu s'appliquer.

### Ce qui a été fait
Un service unique (`userPermissionsService`) porte le jeu de colonnes complet, expose le
référentiel de modules correct, normalise les deux formes de permissions par champ et
**écrit par différence** : seules les lignes réellement concernées sont créées, mises à
jour ou révoquées. Il n'existe plus d'instant où l'utilisateur est sans droits.

L'écran d'habilitations est refondu et francisé, ses catégories déduites du référentiel
au lieu des cinq libellés codés en dur, et l'enregistrement bloqué tant que l'état de
départ n'est pas connu avec certitude. Retirer le droit de consultation retire
automatiquement ceux qui en dépendent.

### Trois tests qui pouvaient mentir
En exécutant la suite en boucle, trois tests se sont révélés exposés à une course de
rendu : ils attendaient l'appel au service, ou un titre déjà présent pendant le
chargement, puis affirmaient synchroniquement sur du contenu pas encore rendu. Sous
charge, l'assertion partait trop tôt. Ils attendent désormais le contenu lui-même.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **313/313 verts** (45 fichiers), quatre exécutions consécutives
- `npm run typecheck` : **165**
- 6 anomalies fonctionnelles corrigées (A58 à A63)


---

## Itération 22 — Lot 6 : paramétrage, statuts, et un écran qui jetait tout

### Un écran de configuration qui n'enregistrait rien
La route `/settings` servait un écran « System Settings » à six onglets — société, taux de
change, cours de l'or, modèles d'e-mail, seuils, notifications — avec un bouton
« Save Changes » qui se contentait d'un `console.log` avant de remettre l'indicateur de
modification à zéro. Un administrateur y saisissait des seuils, des clés d'API, une
adresse de société : **tout était silencieusement jeté**, avec l'apparence d'un
enregistrement réussi. L'écran affichait par ailleurs l'identité d'une société guinéenne
(« Mansa Resources », Conakry) sur une plateforme burkinabè.

Le paramétrage réel existe ailleurs, sur `/parameters`, qui persiste effectivement les
préférences et les règles métier. La route redirige désormais vers lui et l'écran factice
est supprimé. Les sections qu'il évoquait — cours, seuils, modèles — devront être
rebâties sur un stockage réel si le besoin est confirmé ; rien n'est perdu puisque rien
n'était enregistré.

### Le référentiel des statuts assumé pour ce qu'il est
L'écran de gestion des statuts proposait un bouton « Éditer » qui n'écrivait rien et
annonçait « les modifications seront appliquées dans une prochaine version ». Le panneau
qu'il ouvrait était un composant stub renvoyant `null` : le clic n'affichait donc
strictement rien. Le bouton « Voir les détails », lui, n'avait aucun gestionnaire.

Les statuts sont définis dans le code du circuit de traçabilité, pas en base : l'écran
devient un référentiel **en lecture seule** qui le dit, et lit les transitions dans
`ALLOWED_TRANSITIONS` — la table de référence du service de contrôle — au lieu de la
carte approximative qu'il reconstituait module par module.

### Une règle métier qui ne pouvait pas valoir zéro
Sur l'écran de paramétrage, l'enregistrement des règles métier retenait
`editedRules[clef] || rule.rule_value`. Ramener une règle à **0** — une tolérance, un
seuil — laissait donc l'ancienne valeur en place, sans que rien ne le signale.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **324/324 verts** (46 fichiers), deux exécutions consécutives
- `npm run typecheck` : **160** (165 avant)
- 6 anomalies fonctionnelles corrigées (A64 à A69)


---

## Itération 23 — Lot 6 : deux onglets qui faisaient semblant

### Le constat
L'écran de paramètres comptait quatre onglets. Deux fonctionnaient — règles métier et
double authentification, tous deux branchés sur la base. **Les deux autres étaient
décoratifs.**

L'onglet « Préférences » alignait quatre listes déroulantes — langue, devise, fuseau,
unité de poids — dont aucune n'avait de valeur ni de gestionnaire de changement, sous un
bouton « Save Preferences » qui n'avait tout simplement pas de `onClick`. Rien n'était
chargé au montage, rien n'était enregistré au clic. La liste des fuseaux proposait UTC,
Abidjan, Conakry et Bamako — mais pas Ouagadougou.

L'onglet « Notifications » affichait quatre interrupteurs écrits
`checked={true} onChange={() => {}}` : figés sur « activé », insensibles au clic, sans
lien avec quoi que ce soit.

### Ce qui a été fait
Contrairement à `/settings` — supprimé à l'itération précédente faute de tout stockage —
ces réglages-ci **ont** un stockage réel : `language_preference` et `timezone` sont des
colonnes de `user_profiles`, et les trois indicateurs de notification vivent dans les
métadonnées du compte, celles que le contexte d'authentification relit déjà. Les deux
onglets sont donc devenus fonctionnels plutôt que supprimés.

Devise et unité de poids, en revanche, n'ont aucun stockage nulle part. Plutôt que de
promettre un réglage inexistant, la page énonce la règle réellement appliquée : franc CFA,
grammes et onces troy.

### Une bascule sans nom
Le composant `Toggle` masque sa case à cocher (`sr-only`) et n'exposait aucun nom
accessible en l'absence de libellé visible : une technologie d'assistance ne pouvait pas
dire ce que la bascule commandait. Il accepte désormais un `ariaLabel` et porte la
sémantique `role="switch"`.

### L'outillage, encore
Le bridage des forks à six workers n'a pas suffi : une exécution a de nouveau perdu six
fichiers en silence — 285 tests annoncés verts au lieu de 333. La suite passe au pool
`threads`, qui évite la création de processus, précisément l'étape qui échouait. Trois
exécutions consécutives couvrent les 47 fichiers.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **333/333 verts** (47 fichiers), trois exécutions consécutives
- `npm run typecheck` : **160**
- 6 anomalies fonctionnelles corrigées (A70 à A75)


---

## Itération 24 — Un diagramme qui documentait un autre logiciel

### Le constat
L'écran « Gold Shipping Workflow » affichait un diagramme BPMN complet — couloirs,
tâches, passerelles de décision, flux — entièrement écrit à la main dans le code source.
Il décrivait un processus « Batch Management » : création d'un lot, expédition vers
l'aéroport, réception, refonte, contrôle qualité.

Ce processus n'existe pas dans la plateforme. Il n'y a ni module de lots, ni route
`/batches`. Le circuit réellement appliqué est tout autre : préparé → prêt pour la douane
→ en attente d'approbation douanière → approuvé → prêt pour expédition → expédié vers la
raffinerie → raffiné → en stock → en vente → vendu → payé. Autrement dit, la documentation
que consultaient les administrateurs décrivait un logiciel différent de celui qu'ils
utilisaient. Le bouton « Export », lui, n'avait aucun gestionnaire.

### Ce qui a été fait
Le diagramme est **calculé** à partir de la table de transitions du moteur de contrôle :
les couloirs sont déduits du module responsable de chaque étape, les positions de la
profondeur dans la chaîne, les flèches des transitions déclarées. On peut sélectionner une
étape, lire son module et ses suites possibles, et suivre la chaîne de proche en proche.
L'export produit réellement un fichier SVG.

Le diagramme ne peut plus diverger : si une transition change dans le moteur, le dessin
change avec elle.

### Trois étapes sans nom français
En construisant les libellés, trois statuts du circuit se sont révélés absents du
formateur — `waiting_for_customs_approval`, `in_inventory` et `paid` — et retombaient donc
sur leur identifiant technique mis en forme : « Waiting For Customs Approval ». Corrigé
dans le formateur, ce qui profite à tous les écrans qui l'utilisent.

### Une correction sur mon propre travail
Le premier test que j'ai écrit pour vérifier la francisation utilisait une heuristique
d'anglicisme trop grossière : elle signalait aussi des libellés français légitimes comme
« En Vente ». Remplacée par des vérifications explicites.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **345/345 verts** (48 fichiers), deux exécutions consécutives
- `npm run typecheck` : **156** (160 avant)
- 3 anomalies fonctionnelles corrigées (A76 à A78)


---

## Itération 25 — Lot 6 clos : création de compte et nettoyage

### Impossible de créer un administrateur
L'écran de création de compte proposait cinq rôles : direction, usine, aéroport,
raffinerie, client. **Ni propriétaire ni administrateur.** Un administrateur ne pouvait
donc pas en créer un autre depuis l'interface prévue pour cela — le seul recours étant
une intervention directe en base. Les descriptions de rôle renvoyaient par ailleurs à la
gestion des « batches », module qui n'existe pas.

### Des écritures dont l'issue n'était jamais lue
À l'enregistrement, les rattachements du compte aux compagnies minières étaient supprimés
puis réinsérés — et **aucune des deux opérations n'était vérifiée**. Une suppression
réussie suivie d'une insertion en échec laissait le compte sans aucun rattachement, avec
un message de succès à l'écran. Les deux écritures sont désormais contrôlées et bloquent
l'enregistrement en cas d'échec.

### Trois composants morts
Le nettoyage a fait apparaître trois composants d'administration qu'aucun écran
n'importait. Deux d'entre eux — `StatusEditorModal` et `TransitionEditorModal` —
référençaient `workflowManagerService`, **un module absent du dépôt** : ils ne pouvaient
pas compiler. Le troisième doublonnait le panneau de paramétrage réellement utilisé. Les
trois sont supprimés ; le typage y gagne quatre erreurs de moins.

### Le lot 6 est clos
Quinze écrans d'administration refondus, 88 tests, 35 anomalies corrigées (A47 à A81) —
dont un écran de configuration qui jetait toute saisie, un diagramme documentant un autre
logiciel, et un enregistrement d'habilitations qui pouvait laisser un utilisateur sans
aucun droit.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **357/357 verts** (49 fichiers), deux exécutions consécutives
- `npm run typecheck` : **153** (156 avant)
- 3 anomalies fonctionnelles corrigées (A79 à A81)

---

## Barre latérale : quatre sections, et une barre qui ne saute plus

### Le défaut qui se voyait le plus
Dérouler « Marché d'or artisanal » puis cliquer sur une de ses entrées repliait le groupe
et en ouvrait un autre : la barre bougeait sous le curseur. La cause n'était pas une
animation mais la recherche du groupe correspondant à la route. Elle retenait le
**premier** groupe dont un enfant satisfaisait `startsWith` — et `/artisan-minier/paiements`
commence par `/artisan-minier`, l'enfant « Vue d'ensemble » du groupe « Artisans miniers »,
déclaré plus haut. Le groupe est désormais choisi sur la correspondance la **plus longue**,
seule règle qui distingue un préfixe d'une route.

### Un tableau de bord qui n'était pas celui annoncé
Le premier « Tableau de bord » de la barre menait au tableau de bord des artisans miniers,
pas à la vue nationale. Il pointe maintenant vers `/dashboard`, et reste le seul intitulé
« Tableau de bord » : dans les groupes, ces entrées deviennent « Vue d'ensemble ». Le
renommage a mis au jour un doublon — deux entrées vers `/artisan-minier` — supprimé.

Le tableau de bord national, lui, ne recensait pas les artisans miniers. Il remonte
désormais l'effectif total et l'effectif actif, avec la règle appliquée à toutes ses
sources : une source indisponible est nommée à l'écran, jamais estimée.

### Lisibilité
Trois règles CSS coupaient les intitulés aux points de suspension ; ils passent à la ligne
et les hauteurs fixes deviennent des hauteurs minimales. L'indentation des sous-menus
passe de 35 px à 20 px cumulés.

## Analyse par assistance IA

Nouvelle page à `/analytics/assistant` : historique de conversations, fil de discussion,
composeur avec envoi à la touche Entrée, quatre amorces adossées aux données réellement
suivies. Le moteur d'analyse n'est pas raccordé — et la page le dit, par un bandeau, une
pastille d'état et une réponse explicite. Elle ne fabrique aucun chiffre : c'est la seule
manière honnête de livrer une coquille avant son service.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **405/405 verts** (52 fichiers)
- `npm run typecheck` : **152** (153 avant)
- 6 anomalies corrigées (A86 à A91)

---

## Une seule ligne par intitulé de la barre latérale

Contrainte permanente désormais : aucun libellé de la barre ne passe sur deux lignes.
Elle entre en tension avec celle posée juste avant — aucun libellé tronqué — et la seule
façon de tenir les deux est de mesurer.

Relevé dans le navigateur, sur la barre réelle : le texte d'un groupe dépliable disposait
de 124 px, « Rapports institutionnels » en demande 147. Quatre intitulés dépassaient.

Deux leviers, appliqués ensemble :

- **Le chevron des entrées sans sous-menu est retiré.** Il promettait un repli qui
  n'existait pas — « Analyses des ventes » ou « Assistant IA » sont de simples liens — et
  il consommait 29 px que l'intitulé récupère.
- **La barre passe de 244 à 268 px**, largeur minimale qui laisse au moins 10 px de marge
  aux trois gabarits : groupe dépliable (148 px de texte), lien sans chevron (177 px),
  entrée de sous-menu (169 px).

`white-space: normal` redevient `nowrap`, avec ellipse en dernier recours : mieux vaut une
coupure visible qu'une mise en page cassée si un libellé futur débordait.

### Le garde-fou
jsdom ne calcule pas de mise en page : un test ne peut pas constater un retour à la ligne.
`sidebarNavigation.test.ts` reconstitue donc la largeur du texte à partir des avances de la
police Inter, relevées dans le navigateur. Contrôlée face à `measureText`, l'estimation
s'écarte au plus de 1,3 px — la marge de 10 px l'absorbe. Tout intitulé ajouté qui ne
tiendrait pas sur une ligne fait échouer la porte de validation.

### Renommages
Section « Rapports et analyses » : « Analyses des ventes », « Rapports de production »,
« Assistant IA », « Rapports institutionnels », « Performance nationale ». Sous
« Marché d'or artisanal », « Vue d'ensemble des ventes » devient « Vue d'ensemble » — le
groupe porte déjà le contexte, et c'était le libellé le plus long de tous les sous-menus.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **413/413 verts** (53 fichiers)
- `npm run typecheck` : **152** (inchangé)
- 2 anomalies corrigées (A92, A93)

---

## Habillage SafeX de la barre latérale

Reprise du modèle fourni en référence, sans toucher à la structure ni aux routes.

- **`+` / `−` à la place des chevrons.** Le signe décrit l'action offerte, pas l'état
  courant : plus quand le groupe est replié, moins quand il est déplié.
- **Pastilles d'icône** : carré arrondi de 30 px, bordure et fond teintés de la couleur du
  module via `color-mix` sur `currentColor` — une seule règle couvre les trente entrées,
  la couleur restant posée là où elle est définie, dans le modèle de navigation.
- **Intitulés de section** : tiret ambre, titre ambre espacé, filet occupant la place
  restante. Le filet est un pseudo-élément et ne prend jamais sur la largeur du texte.
- **Rail des sous-menus** porté à 2 px et éclairci ; état courant en panneau plein plutôt
  qu'en voile ; lignes à 42 px.

### Le piège de la pastille
La pastille est un `span`, et les règles d'intitulé visaient `> span` : elle a hérité du
`flex: 1` destiné au texte et lui a pris la moitié de la largeur — neuf intitulés se sont
mis à être tronqués d'un coup. Les sélecteurs sont désormais restreints par
`:not(.national-sidebar__icon)`, aux quatre endroits concernés, repli mobile compris.

La contrainte d'une seule ligne a été revérifiée sur les 51 intitulés réels après
habillage : rien de tronqué, rien sur deux lignes. Les budgets du garde-fou passent à
145 px (groupe dépliable) et 171 px (entrée sans sous-menu), la pastille coûtant 10 px de
plus que l'ancienne icône nue.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **414/414 verts** (53 fichiers)
- `npm run typecheck` : **152** (inchangé)
- 1 anomalie corrigée (A94)

---

## Pourquoi la barre latérale bougeait encore

La correspondance la plus longue avait réglé un symptôme, pas la cause. Deux mécanismes
restaient.

### La barre est reconstruite à chaque navigation
Chaque page rend sa propre instance de `NationalDashboardLayout`. Naviguer démonte
l'ancienne et en monte une neuve : le défilement de la barre repartait en haut et le
groupe ouvert se recalculait. Cliquer sur « Stock d'or », en bas de la liste, ramenait donc
la barre au sommet — c'est ce que l'on voyait bouger.

Hisser la mise en page hors des routes serait la correction de fond, mais elle touche
chaque écran de l'application. Le relais retenu conserve l'état visuel — offset de
défilement et groupes dépliés — hors du composant, dans un objet de module. Le défilement
est restauré dans le rappel de référence du `<nav>`, donc pendant la phase de commit,
avant la peinture : aucun saut n'est visible.

### L'ouverture exclusive déplaçait ce que l'on venait de cliquer
Déplier un groupe repliait le précédent. Si celui-ci se trouvait plus haut, tout ce qui
suivait remontait de plusieurs lignes — le groupe cliqué glissait sous le curseur.

J'ai d'abord compensé au défilement, en ancrant la ligne cliquée. Mesuré en vraie mise en
page, le procédé ne tient pas jusqu'au bout : arrivé en haut de liste il n'y a plus de
marge à reprendre, et 72 px de dérive subsistaient. Les groupes sont donc devenus
**indépendants** : déplier n'ajoute qu'un sous-menu, toujours sous la ligne cliquée, et ne
modifie jamais rien au-dessus. Contrôle en vraie mise en page : déplacement nul pour la
ligne cliquée comme pour toutes celles au-dessus, défilement inchangé.

Le prix est une barre qui peut s'allonger si l'on déplie beaucoup de groupes. C'est le
seul moyen de garantir que rien ne bouge, et c'est ce qui était demandé.

### Écart sous le titre de groupe
Le sous-menu était collé à son titre : l'élément sélectionné semblait déborder du groupe.
6 px l'en séparent désormais.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **416/416 verts** (53 fichiers)
- `npm run typecheck` : **152** (inchangé)
- 3 anomalies corrigées (A95 à A97)

---

## Refonte visuelle du module Production

Trois écrans repris sur le modèle du module « sites miniers » : cartes blanches, filet
gris, et une palette réduite au vert et à l'or de la charte. La couleur cesse d'être
décorative pour ne plus signaler qu'un état.

### Un socle plutôt que trois feuilles de style
Deux ajouts au design system, faits une fois pour toutes :

- `StatGrid` reçoit une variante **sobre** — tuiles ramenées de 101 px à 75 px, teintes
  limitées au vert, à l'or et à un neutre. Les hauteurs de ligne y sont explicites : sans
  elles c'est le contenu qui commande et la tuile reste haute quel que soit le `min-height`.
- Le **volet latéral** de filtres, écrit pour le tableau de bord des artisans, est promu en
  `sn-drawer`. Un second écran en avait besoin ; un volet par page aurait divergé dès la
  première retouche.

### Licences d'exportation
Réécriture complète : la page empilait dix-huit dégradés Tailwind, un badge clignotant et
des fonds alternés bleu/vert sans signification. Les fiches sont désormais sobres, les
chiffres en encre, et la couleur réservée à l'état et au dépassement de seuil.

Deux défauts fonctionnels au passage. **L'échec de chargement n'était consigné qu'au
journal** : l'écran restait vide sans un mot. Et le taux d'utilisation divisait par le
volume autorisé sans le vérifier — une licence à zéro affichait `NaN %` ; elle affiche
« — ».

### Production journalière
Les filtres occupaient un bandeau pleine largeur au milieu de la page. Ils passent dans le
volet latéral, avec compteur de critères actifs, remise à zéro et fermeture au clic
extérieur ou à Échap. La page ne garde qu'un rappel des critères retenus.

Les camemberts et histogrammes tiraient chacun leur propre arc-en-ciel de douze teintes
Tailwind — rose, violet, cyan, lime — et **différentes d'un graphique à l'autre pour une
même compagnie**. Une rampe unique de huit teintes vert / or / ardoise les remplace.

Les libellés des graphiques étaient en anglais (« Estimated Oz », « Peak Day »), ceux du
formulaire de déclaration aussi (« Bullion », « Gold Assay »). Traduits. Le nettoyage a
révélé `DailyProductionForm`, doublon mort qu'aucun écran n'importait : supprimé.

### Gestion budgétaire
Le volet de droite occupait 420 px fixes sur toute la hauteur de l'écran pendant que la
matrice était bridée à `max-w-6xl` : la colonne secondaire prenait plus de place que le
tableau qu'elle commente. Les deux colonnes se partagent désormais la largeur — 834 px
contre 300 px à 1180 px de large — et la synthèse repasse sous la matrice en dessous de ce
seuil. En-tête, notifications et libellés passent à la charte.

L'intérieur de la matrice budgétaire, lui, n'est pas réécrit : il fonctionne, ne dispose
d'aucun test, et le reprendre ligne à ligne aurait été un risque sans contrepartie. C'est
la coquille et la mise en page qui changent.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **430/430 verts** (54 fichiers)
- `npm run typecheck` : **152** (inchangé)
- 7 anomalies corrigées (A98 à A104)

---

## Barre latérale : puces, ouverture exclusive, pastilles réduites

- Les sous-menus perdent leur icône de module au profit d'une **puce claire**. À ce
  niveau, dix icônes de dix couleurs se lisaient comme dix alertes.
- Les pastilles des titres de groupe passent de 30 px à 26 px, l'icône de 16 à 14.
- L'indentation des sous-menus gagne 1 px.
- **Un seul groupe déplié à la fois**, comme demandé. C'est l'inverse de la décision
  précédente, prise pour supprimer un mouvement parasite : replier un groupe situé plus
  haut fait remonter la ligne que l'on vient de cliquer. L'ancrage du déclencheur est donc
  réintroduit — sa position est relevée avant la bascule et le défilement corrigé d'autant,
  avant peinture. La compensation est complète tant qu'il reste du défilement à reprendre ;
  collée en haut de liste, elle ne peut plus rien. C'est la limite de l'ouverture exclusive
  elle-même, pas du correctif.

Les budgets de largeur du garde-fou passent à 149 px (groupe) et 175 px (lien), la
pastille rétrécie ayant rendu 4 px à l'intitulé. Contrôle en vraie mise en page : aucun
intitulé tronqué, aucun sur deux lignes.

## Page des paiements

Réécriture complète. L'écran était **intégralement en anglais** — titre, sous-titre,
tuiles, filtres, messages — avec des montants formatés en `en-US` et un symbole `$` forcé
quelle que soit la devise enregistrée. Les tuiles portaient quatre dégradés vifs, l'en-tête
du tableau un dégradé bleu.

Deux défauts de fond au passage :

- **Le total additionnait des devises différentes.** Les cumuls ne sont désormais calculés
  que si toutes les lignes partagent la même devise ; sinon l'écran affiche « — » et le
  dit.
- **L'échec de chargement ne laissait qu'un `toast` fugace** : il s'affiche maintenant sur
  la page, et la liste annonce qu'elle est vide.

16 tests, la page n'en avait aucun.

## Boutons d'export

Retirés de **treize écrans** qui ne sont pas des pages de rapport : clients, stocks, cours
de l'or, détail de paiement, journal d'audit, raffinage, or en coffre, déposants, tableau
de bord et liste des artisans, historique des paiements, circuit de traçabilité, production
journalière, paiements.

Trois d'entre eux n'avaient **aucun gestionnaire** — stocks, détail de paiement, journal
d'audit : des boutons décoratifs, que le mandat proscrit de toute façon.

Le code devenu mort part avec : neuf fonctions d'export, leurs imports et un état de
composant. Le typage y gagne deux erreurs (152 → 150).

Conservés, parce qu'il s'agit de pages de rapport : les trois rapports artisans, le tableau
de bord national, le centre d'analyses, le tableau de bord des rapports. Conservés aussi,
parce qu'il ne s'agit pas d'exports mais du téléchargement d'une pièce jointe : facture
PDF, justificatif de paiement, certificat d'essai, documents d'artisan, d'infraction et
d'expédition.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **444/444 verts** (55 fichiers)
- `npm run typecheck` : **150** (152 avant)
- 5 anomalies corrigées (A105 à A109)

---

## Ventes d'or artisanal

### Les actions d'en-tête restaient collées au sous-titre
La règle `.sn-page__head > div:first-child { flex: 1 }` ne s'appliquait jamais : le premier
enfant est le `span` de l'icône, pas le bloc titre. Les boutons se plaçaient donc à la suite
du sous-titre, laissant un vide sur toute la droite. Le sélecteur devient
`> div:not(.sn-page__actions)` — les actions collent au bord droit, sur **toutes** les pages
refondues, pas seulement celle-ci.

### Filtres en volet latéral
Recherche, type d'or, tri et période passent dans le volet `sn-drawer`, avec compteur de
critères, remise à zéro et fermeture au clic extérieur ou à Échap. Les statuts restent sur
la page : ils servent de navigation rapide, pas de filtrage fin.

### Numérotation des reçus
Le numéro venait d'une fonction Postgres `generate_numero_recu_vente_or` **absente du
dépôt** — impossible à relire, à tester ou à faire évoluer — et produisait
`VENTE/OR/2025/12/0002`, avec des barres obliques peu commodes en URL, en nom de fichier et
dans un export CSV. Pire, l'échec de la fonction n'était qu'un `console.warn` : la vente
s'enregistrait alors **sans numéro de reçu**.

La numérotation est reprise par l'application, comme celle des cartes professionnelles :
`venteRecuNumberService.ts` (12 tests), format `VE-OR-AAAAMM-NNNNN`, compteur propre au
mois, erreur de lecture bloquante — attribuer un numéro sans connaître ceux déjà pris
produirait un doublon sur une pièce comptable. La migration `20260819_002` redéfinit la
fonction distante au même format, pour les insertions faites hors application, et convertit
les numéros déjà attribués. Elle est idempotente et sa requête de retour arrière figure en
tête de fichier.

**Réserve sur le format.** L'exemple donné était `VE-OR-2025612-00034`, dont le troisième
segment compte sept chiffres. Année et mois n'en font que six (`202512`) et le chiffre
supplémentaire ne correspond à rien de connu — ni jour, ni trimestre. J'ai retenu
`AAAAMM` ; si le septième chiffre porte une information, elle reste à nommer.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **463/463 verts** (56 fichiers)
- `npm run typecheck` : **150** (inchangé)
- 4 anomalies corrigées (A110 à A113)

---

## Formulaire de vente d'or

### Le panneau de cours affichait des chiffres inventés
En cherchant à sobriser la colonne de droite, j'ai trouvé pire que des couleurs vives.
Quand la source ne fournit ni ouverture, ni haut, ni bas sur 24 h, le panneau les
**fabriquait** — ouverture à `cours × 0,995`, haut à `× 1,008`, bas à `× 0,992` — et les
présentait comme des données de marché. Sur l'écran même où un acheteur fixe son prix au
gramme. Le taux USD/XOF subissait le même sort : 600 en dur, affiché comme le taux du
référentiel.

Le panneau est réécrit. Il n'affiche que ce que la source donne : la variation devient
« Variation non communiquée par la source », et sans taux au référentiel les conversions
en FCFA ne s'affichent pas du tout, avec la raison à l'écran. Au passage, le bandeau orange
plein, les quatre tuiles bordées de vert et de rouge et le bloc vert cèdent la place à une
carte unique.

### Numéro de vente
Le champ « N° de reçu » disparaît du formulaire. Le numéro est attribué à l'enregistrement,
au format `VE-OR-AAAA-NNNNN` — le compteur devient annuel, conformément au format demandé —
et suit la vente jusqu'au paiement. Un numéro frappé à la main ouvrait la porte aux
doublons sur une pièce comptable.

Le retrait a fait apparaître un défaut : le formulaire transmettait `numero_recu` dans son
payload, et `update` propage tout ce qu'on lui donne. Modifier une vente avec le champ vide
**effaçait son numéro**. Le champ ne fait plus partie du payload.

### Types d'or sur une ligne
Les cinq formes passent en cartes verticales, cinq de front. Une première tentative a
échoué : le point de rupture portait sur la largeur de fenêtre alors que la colonne du
formulaire ne fait que 820 px face au volet de droite. Mesuré après correction : une seule
ligne, cartes de 157 px, hauteurs égales, aucun intitulé ni descriptif tronqué.

### Ce qui n'est pas fait
**La facture officielle.** Elle doit être conforme aux normes du Burkina Faso, porter un
sticker et un QR code, et c'est elle qui sera présentée au paiement. Les éléments de
validation doivent être fournis : construire une facture à l'aveugle produirait une pièce
d'apparence officielle sans valeur, ce qui est pire que pas de facture du tout. C'est
inscrit comme prochaine action.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **465/465 verts** (56 fichiers)
- `npm run typecheck` : **150** (inchangé)
- 4 anomalies corrigées (A114 à A117)

---

## Formulaire de vente : numéro visible, titres jaugés

- **Le numéro est attribué à l'ouverture** et affiché tel quel, à la place de la mention
  « Attribué à l'enregistrement ». Il est ensuite repris à la création : sans cela le
  service en aurait attribué un second, et la pièce aurait porté un numéro différent de
  celui annoncé à l'écran. La modification, elle, ne transmet toujours pas le champ —
  `update` propage tout ce qu'on lui donne.
- **Le pavé d'explication fiscale disparaît.** Le détail TVA et taxe communale figure déjà,
  chiffré, dans le récapitulatif de droite : la phrase le répétait sans rien ajouter.
- **Les icônes de type d'or passent à l'or de la charte** au lieu d'un gris d'état : c'est
  la nature du métal qui est en jeu.
- **Types et titres tiennent chacun sur une ligne**, en cinq colonnes qui se partagent la
  largeur plutôt que de passer à la ligne. Mesuré : cartes de 157 px, boutons de 48 px, une
  seule ligne dans les deux cas.
- **Chaque titre porte sa jauge de pureté**, 24 K valant 100 % — 18 K en marque 75, 22 K
  en marque 92. Les boutons reçoivent un intitulé explicite (« 22 carats, 91,67 % de
  pureté ») : leur contenu visible ne suffisait plus à les nommer.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **465/465 verts** (56 fichiers)
- `npm run typecheck` : **150** (inchangé)
- 2 anomalies corrigées (A118, A119)

---

## Prix au gramme adossé au cours du marché

Le prix au gramme se saisissait à l'aveugle, alors que le cours du jour s'affichait à
30 cm de là, dans la colonne de droite. Il est désormais **prérempli au cours du marché**,
reste modifiable, et l'écart à ce cours s'affiche à côté : prime en vert, décote en rouge,
en pourcentage.

Deux règles tiennent ce comportement :

- **Aucun repli.** Sans cours, ou sans taux USD/XOF au référentiel, le champ reste vide et
  l'écran dit pourquoi. Une valeur de complaisance sur cet écran deviendrait le prix payé à
  l'artisan.
- **Le préremplissage n'écrase jamais une saisie.** Il n'a lieu qu'une fois, et toute
  frappe le désarme.

### Une source, pas deux
Le panneau de cours et le formulaire auraient interrogé chacun de leur côté : deux
sondages sur le même écran, et deux valeurs susceptibles de diverger. Le hook `useCoursOr`
devient la source unique — cours, taux de change, dérivation du prix au gramme — et le
panneau y est raccordé.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **473/473 verts** (57 fichiers)
- `npm run typecheck` : **150** (inchangé)
- 2 anomalies corrigées (A120, A121)

---

## Refonte du suivi des stocks

L'écran s'appelait « Gold Inventory Management », tenait sur `MainLayout`, et ne montrait
qu'un seul chiffre utile : l'or en coffre, décliné en quatre tuiles vives qui donnaient le
même poids visuel à des postes de nature différente.

### Une vue nationale, puis le détail
`inventoryOverviewData.ts` agrège six sources en `Promise.allSettled` : stock raffiné,
sociétés minières, expéditions en cours, préparations à l'aéroport, ventes et règlements.
Une source qui ne répond pas est nommée à l'écran ; son poste reste à zéro.

L'écran ouvre sur le **socle national** — or en coffre plus or engagé hors coffre — puis
détaille : disponible, alloué, **en transit**, **à l'aéroport**, chacun avec sa part du
national. Le stock par société minière suit, et le volet de droite porte le **vendu non
réglé**, les acheminements en cours et l'or immobilisé à l'aéroport.

Une seule famille chromatique : l'or de la charte sur navy pour le socle, l'encre pour le
reste. La couleur ne signale plus qu'un écart.

### Trois champs qui n'arrivaient jamais en base
Le formulaire collectait la **teneur en argent** et la **raffinerie**, puis les laissait de
côté au moment d'enregistrer. Et la **société minière** n'était jamais posée sur la ligne
de stock : la ventilation par mine devait être reconstituée par une chaîne de jointures
`gold_inventory` → `freight_shipments` → `freight_shipment_productions` →
`daily_production`, qui se rompait dès qu'un maillon manquait.

Les trois sont désormais enregistrés, la société étant reprise de l'expédition sélectionnée.
Le schéma de `gold_inventory` ne figurant pas au dépôt, la migration `20260819_003` ajoute
les colonnes en `IF NOT EXISTS` et rattache les entrées existantes à leur société par leur
expédition. **Elle doit être appliquée** : sans elle, l'insertion porterait des colonnes
inconnues et échouerait.

### Formulaire
Réécrit en quatre sections — origine, pesées, titre et restitution, justificatifs — avec un
volet de contrôle qui donne l'or fin intégré, l'écart à l'expédition et le rappel du lot.
Les grandeurs dérivées renvoient « — » plutôt qu'un zéro : un rendement de 0 % sur une
pesée vide se lirait comme une perte totale. La validation est explicite et bloquante, y
compris sur le cas physique « masse après fonte supérieure à la masse avant ».

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **494/494 verts** (59 fichiers)
- `npm run typecheck` : **146** (150 avant)
- 5 anomalies corrigées (A122 à A126)

---

## Facture de vente — spécimen

Construite à partir de la note n°2025-0885/MEF/SG/DGI du 29 décembre 2025 et de la facture
de référence fournie. Accessible depuis la fiche de vente, imprimable, non fonctionnelle.

### La ligne que je ne franchis pas
Les éléments de certification — code SECeF, NIM MCF, ISF, compteurs, date, QR — sont
délivrés par le Module de Contrôle de Facturation, appareil acquis auprès de la Chambre de
Commerce et d'Industrie, après homologation de la plateforme comme système de facturation
d'entreprise. Aucun n'est fabriqué ici : les champs **annoncent leur propre absence**
(`SPECIMEN-NON-CERTIFIE`, « MCF non raccordé », « ISF non attribué », « Non certifiée »).

Le QR code est réel et se scanne, mais il n'imite aucune charge utile de certification : il
retourne « SPECIMEN - FACTURE NON CERTIFIEE / Aucune valeur fiscale ni comptable », suivi
des références de la pièce. Un test vérifie qu'il ne contient ni code SECeF ni NIM.

Trois marques indépendantes portent le caractère non certifié : bandeau rouge en tête,
filigrane en diagonale, bloc de certification en rouge. Aucune ne disparaît à l'impression —
la règle `print-color-adjust: exact` y veille.

### Les défauts de la facture de référence, corrigés
- **Les totaux ne se réconciliaient pas.** TOTAL TTC 78 994 face à un NET À PAYER de
  82 294, sans qu'aucune ligne n'explique les 3 300 d'écart. Ici, chaque composante est une
  ligne nommée, et un test vérifie l'égalité `HT + TVA + autres taxes − acompte = net`.
- **« TOTAL TVA 18% »** agrégeait du 10 % et du 18 %. Le total ne porte plus de taux ; le
  détail par groupe de taxation est dans son tableau.
- **Le bloc client était vide.** Il est rempli depuis l'artisan : identité, localité,
  téléphone, numéro de carte professionnelle.

### Montant en lettres
Écrit à la main, avec les accords du français : « quatre-vingts » mais « quatre-vingt-un »,
« deux cents » mais « deux cent trois », « soixante et onze ». Un cas m'a échappé au premier
jet et le test l'a rattrapé : **« cent » reste invariable devant « mille »** — cinq cent
mille, mais deux cents millions.

### Ce qui n'est pas fait, et pourquoi
Le verrou « pas de paiement sans facture certifiée » n'est pas posé : l'adosser à un
spécimen bloquerait les paiements réels sans rien garantir. Il se posera avec la vraie
certification.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **510/510 verts** (60 fichiers)
- `npm run typecheck` : **146** (inchangé)
- 1 anomalie corrigée (A127)

---

## Formulaire société minière : titres, guide, indications

- **Les titres de section venaient du socle.** `CardTitle` était en `text-2xl`, soit 24 px
  pour annoncer des champs saisis en 14 px : le titre pesait plus lourd que le contenu.
  Ramené à 16 px, ce qui corrige d'un coup les trente-quatre écrans qui l'emploient. Le
  titre de page passe de 30 à 20 px, son icône de 32 à 20 px.
- **Le volet vert est retiré.** Il occupait un tiers de la largeur pour redire, en plus
  long, ce que chaque champ porte déjà sous lui — « Nom officiel : nom complet de la
  société tel qu'enregistré légalement » face à un champ libellé « Nom officiel ». Les
  indications reviennent au pied des champs, en une ligne : « Raison sociale enregistrée »,
  « Majuscules, sans espaces ». Le formulaire occupe la largeur.
- **Le composant `FieldGuidePanel` reste**, employé par deux autres écrans, mais son
  en-tête vert plein devient neutre, sa typographie se resserre et l'élément actif passe à
  l'ambre de la charte. Son titre par défaut, « Production Guide », passe en français.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **510/510 verts** (60 fichiers)
- `npm run typecheck` : **141** (146 avant)
- 2 anomalies corrigées (A128, A129)

---

## Moyens de paiement des artisans

### Le circuit, tel qu'il est désormais posé
L'artisan vend son or à la SONASP — achat direct, valorisé sur la quantité, le titre et le
cours du jour. La déclaration produit un numéro de vente `VE-OR-AAAA-NNNNN`, dont dérive le
numéro de facture `FA-AAAA-NNNNN`. Le dossier de règlement renvoie à cette facture ;
tant que la certification DGI n'est pas raccordée, c'est le spécimen qui s'ouvre, et
l'écran le dit.

### Les coordonnées ne se saisissent plus au moment de payer
Elles étaient frappées sur l'écran de paiement, à chaque règlement : ressaisie du numéro
mobile ou du RIB à chaque fois, avec le risque de frappe que cela comporte sur un virement,
et **rien ne garantissait que le compte crédité appartienne à l'artisan**.

Elles sont désormais rattachées à sa fiche — table `snp_artisan_moyens_paiement`, migration
`20260819_004` — saisies une fois, avec un titulaire obligatoire et un moyen principal
unique garanti par un index. La fiche accepte plusieurs canaux : Orange Money, Moov Money,
Wave, autre service mobile, virement, chèque, espèces.

L'écran de paiement ne fait plus que choisir. Chaque moyen s'affiche avec son logo, le nom
du titulaire et la coordonnée masquée aux quatre derniers caractères, comme sur un relevé.
Le moyen principal est présélectionné. Les coordonnées complètes s'affichent en lecture
seule, avec un renvoi vers la fiche pour les corriger.

**Sans coordonnée enregistrée, le règlement est refusé** : l'écran affiche pourquoi et
renvoie à la fiche de l'artisan, au lieu de laisser saisir un compte à la volée.

Le règlement porte désormais le moyen employé (`moyen_paiement_id`) et le numéro de facture
présenté : un contrôle a posteriori peut remonter du paiement au compte crédité et à la
pièce qui le justifie.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **525/525 verts** (61 fichiers)
- `npm run typecheck` : **141** (inchangé)
- 3 anomalies corrigées (A130 à A132)

---

## Application des migrations en base

Cinq migrations appliquées sur `SONASP_OPS` (projet `yyverzuhkdonjjuficor`, confirmé
contre l'URL du `.env`), après relevé de l'état réel du schéma.

| Migration | Effet | Données touchées |
|---|---|---|
| `20260819_004` | Table `snp_artisan_moyens_paiement`, RLS, index d'unicité du moyen principal ; colonnes `moyen_paiement_id` et `numero_facture` sur les paiements | aucune |
| `20260819_003` | Colonnes `silver_percentage` et `refinery_id` sur `gold_inventory`, index sur la société | aucune (les 2 lignes étaient déjà rattachées) |
| `20260819_005` | **Correctif** de `get_sonasp_id()` et `set_sonasp_as_buyer()` | aucune |
| `20260819_002` | Format `VE-OR-AAAA-NNNNN` | 2 numéros de vente réécrits |
| `20260819_001` | Format `BF-AM-AAAA-XZTM-NNNN` des cartes | aucune (additive) |

`mining_company_id` existait déjà sur `gold_inventory` : la réserve émise en la livrant
n'était fondée que pour les deux autres colonnes.

### Le défaut mis au jour par la migration
La renumérotation des reçus a été **rejetée** :
`22P02 invalid input value for enum company_type_enum: "sonasp"`.

L'erreur ne venait pas de la migration mais du déclencheur `trigger_set_sonasp_buyer`.
`set_sonasp_as_buyer()` et `get_sonasp_id()` comparent `company_type = 'sonasp'` — une
valeur qui n'existe pas dans l'énumération, laquelle ne connaît que `production_mine`,
`institution` et `parent_company`. Postgres convertit le littéral vers le type de la
colonne, échoue, et lève l'exception.

Le déclencheur s'exécutant BEFORE INSERT OR UPDATE, **aucune vente d'or artisanale ne
pouvait être créée ni modifiée**. Les deux ventes présentes en base sont antérieures à
l'état actuel du schéma.

SONASP figure au référentiel avec `code = 'SONASP'` et `company_type = 'institution'` :
c'est le code qui l'identifie. Les deux fonctions le lisent désormais, sans ajout de
valeur d'énumération ni modification de l'écran de création d'une société.

### Contrôles après application
- Numéros de vente : `VE-OR-2025-00001`, `VE-OR-2025-00002` ; prochain attribué
  `VE-OR-2026-00001`.
- `snp_encoder_instant_carte(now())` répond, `get_sonasp_id()` renvoie l'identifiant
  attendu.
- Trois colonnes de stock, deux colonnes de paiement, table des moyens et ses trois index
  en place.
- Avis de sécurité Supabase : **aucun de niveau erreur**, aucun visant la nouvelle table.
  Les 360 avertissements — dont 184 `function_search_path_mutable` — sont préexistants.

---

## Rafraîchissements permanents et pages blanches

Quatre causes distinctes, cumulées.

### 1. Le service worker rechargeait la page tout seul
`vite-plugin-pwa` était en `registerType: 'autoUpdate'` : dès qu'un nouveau service worker
était détecté, la page **se rechargeait d'elle-même**, sans rien annoncer — en pleine
saisie le cas échéant. C'est la « plateforme qui se met à jour en permanence ». Passé en
`prompt` : la mise à jour s'installe, mais aucun rechargement n'est déclenché.

### 2. Une clé qui remontait tout l'arbre
`<RouteErrorBoundary key={location.pathname}>` : poser la route sur `key` **remonte tout le
sous-arbre** à chaque navigation, y compris quand seul un paramètre change. La clé devient
une propriété `resetKey` : la limite d'erreur efface son état sur changement de route, sans
détruire ses enfants.

### 3. L'habillage vivait à l'intérieur de chaque page
Chaque page rendait son propre `NationalDashboardLayout`. La mise en page se trouvant à
l'intérieur de l'élément de route, changer de page la détruisait pour la reconstruire :
barre latérale, en-tête et filtres repartaient de zéro à chaque navigation.

`NationalDashboardChrome` monte l'habillage une seule fois, comme route parente ; les 53
routes concernées y sont regroupées. **Aucune page n'a été réécrite** : un contexte rend
`NationalDashboardLayout` transparent quand un habillage est déjà monté plus haut, si bien
que les pages continuent de l'appeler sans effet. Les 68 autres routes, encore sur
`MainLayout` ou publiques, restent hors du regroupement — elles porteraient sinon deux
habillages.

Contrôle : les 121 chemins de route sont identiques avant et après regroupement, aucun
perdu, aucun ajouté.

### 4. Le repli de suspense effaçait l'écran entier
`<Suspense fallback={<RouteFallback />}>` enveloppait `<Routes>`, donc l'habillage. Le
chargement d'un module différé remplaçait **toute la page** par le repli : d'où l'écran
blanc. Le repli vit désormais dans `main`, à l'intérieur de l'habillage.

### Métriques
- `npm run build` : **vert**
- `npx vitest run` : **529/529 verts** (62 fichiers)
- `npm run typecheck` : **141** (inchangé)
- 4 anomalies corrigées (A134 à A137)

---

## Audit de cohérence après deux sessions simultanées

Deux sessions ont travaillé en parallèle sur le dépôt. L'audit porte sur ce qui en
résulte.

### Ce qui a bien fusionné
- **Aucun marqueur de conflit**, aucun fichier `.orig`, `.rej` ou dupliqué.
- Les travaux se recouvrant se sont composés proprement : `VenteOrDetails` porte à la
  fois le bouton « Facture (spécimen) » et l'action « Approuver » restreinte aux
  approbateurs ; la barre latérale porte l'entrée « Approbateurs » repointée, et le
  garde-fou de largeur des intitulés continue de passer.
- **122 chemins de route, aucun doublon, aucun cul-de-sac** : les 48 entrées de menu
  résolvent toutes vers une route déclarée.
- Aucune page orpheline : tout fichier de page est référencé.
- Base de données conforme au code : table des moyens de paiement, trois colonnes de
  stock, deux colonnes de paiement, cinq fonctions, et **aucune vente hors format**.

### Ce que l'audit a rattrapé
Le regroupement des routes sous l'habillage n'était **appliqué qu'à moitié**. La
partition initiale ne retenait que les pages citant `NationalDashboardLayout` ; or
`MainLayout` n'est plus qu'une enveloppe autour de ce même composant. Résultat : 54
routes rendaient bien l'habillage tout en restant hors de la route parente, et le
reconstruisaient donc à chaque navigation — le défaut corrigé au tour précédent
persistait sur la moitié de l'application.

Trois angles morts de détection expliquaient l'écart :
- les **imports avec alias** (`AnalyticsDashboardEnhanced as AnalyticsDashboard`), la
  route citant l'alias ;
- les formes d'export non couvertes ;
- les **coquilles indirectes** — les tableaux de bord par rôle passent par
  `RoleDashboardShell`, qui monte l'habillage pour eux.

Après reprise avec une détection qui résout chaque route jusqu'à son fichier et suit une
indirection : **108 routes sur 122 sous l'habillage**, aucune ne le rendant en double.

### Ce qui reste, et qui relève d'une décision
Trois écrans protégés n'ont **aucune navigation** : `/help`,
`/stakeholders/freight-companies` et `/stakeholders/refinery-plants`. Un utilisateur qui
y arrive n'a ni barre latérale ni en-tête. Leur donner l'habillage changerait leur
apparence : ce n'est pas une correction à faire sans arbitrage.

Par ailleurs, l'entrée de menu « Déposants » ayant été renommée « Approbateurs » et
repointée, les pages `/stakeholders/depositors` restent accessibles par URL mais ne
figurent plus au menu. À confirmer : suppression, ou réintégration ailleurs.

### Contrôles
- `npm run build` : **vert**
- `npx vitest run` : **529/529 verts** (62 fichiers)
- `npm run typecheck` : **141**, inchangé
- 122 chemins de route identiques avant et après regroupement

---

## Compte de présentation et pages sans navigation

### Le rôle `owner` n'existait pas en base
`romuald.tiegnan@gmail.com` était enregistré en `management`. Or `ProtectedRoute`
n'accorde qu'à `owner` le contournement de toute restriction de rôle : quatre routes —
les tableaux de bord usine, aéroport, raffinerie et client — lui restaient fermées.

La cause était plus bas : `user_profiles_role_check` n'admettait que cinq rôles sur les
sept que le code définit. **Aucun compte ne pouvait porter `owner` ni `admin`**, alors que
dix routes se réservent à `['management', 'admin']`. Le contournement était une liste
d'adresses codée en dur dans `AuthContext` (`OWNER_ACCOUNT_EMAILS`), qui forçait le rôle à
l'exécution sans que la base en sache rien : le profil affichait « management » pendant
que l'application traitait le compte en propriétaire.

La contrainte est élargie aux sept rôles (migration `20260819_006`) et le compte passe en
`owner`, en base comme en session. La liste codée en dur devient un filet, non plus le
seul mécanisme.

### Les trois pages sans navigation
- `/stakeholders/freight-companies` et `/stakeholders/refinery-plants` sont des
  **ré-exports** d'une ligne vers des pages d'administration qui, elles, portent
  l'habillage. Mon audit ne suivait pas la ré-export : faux négatifs. Routes ramenées sous
  la route parente.
- `/help` est une page autonome, avec son propre en-tête et son retour au tableau de bord.
  Son seul problème était d'être **inatteignable** : le lien vers elle ne vivait que dans
  `Header.tsx`, composant qu'aucun écran n'importe. Un accès discret rejoint l'en-tête de
  l'application ; la page garde son habillage propre.

Restent hors habillage, à bon droit : `/`, `/login`, `/activate-account`, `/auth/callback`
et `/settings`, cette dernière n'étant qu'une redirection vers `/parameters`.

### Contrôles
- `npm run build` : **vert**
- `npx vitest run` : **529/529 verts** (62 fichiers)
- `npm run typecheck` : **141**, inchangé
- Plateforme démarrée en local sur le port 5180, aucune erreur de console

---

## Itération — 20 août 2026 — Deux ventes distinctes : l'achat aux mines, l'export SONASP

### Ce qui a été trouvé

La plateforme ne connaissait qu'**une seule** vente d'or industriel : `sales`, avec la mine
comme vendeur (`seller_type = 'mining_company'`) et un raffineur international comme client.
Le circuit réel en compte deux :

1. **La mine vend à la SONASP.** Elle déclare sa production journalière, qui constitue son
   stock ; en fin de mois, la SONASP lui achète tout ou partie de ce stock. C'est le pendant
   industriel de l'achat aux artisans miniers — et il n'existait nulle part.
2. **La SONASP vend hors du Burkina.** Avec l'or ainsi acquis, aux mines comme aux artisans.

En confondant les deux, la base faisait passer l'or de la mine au raffineur **sans qu'il
appartienne jamais à la SONASP** : aucune écriture ne reliait ce qu'elle achetait à ce
qu'elle revendait, et son stock exportable n'était calculable par aucun écran.

Relevé en base avant intervention : 5 ventes, toutes au nom d'une mine ; **0 pré-vente**
(le module était donc supprimable sans perte) ; production déclarée SEMAFO 3 543,94 oz,
Wahgnion 10 853,12 oz ; 4 clients internationaux.

### Ce qui a été décidé

- **Suppression du module de pré-ventes** (A142). Les tables restent en base :
  `customer_accounts_receivable.pre_sale_id` référence `pre_sales`, et détruire la table
  casserait cette contrainte pour rien. `CustomerAccountsWidget`, qui n'en dépendait que
  par les pré-ventes, disparaît avec le module.
- **Nouvelle table `snp_achats_mines`** (A143), numérotée `AC-MI-AAAA-NNNNN` par déclencheur,
  sur le modèle des ventes artisanales. Le stock d'une mine se calcule et ne se stocke pas :
  production déclarée sur la période moins achats déjà engagés. Un achat annulé libère sa
  quantité ; un achat en attente la retient, car elle est déjà promise.
- **Le disponible ne descend pas sous zéro.** Un sur-achat se lit dans l'écart entre produit
  et acheté, pas dans un stock négatif qui masquerait l'anomalie.
- **La SONASP devient la vendeuse de `sales`** (A144). Le champ vendeur n'est plus saisissable :
  il vaut la SONASP, identifiée par son code, jamais par un libellé. Le stock opposable à la
  vente devient son stock exportable — achats aux mines + achats aux artisans − ventes déjà
  conclues — et non plus l'inventaire d'une mine.
- **Habilitations commerciales de la SONASP** : `gold_sales_settings` n'ouvrait des clients
  qu'aux mines. Sans ligne pour la SONASP, la liste déroulante des clients serait restée vide
  au moment même où elle devient vendeuse (A145). Une ligne par client actif lui est ouverte,
  aux conditions déjà en vigueur.
- **L'espace de négoce cesse de choisir une mine.** La sélection par tuiles décrivait un
  stock qui n'est plus celui du vendeur ; elle cède la place à la fiche du vendeur SONASP et
  à la décomposition de son stock exportable.

### Ce qui a été corrigé en chemin

- Le raccourci « Acheter tout le stock » ne s'affichait qu'une fois une quantité déjà saisie —
  c'est-à-dire jamais quand il sert. Il apparaît désormais dès la société choisie.
- Le stock reçu par la navigation (`availableStockOz`) décrivait l'inventaire d'une mine et
  aurait continué de s'imposer au formulaire de vente : il est ignoré au profit du calcul.

### Contrôles

- `npx vitest run` : **563/563 verts** (65 fichiers, 34 ajoutés cette itération)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **141**, inchangé
- Modules servis sans erreur par Vite sur le port 5180

---

## Itération — 20 août 2026 — De la mine au raffineur : le chaînage achat → vente

### Ce qui a été trouvé

L'itération précédente avait fait de la SONASP la vendeuse des ventes à l'export et calculé
son stock exportable. Ce stock ne se vérifiait qu'**en masse** — total acheté moins total
vendu — de sorte qu'aucun écran ne pouvait dire de quelle mine ou de quel artisan venait
l'or d'une expédition. Pour une plateforme de traçabilité nationale, c'est le cœur du sujet.

Deux constats en examinant l'existant :

- `sales_allocations` rattache une vente à un enregistrement d'**affinage**
  (`refining_record_id`) : elle décrit la chaîne d'affinage, pas la chaîne d'acquisition.
  Vide, lue par aucun écran. Elle est laissée en place plutôt que détournée de son sens.
- Le contrôle de stock du formulaire de vente interrogeait `daily_production` pour
  `mining_company_id = <vendeur>` au statut `in_safe`. Le vendeur étant devenu la SONASP,
  qui ne déclare aucune production, **ce contrôle aurait bloqué toutes les ventes** (A147).

### Ce qui a été décidé

- **Table `snp_ventes_lots`** : une ligne = une fraction d'un lot d'achat affectée à une
  vente. Une vente se compose de plusieurs lots, un lot peut servir plusieurs ventes. La
  contrainte garantit qu'une ligne porte une source et une seule, cohérente avec son type.
- **Répartition au plus ancien d'abord.** L'or entré le premier sort le premier : cela
  limite l'immobilisation et rend la composition reproductible. Deux lots du même jour sont
  départagés par leur référence, pour que deux exécutions donnent le même résultat.
- **Un reste non couvert se signale, il ne se comble pas.** Si les achats enregistrés ne
  couvrent pas la quantité vendue, la vente est refusée en nommant les onces sans origine —
  plutôt que d'accepter une vente d'or qui n'est entré nulle part.
- **Le contrôle de couverture remplace le contrôle d'inventaire.** Le stock de la SONASP
  n'est pas un inventaire physique à son nom : c'est la somme de ce qu'elle a acheté aux
  mines et aux artisans, moins ce qu'elle a déjà vendu.
- **L'échec du traçage ne se tait pas.** Si les lots ne peuvent pas être écrits après la
  création de la vente, l'utilisateur en est averti : une vente sans origine tracée est un
  stock non justifié.
- **La fiche de vente affiche l'origine de l'or** : chaque lot, son vendeur d'origine, sa
  référence et sa part, avec le total tracé. Les ventes antérieures au chaînage l'annoncent
  au lieu d'afficher un tableau vide.

### Ce qui reste à surveiller

Le stock exportable (masse) et la somme des lots affectés ne coïncident que si **toute**
vente écrit sa composition. C'est le cas des ventes créées désormais ; aucune vente de la
SONASP n'existait avant cette itération, l'écart de départ est donc nul. Une vente créée
hors du formulaire — par script ou en base — creuserait l'écart sans que rien ne le signale :
un contrôle de cohérence entre les deux mesures reste à écrire.

### Contrôles

- `npx vitest run` : **580/580 verts** (66 fichiers, 17 ajoutés)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **141**, inchangé
- Modules servis sans erreur par Vite sur le port 5180

---

## Itération — 20 août 2026 — Le contrôle qui empêche l'écart de se dissoudre

Le chaînage achat → vente ne vaut que s'il est **complet**. Le stock exportable se mesure de
deux façons qui doivent coïncider : en masse (total acheté − total vendu) et pièce à pièce
(somme des lots affectés aux ventes). Elles ne coïncident que si toute vente écrit sa
composition ; une vente créée par script, par import ou directement en base y échapperait, et
le stock paraîtrait entamé sans qu'on sache par quel or.

### Ce qui a été décidé

- **Le contrôle nomme les ventes, il ne rend pas un total.** Un écart global n'est pas
  actionnable ; la liste des ventes concernées, avec ce qui manque à chacune, l'est. Chaque
  ligne renvoie à la fiche de la vente.
- **Un excès de lots ne compense pas un manque ailleurs.** Si une vente porte plus de lots
  que sa quantité, le surplus n'est pas compté comme une traçabilité en avance : c'est une
  anomalie distincte, et la masquer laisserait passer une seconde vente non tracée.
- **Les ventes annulées n'entament rien** et sortent du contrôle.
- **La bannière ne s'affiche que si l'écart existe.** Un contrôle qui parle en permanence
  n'est plus lu.
- **L'échec du contrôle n'emporte pas la page.** Le tableau de bord des ventes reste
  utilisable ; c'est la bannière qui disparaît, jamais les ventes.

### Contrôles

- `npx vitest run` : **588/588 verts** (67 fichiers, 8 ajoutés)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **141**, inchangé

---

## Itération — 20 août 2026 — Or en coffre : des objectifs votés, non inventés

### Ce qui a été trouvé

`ProductionInSafe` comparait le réalisé à des objectifs **codés en dur** :

```ts
wtd: { actual: 0, budget: 850, forecast: 780 },
mtd: { actual: 0, budget: 2800, forecast: 2500 },
ytd: { actual: 0, budget: 5500, forecast: 5000 }
```

Ces trois paires ne venaient d'aucune source. Elles étaient pourtant affichées avec feux
tricolores, pourcentages d'écart et mentions « Excellent / Attention / Critique » — soit le
vocabulaire du pilotage appliqué à des nombres inventés. Un directeur y aurait lu une
performance nationale.

Or les objectifs réels existent en base : `monthly_budgets` porte 48 lignes de budget mensuel
par société, `quarterly_forecasts` 15 lignes de prévision révisée. Elles n'étaient simplement
pas lues (A150).

### Ce qui a été décidé

- **Cumul au prorata des jours.** Chaque mois porte un rythme journalier ; une période à
  cheval sur deux mois additionne les deux rythmes. La semaine en cours commence le lundi,
  non le dimanche comme le faisait l'ancien calcul.
- **Un mois sans objectif est nommé, pas compté pour zéro.** Sans cela, un objectif partiel
  se lirait comme un objectif atteint. L'écran écrit « Budget non voté pour juillet 2026 »
  et n'affiche aucun écart tant que la période n'est pas entièrement couverte.
- **Aucun écart sur un objectif inconnu.** Un pourcentage calculé sur un objectif partiel
  accuse à tort ; il vaut mieux ne rien dire.
- **La société filtrée restreint aussi les objectifs.** Comparer la production d'une mine au
  budget national dirait n'importe quoi.
- **Une prévision révisée remplace la précédente**, elle ne s'y ajoute pas : seule la
  dernière révision de chaque mois est retenue.
- **Une source en échec se tait pour son compte** — « Source « budgets mensuels » non lue » —
  sans vider la page ni les déclarations.

L'écran passe au socle : `NationalDashboardLayout`, `PageHeader`, `StatGrid`, volet latéral
de filtres, tableau `sn-table`, libellés en français. Il quitte `MainLayout` et les
traductions `t('production.*')` qui coexistaient avec du texte anglais en dur.

### Contrôles

- `npx vitest run` : **618/618 verts** (69 fichiers, 30 ajoutés)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **141**, inchangé
- Audit d'habillage : 120 routes, aucune hors habillage

---

## Itération — 20 août 2026 — La fiche de production cesse de suppléer aux données

### Ce qui a été trouvé

`ProductionDetails` comblait chaque donnée absente par une valeur d'un autre projet :

```tsx
{miningCompany?.name || 'Kourousa'}
{production.bar_reference || 'KOURO-2511-1000'}
Production {production.bar_reference || `KOURO-${production.id.slice(0, 8)}`}
const [siteCountry] = useState<string>('Guinée');
```

Kourousa est une mine guinéenne ; « KOURO » est son préfixe de barres. Sur une plateforme
burkinabè, une déclaration sans référence s'affichait donc sous une référence guinéenne
inventée, rattachée à une mine guinéenne, dans un pays guinéen (A152). Pire : `siteCountry`
n'était jamais renseigné — `setSiteCountry` n'est appelé nulle part — et cette constante
alimentait la fenêtre de confirmation des changements de statut ainsi que l'historique, où
elle passait pour le pays du site.

Deux autres défauts, du même ordre :

- Le bouton **Modifier** menait vers `/production/daily-production`, **route inexistante** :
  la modification n'aboutissait jamais (A153).
- L'historique résolvait les auteurs dans la table `profiles`, **absente de ce schéma** — le
  référentiel s'appelle `user_profiles`. Chaque requête échouait en silence et **toute**
  modification était attribuée à « Système » (A154). Une piste d'audit qui ne nomme jamais
  son auteur ne vaut rien.

### Ce qui a été décidé

- **Rien n'est suppléé.** Une référence absente s'affiche « Barre sans référence », une
  compagnie inconnue « — ». Le pays vient de `mining_companies.country` ; s'il manque, aucun
  pays n'est transmis à la fenêtre de confirmation.
- **Les auteurs sont résolus en une requête** sur `user_profiles`, et l'on distingue trois
  cas au lieu d'un : un changement automatique est dit « Système », un compte introuvable
  « Auteur inconnu », un compte connu porte son nom. Les confondre effaçait la
  responsabilité de chaque modification.
- **Modifier ouvre réellement le formulaire** sur la déclaration concernée : la fiche passe
  l'identifiant par l'état de navigation, que la page des déclarations consomme une fois — un
  retour arrière ne doit pas rouvrir le formulaire.
- **Les impuretés ne deviennent pas négatives** sur un titre incohérent : le complément à
  100 % est borné à zéro, et l'incohérence se lit dans les parts d'or et d'argent.
- **Un onglet d'historique** remplace la colonne latérale : l'historique était affiché en
  permanence dans un tiers de l'écran, y compris quand il était vide.
- Chaque source annexe s'affiche ou se tait pour son compte : un historique illisible ne
  vide plus la fiche.

L'écran rejoint le socle et passe entièrement au français — « Mining Company », « Bar
Reference », « Bullion Total » subsistaient en anglais au milieu du texte français.

### Contrôles

- `npx vitest run` : **639/639 verts** (71 fichiers, 21 ajoutés)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **140**, une erreur héritée de moins

---

## Itération — 20 août 2026 — Extirper l'identité de l'autre exploitant

Question posée : « les données figées comme le pays "Guinée" sont-elles toutes corrigées ? Les
mines doivent toutes être au Burkina Faso. » La réponse était non, et le balayage a montré que
le mal dépassait de loin la constante repérée sur la fiche de production.

### Ce que le balayage a trouvé

**1. L'identité du site, jusque dans la base.** `daily_production`, `annual_budgets` et
`production_forecasts` portaient `site_id = 'guinea'` sur toutes leurs lignes, et une dizaine
de services prenaient `'guinea'` en valeur par défaut de paramètre. Le filtre et la donnée
concordaient, si bien que rien ne paraissait anormal — mais toute la production nationale
était rangée sous un site guinéen (A155).

**2. Les lignes de production étaient gelées.** Les dix déclarations référençaient un compte
`auth.users` supprimé. La clé étrangère étant en NO ACTION, PostgreSQL la revalide à chaque
mise à jour : **toute** modification échouait, changement de statut compris. La production
était immobilisée sans qu'aucun écran ne l'explique (A156). Découvert en tentant la
renumérotation des barres — la migration a d'abord échoué sur cette contrainte.

**3. Les références de barres portaient les codes d'un autre exploitant.** HUMSMK (Komana,
Mali), HUMDUG (Dugbe, Liberia), HUMSEM, HUMWAH — et le générateur préfixait « HUM » à
n'importe quel nom. Pire, le préfixe ne correspondait pas toujours à la société de la ligne :
des barres de SEMAFO portaient le code d'une mine malienne (A157).

**4. Le bordereau de colisage expédiait depuis Bamako.** Le document portait « HUMMINGBIRD
RESOURCES » et l'adresse de la Société des Mines de Komana, Bamako, Mali (A158). Sur un
document d'expédition d'or burkinabè.

**5. Un écran de paiement entièrement fictif.** `/customers/:id/payments` affichait une vente
inventée — SL-2024-042, Premium Gold Ltd., 156 450 $ — des taux de change codés en dur, et son
bouton « Enregistrer » se contentait de revenir en arrière : **rien n'était enregistré**
(A159).

**6. Trois comptes bancaires inventés** étaient proposés au règlement quand le paramètre
n'était pas défini : « Mansa Resources USD/EUR/CFA Account » (A160).

**7. Le filtre des sociétés productrices ne filtrait rien.** Il écartait la société nommée
exactement « Mansa Resources S.A. », absente de ce référentiel : la SOPAMIB et la SONASP
elle-même figuraient parmi les mines dans tous les sélecteurs, et recevaient des budgets de
production nuls (A161).

**8. Le franc guinéen tenait lieu de monnaie suivie.** Trois des cinq paires de change
surveillées étaient en GNF, monnaie sans cours au Burkina (A162).

**9. Les rapports et les analyses étaient inventés de bout en bout.** Six rapports PDF et un
export Excel produisaient des documents signés SONASP avec 9 945 000 $ de recettes, 337 lots,
18 clients, des usines au Mali et en Guinée, et des « recommandations stratégiques » (A163).
Les six onglets d'analyses reposent sur 157 lignes de données écrites en dur (A164).

**10. Le schéma du circuit de l'or** décrivait la chaîne de Hummingbird Resources — Kourousa
Guinea Mining, Komana, Mansa Management Middle East — avec des parts chiffrées sans source.

### Ce qui a été décidé

- **Une seule constante pour l'identité nationale** (`src/constants/site.ts`) plutôt qu'un
  défaut répété en vingt-trois endroits : un défaut dispersé se corrige à moitié.
- **La base et le code changent ensemble.** Renommer la clé d'un côté seulement aurait vidé
  les écrans ; les deux migrations et le code partent dans le même lot.
- **Un compte supprimé ne gèle plus rien** : références orphelines mises à NULL, clés passées
  en ON DELETE SET NULL sur les cinq tables de production.
- **Les références de barres viennent du code de la société** au référentiel — SBM-0001,
  WGM-0001 — et les anciennes sont conservées dans les observations.
- **Un document signé de la SONASP ne repose pas sur des chiffres d'exemple.** Les six
  rapports et l'export Excel refusent désormais, en nommant ce qui manque, plutôt que
  d'émettre un faux. Le générateur inventé (602 lignes) est supprimé.
- **Les analyses annoncent leur nature** tant que le module n'est pas raccordé : un chiffre
  inventé qui se présente comme national nuit plus qu'un écran vide.
- **L'écran de paiement fictif est retiré**, sa route renvoyant vers l'écran qui enregistre
  réellement.
- **Le schéma du circuit montre le circuit réel et aucun chiffre** : les volumes se lisent sur
  les écrans qui les tiennent.

### Ce qui est resté, à dessein

Les listes de référence — pays du monde, villes et aéroports africains, banques par pays,
pays du Sahel pour la nationalité des artisans — conservent la Guinée : ce sont des
référentiels, pas l'identité de la plateforme.

### Contrôles

- `npx vitest run` : **639/639 verts**
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, neuf erreurs héritées de moins
- Audit d'habillage : 120 routes, aucune hors habillage

---

## Itération — 20 août 2026 — « Or en coffre » : définir avant de dessiner

Demande : améliorer le design des tuiles, retirer les pastilles de filtres sous le titre — les
filtres sont déjà dans le panneau latéral — et **d'abord définir ce qu'est l'or en coffre**.

### La définition manquait, et son absence faussait les chiffres

L'écran ne disait nulle part ce qu'il comptait. En cherchant à l'écrire, la règle appliquée par
le code s'est révélée fausse : le coffre retenait **toute déclaration non annulée**, y compris
celles déjà parties. Quatre barres sur dix étaient rattachées à une expédition partie, dont
deux déjà chez le raffineur (`shipped_to_refinery`). Le coffre affichait de l'or qu'il ne
détenait plus (A165).

Définition retenue, désormais écrite en tête du module et affichée à l'écran :

> Une barre **entre** au coffre à sa déclaration de production, **y reste** tant qu'elle est
> préparée ou prête pour la douane, **en sort** au départ de son expédition vers le raffineur.
> Les déclarations annulées n'y entrent jamais.

Trois conséquences : les barres parties sont retirées des cumuls ; l'écran dit combien il en a
retiré ; si les expéditions ne peuvent pas être lues, il l'annonce plutôt que de présenter un
cumul qu'il sait surestimé.

**Distinction préservée** — la section « Production réalisée par rapport aux objectifs » compte,
elle, l'or expédié : il a bien été produit. Comparer une production à un budget de production
n'a rien à voir avec inventorier un coffre. Les deux notions cohabitent désormais avec des
libellés qui les distinguent.

### Un filtre qui ne pouvait rien trouver

Le filtre de statut proposait « Expédié » et « Affiné ». L'énumération `production_status_v2`
ne connaît que `prepared`, `ready_for_customs` et `cancelled` : choisir l'une de ces deux
valeurs vidait la table sans rien expliquer (A166). Les deux entrées sont retirées.

### Design

- **Pastilles de filtres supprimées.** Elles répétaient sous le titre ce que le bouton
  « Filtres » porte déjà en compteur. La place revient à la définition. La règle CSS est
  conservée : « Production journalière » s'en sert encore.
- **Tuiles de période refondues.** Elles empilaient quatre nombres de même poids — réalisé,
  objectif, écart en onces, écart en pourcentage — et une phrase grise aussi longue qu'eux.
  Rien ne disait où porter l'œil. Désormais : le réalisé domine (30 px, chiffres tabulaires),
  une **jauge** donne la part d'objectif atteinte d'un coup d'œil, l'écart chiffré passe en
  second rang, et les mentions de source manquante passent en italique discret.
- La jauge est bornée à 100 % — elle ne peut pas déborder — tandis que l'écart chiffré garde le
  dépassement entier.

### Contrôles

- `npx vitest run` : **646/646 verts** (7 tests ajoutés : sorties du coffre, avertissement de
  source illisible, définition affichée, absence des pastilles, bornage de la jauge)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé

Vérification visuelle non faite : la session du navigateur d'aperçu s'est déconnectée et je
n'ai pas à saisir d'identifiants.

---

## Itération — 20 août 2026 — La précision se consulte, elle ne s'impose pas

Retour sur l'écran du coffre : le pavé de définition surcharge la page, et les messages du
genre « Prévision absente pour avril 2026, mai 2026, juin 2026, juillet 2026, août 2026 » ne
sont pas professionnels. Consigne : la plateforme doit être raffinée, ce n'est ni un support
de cours ni un outil de formation. Balayer l'ensemble des écrans.

### Ce qui a été fait

**Une primitive `Infobulle`** (`src/components/ui/sn`) : une icône « i » qui ouvre sa précision
au survol comme au clic — le survol seul exclurait le tactile — et se ferme à Échap ou au clic
au-dehors. `PageHeader` et `Section` acceptent désormais une propriété `info`, si bien qu'une
définition se replie sans que la page perde l'information.

**Les messages d'absence sont ramenés à leur substance.** « Prévision absente pour avril 2026,
mai 2026… » devient « Prévision non saisie » ; « Source « budgets mensuels » non lue » devient
« Source illisible ». L'énumération des mois manquants n'apprenait rien à qui pilote : le mois
concerné est déjà le titre de la tuile.

**Balayage complet** : 14 notes de plus de 115 caractères recensées sur l'ensemble des écrans,
toutes traitées. Trois destins selon la nature du texte :

| Nature | Traitement | Écrans |
|---|---|---|
| Définition ou règle permanente | Repliée en infobulle | Coffre, approbateurs, référentiel des statuts, circuit d'expédition |
| Explication du principe de conception | Supprimée | Tableaux de bord (« restent vides plutôt que d'afficher une estimation »), stocks, centre de rapports |
| État ou avertissement | Resserré, conservé visible | Assistant IA, habilitations, fiche artisan, paramètres, modules, suivi de carte |

**Un cas traité à part** : l'avertissement de la facture artisanale (387 caractères). Remettre
cette pièce à un client ou à l'administration exposerait à une sanction : la mise en garde
reste entière et visible — « Spécimen sans valeur fiscale. Ni remise à un client, ni présentée
à l'administration. » — et seul le détail technique (SECeF, NIM MCF, ISF) passe en infobulle.

### Contrôles

- `npx vitest run` : **646/646 verts**
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé

---

## Itération — 20 août 2026 — Un jeu de données pour présenter la plateforme

Demande : analyser la structure de la base et y ajouter de quoi présenter la plateforme —
production, exportations, paiements, licences, prévisions budgétaires de quelques mines, et des
ventes aux prix de 2026.

**Réserve exprimée puis levée.** La consigne permanente du projet interdit les jeux de
démonstration en production. La demande étant explicite, le jeu a été posé — mais **tout est
marqué et supprimable** : chaque ligne porte « Jeu de présentation » dans ses observations, les
cours et taux simulés portent la source `SIMULATION_PRESENTATION_2026`, et les requêtes de
suppression figurent en tête de `supabase/migrations/20260820_007_jeu_presentation_2026.sql`.

### Ce que l'analyse de la base a révélé

Quatre défauts structurels bloquaient l'écriture de données burkinabè, tous invisibles depuis
les écrans déjà corrigés :

| Contrainte | Ce qu'elle interdisait |
|---|---|
| `sites_country_check` | `country IN ('GN','CI','ML')` — **le Burkina Faso était interdit** (A169) |
| `fx_rates_daily_currency_pair_check` | pas d'EUR/XOF, alors que les écrans de marché la suivent depuis le lot précédent (A170) |
| `sales_seller_type_check` | `'mining_company'` ou `'mansa_ressources'` — la SONASP n'avait pas de valeur pour se désigner (A171) |
| 57 clés étrangères vers `auth.users` en NO ACTION | toute ligne référençant un compte supprimé était **immodifiable** (A172) |

Le quatrième s'est révélé en tentant de renuméroter les expéditions : la mise à jour a échoué
sur un `created_by` disparu. C'est le même défaut que A156, mais généralisé à toute la base —
production, ventes, paiements, expéditions, artisans, cartes professionnelles.

S'y ajoutaient les résidus de référentiel : dix sites tous guinéens, maliens ou ivoiriens, les
abréviations KGM / DGB / MAN, et la SONASP nommée « Substances **Naturelles** ».

### Une erreur commise et réparée

La première rédaction de la correction des clés étrangères relisait `pg_constraint` pour savoir
lesquelles reposer — **après** les avoir supprimées. La lecture ne renvoyait plus rien : les
cinquante-sept clés ont été retirées et non reposées, laissant les colonnes d'auteur sans
contrainte d'intégrité. Détecté au contrôle qui a suivi, réparé par une migration de
rétablissement, puis fusionné dans un script correct qui relève la liste **avant** de supprimer.

### Le jeu de données

| Domaine | Volume |
|---|---|
| Mines industrielles | 2 → **6** (Essakane, Houndé, Sanbrado, Bomboré ajoutées) |
| Sites | 10 guinéens/maliens → **9 burkinabè** |
| Raffineurs habilités | 1 → **4** (Metalor, Valcambi, Argor-Heraeus) |
| Budgets 2026 | 6 mines, **213 274 oz**, mensualisés avec saisonnalité |
| Prévisions révisées | 72 lignes, une par mois et par mine |
| Production journalière | **196 coulées**, 135 522 oz, du 9 janvier au 14 août |
| Licences d'exportation | 4 nouvelles ; consommation recalculée sur la production réelle |
| Expéditions | **5**, 60 barres, vers les quatre affineurs |
| Achats aux mines | **42**, 126 918 oz, ~393 milliards FCFA (TVA 18 %, TDC 1 %) |
| Ventes à l'export | **12**, 8 400 oz, ~34 M$, du 6 février au 14 août |
| Règlements | 4, dont 2 approuvés |
| Cours de l'or | 4 297 → 4 534 $/oz sur 2026, jours ouvrés |

**Rien n'est posé indépendamment.** Le doré se déduit de l'or fin et du titre ; l'achat mensuel
de la production réellement déclarée ; la vente du cours du jour lu dans `gold_prices_daily` ;
la licence du budget de la mine ; les totaux d'expédition des barres embarquées. Les six mines
suivent des trajectoires distinctes — Bomboré dépasse son objectif, Boungou décroche — pour que
la comparaison au budget montre autre chose qu'une ligne plate.

L'écran du coffre distingue désormais **136 barres détenues (94 954 oz)** des **60 parties
(40 568 oz)** : la définition posée au lot précédent produit enfin un effet visible.

### Contrôles

- `npx vitest run` : **646/646 verts**
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé

---

## Itération — 20 août 2026 — Marché artisanal, et des libellés qui ne s'annoncent plus

Deux demandes : ajouter des ventes pour la présentation, et **éviter les termes de démonstration
dans les données**.

### Les libellés d'abord

Les lignes posées à l'itération précédente portaient « Jeu de présentation — … » dans leurs
observations, et les cours la source « SIMULATION_PRESENTATION_2026 ». Ces champs s'affichent :
la fiche de production montre ses observations, le panneau des cours montre sa source. En pleine
présentation officielle, la plateforme avait l'air d'une maquette.

Les libellés sont devenus ceux d'une écriture ordinaire — « Coulée hebdomadaire »,
« Achat mensuel de la production déclarée », « Règlement de vente à l'export ». La source des
cours devient « Référence interne » : ce n'est pas un fixing LBMA et l'écran ne doit pas le
laisser croire, mais ce n'est pas non plus une pancarte au milieu d'une démonstration.

**La traçabilité ne disparaît pas** : toutes ces lignes ont été créées le 20 août 2026, ce qui
suffit à les retrouver. Les requêtes de suppression, mises à jour, sont en tête de
`20260820_008_libelles_metier.sql`.

### Le marché artisanal

Le module était presque vide : soixante-trois artisans inscrits, deux ventes, **aucun** moyen de
paiement, **aucune** facture définitive, **aucun** règlement. L'écran « Historique des
paiements » affichait quatre compteurs à zéro.

| Objet | Volume |
|---|---|
| Moyens de règlement | **30** — Orange Money, Moov Money, Wave, virement |
| Ventes d'or | **36**, 31,5 kg, 2,7 milliards FCFA, janvier → août |
| Factures définitives | **30** |
| Règlements | **24**, 1,57 milliard FCFA versé aux artisans |
| Taxes retenues | 72 lignes, 414 millions FCFA (TVA 18 %, retenue 5 %, TDC 1 %) |

Le prix au kilogramme se déduit du cours du jour, du taux du jour et du titre du lot — de 18 à
23 carats. Les six dernières ventes attendent leur validation, six autres leur règlement : les
écrans de suivi ont ainsi quelque chose à montrer à chaque étape.

**Un défaut de données corrigé au passage (A174)** : la vente VE-OR-2025-00001 portait un prix
de 2 740 000 000 FCFA le kilogramme — trente-quatre fois le cours réel. 125 g y valaient
342 millions. Le prix est recalculé au cours de la période, ajusté du titre, et l'ancienne
valeur reste mentionnée en observation.

### Contrôles

- `npx vitest run` : **646/646 verts**
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé

---

## Itération — 20 août 2026 — Module d'achat d'or industriel

Mission : concevoir et implémenter le module complet d'achat d'or par la SONASP auprès des
sociétés minières industrielles — planification mensuelle, demandes, facturation, règlements,
dettes, balance âgée.

### Ce que l'analyse de l'existant a établi

Cinq constats ont commandé toute l'architecture :

1. **Il n'y a pas de serveur applicatif.** Le navigateur parle directement à PostgREST. « Le
   backend fait autorité » signifie donc ici : PostgreSQL. Un contrôle écrit en TypeScript
   s'obtient en ouvrant la console du navigateur ; toute la logique financière sensible est
   donc en PL/pgSQL `SECURITY DEFINER`.
2. **Un module d'achat existait déjà** (`snp_achats_mines`, 474 lignes d'écran, 42 lignes de
   données) : achat direct, sans workflow. Il n'a pas été remplacé — il devient la transaction
   commerciale issue de l'approbation, et garde son écran et ses données.
3. **`user_profiles` ne rattachait aucun utilisateur à une société minière.** Sans ce lien,
   « une mine ne voit que ses demandes » était impossible à appliquer (A176).
4. **Les politiques RLS existantes sont permissives** (`USING (true)` sur les achats). Les
   nouvelles tables portent de vraies politiques.
5. **L'audit applicatif est écrit par le client**, donc contournable. Le module tient son
   propre journal, alimenté par déclencheur.

### La décision qui structure le module

Un règlement **n'est pas** une transaction. La SONASP achète chaque mois et ne règle pas
nécessairement chaque mois : elle verse un acompte, laisse courir plusieurs factures, puis
verse une somme qui ne correspond au montant d'aucune facture prise isolément.

D'où la chaîne :

```
transaction → facture → échéance
                  ↑
     affectation ─┘
          ↑
     règlement (appartient à la SOCIÉTÉ, pas à une facture)
```

Le solde d'une facture n'est jamais saisi : il est recalculé depuis ses affectations et ses
avoirs par déclencheur. Deux garde-fous sous verrou interdisent d'affecter au-delà du solde
d'un règlement ou au-delà du reste dû d'une facture.

### Défauts trouvés et corrigés en cours de route

- **Assiette d'éligibilité incohérente** : la première rédaction retenait la production
  *validée* comme base, tout en déduisant des engagements calculés sur la production
  *déclarée*. L'éligible ressortait à zéro partout — Essakane affichait 3 862 oz validées
  contre 4 889 oz engagées. Règle retenue et documentée : **éligible = déclarée non annulée
  − déjà engagé** (A177).
- **Ambiguïté de nommage** : le paramètre de sortie `demande_id` entrait en conflit avec
  `snp_achats_mines.demande_id` ; PL/pgSQL refusait la requête d'idempotence et toute
  approbation échouait. Les sorties sont préfixées `r_` (A178).
- **Comptage faux** : `INSERT ... ON CONFLICT DO UPDATE` laisse toujours `FOUND` à vrai ;
  toute ligne était comptée « mise à jour », jamais « créée ».

### Certification DGI — limitation réelle, non contournée

La note n°2025-0885/MEF/SG/DGI réserve les éléments de certification au Module de Contrôle de
Facturation, et exige l'homologation de la plateforme comme système de facturation
d'entreprise. Ni l'appareil ni l'ISF ne sont disponibles ici.

Le service `certificationDgiService` **ne certifie donc rien**. Il compose la requête, la
soumet au point d'accès configuré, journalise chaque tentative et son empreinte, et inscrit un
échec motivé faute de raccordement. Une contrainte de base
(`snp_facture_certification_prouvee`) interdit qu'une facture se dise certifiée sans porter la
référence et la date renvoyées par le service : **même une erreur de programmation ne pourrait
pas produire une fausse certification**.

Reste à configurer : `VITE_DGI_SECEF_URL`, `VITE_DGI_SECEF_NIM`, `VITE_DGI_SECEF_ISF`.

### Recette

Les seize scénarios d'acceptation ont été exécutés en base, puis les données d'essai
supprimées. Treize sont passés du premier coup ; les trois « échecs » venaient d'attentes
fausses de ma part — les règlements avaient soldé la facture, donc reste dû nul et balance âgée
vide étaient les résultats **corrects**. Vérifiés à nouveau sur une société non réglée : dette
de 1 970 370 584 FCFA, tranche « non échu », trop-perçu de 156 566 000 FCFA conservé.

**Isolation éprouvée** : un représentant d'Essakane voit 1 demande sur 12, 1 facture, **0 plan**
et **0 ligne d'audit**. Ses quatre tentatives d'intrusion — répondre pour une autre mine,
enregistrer un règlement, créer un plan national, modifier une facture — ont toutes été
refusées par la base.

### Contrôles

- `npx vitest run` : **702/702 verts** (+56 : calculs, service, certification)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé — aucune erreur ajoutée
- Console du navigateur au démarrage : aucune erreur

---

## Itération — 20 août 2026 — Le paiement devient un ordre de virement

Le module d'achat existait ; son formulaire de paiement, non. Six champs alignés dans un tiroir
latéral pour un virement de plusieurs milliards de francs CFA.

### Le défaut comptable, trouvé avant de dessiner

En relisant le code de règlement, un défaut de fond est apparu : **`snp_facture_paye` comptait
toute affectation active, quel que soit l'état du règlement**. Un simple brouillon soldait donc
une facture — la balance âgée s'allégeait, le relevé montrait une dette éteinte, alors que la
banque n'avait rien exécuté (A179).

D'où la distinction posée en base :

| Notion | Ce qu'elle compte | À quoi elle sert |
|---|---|---|
| **engagé** | affectations d'un règlement non rejeté ni annulé | plafonne toute nouvelle imputation |
| **payé** | affectations d'un règlement **exécuté** ou **rapproché** | éteint la dette, alimente la balance âgée |

Un brouillon **retient** donc une facture sans l'éteindre. Sans ce plafond sur l'engagé, deux
paiements en préparation pourraient chacun couvrir la même facture en entier et la solder deux
fois à l'exécution.

### Le cycle, qui n'existait pas

Quatre états confondaient la validation interne, l'émission de l'ordre, l'exécution par la
banque et le rapprochement (A180). Le cycle en compte huit :

```
brouillon -> soumis -> valide -> en execution -> execute -> rapproche
                    -> rejete / annule
```

Trois règles s'y attachent : **on ne valide pas son propre ordre** ; **on ne déclare pas une
exécution sans pièce bancaire** ; **un ordre exécuté ne se réimpute ni ne s'annule** — il se
contrepasse.

### Le formulaire

Il reprend l'habillage du formulaire de création d'un site artisanal — sections, grille, volet
droit, barre d'actions collante — **par import de sa feuille de style**, non par recopie : la
dupliquer ferait diverger les deux écrans à la première retouche.

Deux étapes : imputation, puis vérification. L'écran de vérification affiche le montant en
chiffres **et en toutes lettres** — la protection usuelle contre le chiffre mal lu sur un ordre
de virement. Écrire ces lettres a d'ailleurs révélé un bogue de ma propre conversion :
« soixante-onze » au lieu de « soixante-et-onze ».

Trois garanties tenues par l'écran :
- seules les sociétés portant une dette exigible sont proposées — Sanbrado, soldé, n'apparaît
  pas ;
- le compte bénéficiaire vient de la fiche de la société, sans aucun moyen de le contourner ;
  sans compte actif, la préparation est bloquée et l'écran renvoie à la fiche ;
- consulter une facture n'efface pas la saisie : la fenêtre ne remonte jamais dans l'état du
  formulaire.

### Un défaut de sécurité trouvé en recette

La séparation des fonctions comptait les validateurs dans `user_profiles`. Or **deux des trois
profils n'ont aucun compte `auth.users`** : actifs à l'écran, personne ne peut s'y connecter. La
règle croyait à trois validateurs là où il n'y en a qu'un, et bloquait le seul administrateur
réel (A181). Le décompte joint désormais `auth.users`.

### Recette

Seize contrôles exécutés en base, tous verts : éligibilité, société soldée écartée, compte
d'une autre société refusé, référence interne en doublon, saut d'étape refusé, exécution sans
preuve refusée, dette qui ne baisse qu'à l'exécution, réimputation et annulation refusées après
exécution. Les données d'essai ont été supprimées ; le jeu de démonstration reste.

### Contrôles

- `npx vitest run` : **728/728 verts** (+26 : formatage, montant en lettres, pièces, contrat)
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé
- Console du navigateur : aucune erreur

---

## Itération — 20 août 2026 — Raffinage des écrans de règlement

Retour d'usage : le bouton « Imputer » ne faisait rien, les fenêtres s'ouvraient sur le côté,
les tuiles étaient plates, la facture consultée n'était qu'un tableau de chiffres, et les
formulaires expliquaient leurs propres règles champ par champ.

### Le bouton qui ne faisait rien

`snp_affecter_fifo` n'acceptait qu'un règlement en brouillon ou soumis. L'acompte
REG-DEMO-0002, **validé** et non imputé, ne pouvait donc pas l'être : l'écran proposait
« Imputer sur les plus anciennes », la base répondait 400, rien ne se passait (A182).

Ma règle était mal placée. Ce qui se fige à l'exécution, c'est la répartition d'un ordre **déjà
parti à la banque** — la corriger supposerait de la rappeler. Tant que le virement n'est pas
exécuté, son imputation reste un arbitrage comptable interne. Sont donc imputables : brouillon,
soumis, validé, en exécution.

Trois messages d'échec silencieux sont devenus explicites : règlement déjà imputé, imputation
arrêtée, aucune facture ouverte.

### Les tiroirs latéraux disparaissent

Un panneau de 380 px convient à trois filtres. Il ne convient pas à l'imputation d'un virement,
qui demande de lire un tableau de factures, des soldes et un historique. Les quatre tiroirs des
écrans d'achat deviennent des **fenêtres centrées** de 880 px, avec en-tête, corps défilant et
pied d'actions.

### La facture prend sa forme comptable

La fenêtre de consultation affichait deux tableaux de chiffres. Elle affiche désormais la
facture dans **la forme exacte de la facture de vente artisanale** — en-tête émetteur,
destinataire, lignes, récapitulatif de taxation, totaux, montant en toutes lettres, bloc de
certification, impression — par réutilisation de `facture-vente.css`.

**Sur la certification : la demande ne peut pas être satisfaite aujourd'hui.** La note
n°2025-0885/MEF/SG/DGI réserve les éléments de certification au Module de Contrôle de
Facturation, que la plateforme n'interroge pas. Exiger une facture certifiée avant tout
règlement bloquerait donc **tous** les paiements. La facture affiche son état réel — « en
attente de certification » — et le composant bascule seul en présentation certifiée le jour où
le service renverra une référence.

### Une règle de rédaction

Les formulaires portaient des mentions du carnet de développement : « Le montant s'écrit en
francs entiers », « Une référence ne se réutilise pas : c'est la protection contre le double
ordre », « Seul mode admis pour les mines ». Un formulaire **applique** ses règles, il ne les
récite pas. Six mentions retirées ; la règle vaut pour les écrans à venir (A183).

### Raffinement visuel

Tuiles de bénéficiaire : fond en dégradé très pâle, liseré haut qui se révèle au survol, carte
soulevée de deux pixels, ombre portée. La carte retenue se marque d'un liseré plein plutôt que
d'un aplat. Une société sans compte bancaire ne se soulève pas et son liseré vire à l'alerte.
Synthèses et coordonnées passent en fonds translucides.

### Contrôles

- `npx vitest run` : **728/728 verts**
- `npm run build` : **vert**
- `npx tsc --noEmit -p tsconfig.app.json` : **132**, inchangé
- Console du navigateur : aucune erreur
