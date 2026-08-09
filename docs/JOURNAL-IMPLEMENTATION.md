# Journal d'Implémentation — SONASP

Suivi des lots livrés, testés et prouvés. Ordre = plan `PLAN-IMPLEMENTATION-SONASP.md`.
Statuts : ✅ livré+testé · 🔄 en cours · ⏳ à faire · ⚠️ nécessite action client/deploy.

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
