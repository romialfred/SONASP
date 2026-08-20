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
