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
