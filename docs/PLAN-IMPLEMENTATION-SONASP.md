# Plan d'Implémentation Priorisé — Plateforme SONASP

**Objet** : feuille de route d'implémentation de **l'ensemble des recommandations** du rapport d'audit ([AUDIT-SONASP-RAPPORT-ET-RECOMMANDATIONS.md](AUDIT-SONASP-RAPPORT-ET-RECOMMANDATIONS.md)).
**Nature** : amélioration d'une plateforme mature (pas de réécriture). Refonte **visuelle** différée (maquettes à venir).
**Périmètre** : 121 constats → 9 sprints, du prérequis sécurité à la conformité.
**Principe** : *sécuriser → figer par des tests → refactorer → livrer prouvé*. Chaque lot est testé, validé et démontré fonctionnel avant de passer au suivant.
**Date** : 2026-08-08.

---

## 1. Principes directeurs (non négociables)

1. **Test-first sur le critique** : aucun refactor d'un calcul financier ou d'une machine d'états sans test « golden » qui fige le comportement attendu au préalable.
2. **Petits lots vérifiables** : 1 recommandation ≈ 1 branche ≈ 1 preuve. Pas de gros commits fourre-tout.
3. **Preuve de fonctionnement** systématique : chaque lot se clôt par une démonstration (test vert + scénario métier rejoué sur la plateforme, capture à l'appui).
4. **Non-régression outillée** : `npm run typecheck && npm run lint && npm run test` verts + parcours métier clés rejoués à chaque fin de sprint.
5. **Base d'abord versionnée** : capturer le schéma réel avant toute migration ; migrations **idempotentes et non destructives** uniquement.
6. **Réversibilité** : chaque changement de base a un script de rollback ; sauvegarde avant chaque migration.
7. **Séparation des responsabilités** : les décisions métier/juridiques (taux fiscaux, souveraineté des données, modèle retenu) sont tracées et validées avant implémentation.

---

## 2. Vue d'ensemble & séquencement

```
Sprint 0  Socle qualité & filet de sécurité        [prérequis technique]
   │
Sprint 1  Sécurité d'urgence (Vague 0)             ██ BLOQUANT MISE EN SERVICE
   │
Sprint 2  Intégrité financière (Vague 1a)          ██ (dépend du filet de tests S0)
   │
Sprint 3  Fondations données: enums & migrations   ██ (dépend baseline S0)
   │            (Vague 1b)
   ├────────────┐
Sprint 4  Module Orpailleurs (Vague 2)             ██ CAPITAL  (dépend S2 calculs, S3 schéma)
   │            │
Sprint 5  Workflow unifié & réception (Vague 3a)   (dépend S3 enums)
   │
Sprint 6  Modules manquants: paiement mines,       (dépend S5)
   │       réconciliation, approbations (Vague 3b)
   │
Sprint 7  Qualité, i18n, a11y, tests, nettoyage    (transverse, parallélisable dès S2)
   │       (Vague 4)
   │
Sprint 8  Conformité réglementaire (Vague 5)       [continu, cadencé avec juriste]
```

**Chemin critique** : S0 → S1 → S2 → S3 → S4. Les sprints 5-6 suivent S3. Le sprint 7 (qualité/i18n) est **parallélisable** dès la fin de S2 par une seconde personne. Le sprint 8 (conformité) démarre en fond dès que le juriste est disponible.

**Estimation globale** : ~40-55 j-personne pour S0→S6 (cœur bloquant), +7-10 j pour S7, +conformité continue (S8). Avec 2-3 personnes en parallèle : **~8-10 semaines** jusqu'à une plateforme exploitable, la conformité se poursuivant ensuite.

---

## 3. Détail des sprints

Légende effort : **S** ≤1 j · **M** 1-3 j · **L** 3-5 j · **XL** >5 j. Chaque lot (WP) liste les constats d'audit qu'il **clôt**.

### Sprint 0 — Socle qualité & filet de sécurité *(prérequis, ~3-4 j)*

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S0.1 | Installer la mesure de couverture + seuils | Q8 | `package.json`, `vitest.config.ts` | `npm run test:coverage` s'exécute, seuils affichés | S |
| S0.2 | Infra de test partagée : factory mock Supabase, `renderWithProviders` (Router+i18n), rendre `supabase.ts` testable (init paresseuse, pas de throw au load) | Q5, Q6, Q10 | `src/test/`, `src/lib/supabase.ts`, `businessRulesService.ts` (resetCache) | Un service peut être testé sans DB réelle | M |
| S0.3 | Capturer le **baseline du schéma réel** en migration `0000_baseline` (tables cœur non versionnées : sales, customers, payments, mining_companies, gold_inventory, refineries, transport_companies, batches-absente) | D6, P-C10 | `supabase/migrations/0000_baseline.sql` (généré par dump) | Base reconstructible depuis les migrations | M |
| S0.4 | Suppression **code mort zéro-risque** : ~15 pages non routées (~7 600 lignes) + `Sidebar.tsx` mort + `InfoPanelExamples` | F7, UX-05, UX-06 | voir liste §Annexe A | `typecheck`+`lint`+`build` verts, aucune route cassée | S |
| S0.5 | Mettre en place les **gates CI** (typecheck+lint+test au commit/PR) | Q8, F11 | CI config | PR bloquée si rouge | S |

> *Sortie de sprint* : filet de sécurité opérationnel, base versionnée, ~7 600 lignes mortes retirées. Rien de fonctionnel n'a changé pour l'utilisateur.

### Sprint 1 — Sécurité d'urgence (Vague 0) *(~4-6 j)* ██ BLOQUANT

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S1.1 | Supprimer la fonction backdoor + s'assurer que `exec_sql` n'est pas (re)déployée | V1 | `supabase/functions/fix-rls-and-grant-access/` | Fonction absente ; test : appel anonyme → 404 | S |
| S1.2 | **Rotation clé `service_role`** (action client) + retrait de `.env` frontend et des scripts ; cantonnement serveur | V10, F16, CF13 | `.env`, `scripts/*.js` | Grep : aucune `service_role` hors edge functions | S |
| S1.3 | Trigger `BEFORE UPDATE` sur `user_profiles` interdisant la modif de `role`/`site_ids` hors `service_role` (colonne `role` non protégée aujourd'hui) | V3 | migration + `user_profiles` | Test : user tente `update role='management'` → refusé | S |
| S1.4 | Rôle de repli **minimal** (jamais `management`) ; bloquer l'UI si profil réel non chargé ; supprimer `createUserDirect` | V4, V6 | `AuthContext.tsx`, `userManagementService.ts` | Test : profil manquant → accès minimal, pas management | M |
| S1.5 | Désactiver l'inscription publique Supabase (action client) ; création via `create-user` uniquement | V6 | console Supabase, `create-user` | Test : signup public → refusé | S |
| S1.6 | Authentifier `scheduled-tasks` (secret d'en-tête, comparaison constante) ; restreindre le **CORS** aux origines SONASP sur toutes les edge functions | V8, V11 | `supabase/functions/*/index.ts` | Test : appel sans secret → 401 ; CORS limité | M |
| S1.7 | Cesser de renvoyer les secrets (mot de passe temp, secret TOTP, backup codes) dans les réponses API et `validate_activation_token` | V7, V14 | `create-user`, `reset-user-password`, `ActivateAccount.tsx` | Inspection réponses : aucun secret | M |
| S1.8 | Secrets via CSPRNG (`crypto.getRandomValues`) ; retirer `error.stack` des réponses ; neutraliser `send-email` stub | V12, V15, V16 | edge functions | Revue code + test | S |

> *Note de fond (hors quick-win, planifié S1bis si besoin)* : la **réécriture complète des RLS** (V2) et le **vrai MFA** (V5) sont traités respectivement en S3.4 et S1.9 ci-dessous.

| S1.9 | **MFA réel** : brancher le MFA natif Supabase (`auth.mfa`) ou TOTP serveur ; imposer le challenge au login ; retirer le 2FA factice | V5, V13, V17 | `Login.tsx`, `AuthContext.tsx`, `ActivateAccount.tsx`, `TwoFactorVerify/Setup.tsx` | Test e2e : login exige un vrai code TOTP ; code invalide refusé | L |

> *Sortie de sprint* : portes critiques fermées. Validation : matrice d'accès par rôle rejouée (un `factory` ne lit plus les données d'un autre site après S3.4 ; l'auto-élévation est bloquée dès S1.3).

### Sprint 2 — Intégrité financière (Vague 1a) *(~5-7 j)* ██

**Pré-requis : écrire les tests AVANT de toucher au calcul.**

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S2.0 | **Tests golden** figeant les calculs actuels (proceeds, royalties, conversions, FX) + cas de référence validés métier | Q(P0), F15 | `src/utils/*.test.ts`, `services/*.test.ts` | Suite verte décrivant le comportement attendu | M |
| S2.1 | **Constante once unique** `TROY_OZ_GRAMS = 31.1034768` ; supprimer tous les `31.1035`/`28.3495` ; corriger `business_rules.grams_to_ounces` (imprécis) | F1, F2, Q2, D23 | `utils/weightConversion.ts`, `utils/salesUtils.ts`, `components/**`, `business_rules` | Test conversion g↔oz aller-retour ; 1 seule constante (grep) | M |
| S2.2 | **Royalties : source unique** (lire `business_rules.gold_royalty_percentage=3.0`) + **assiette unifiée** documentée ; corriger la facture (`net_proceeds`) et le dashboard (`total_amount`) | F3, F4, Q3, Q4, CF05 | `salesService.ts`, `preSalesService.ts`, `invoiceGenerationService.ts`, `salesUtils.ts`, `GlobalDashboardEnhanced.tsx` | Test : même vente → royalty identique partout (vente/facture/dashboard/rapport) | M |
| S2.3 | **Fusionner les 3 logiques** de calcul de vente en une fonction pure paramétrée | F5 | `utils/salesUtils.ts`, `salesService.ts`, `preSalesService.ts` | Tests couvrant les 3 anciens chemins → 1 fonction | M |
| S2.4 | **Politique d'arrondi unique** (demi-pair) ; retirer `Math.ceil` sur montants ; envisager type décimal monnaie | F6 | `utils/numberUtils.ts`, services concernés | Test d'arrondi ; cohérence des montants stockés | M |
| S2.5 | Généraliser la **validation zod** aux entités financières critiques (paiements, ventes, cartes) | Q7, F9 | `src/lib/schemas/`, formulaires | Tests de schéma ; rejet des entrées invalides | M |

> *Sortie de sprint* : un seul calcul, une seule vérité par montant. Preuve : rejouer une vente réelle et comparer vente↔facture↔dashboard (montants identiques).

### Sprint 3 — Fondations données : enums, migrations, RLS (Vague 1b) *(~6-8 j)* ██

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S3.1 | **Vocabulaire de statut unique** : 1 fichier de constantes aligné sur les enums déployés ; corriger `'shipped'` (absent de `production_status_v2`) et les fautes `waiting_customs_approval`→`waiting_for_customs_approval`, `customs_approved`→`approved_by_customs` | D1, P-C3, P-C5, F13 | `src/constants/*Statuses.ts`, `dailyProductionService.ts`, `unifiedStatusService.ts` | Test matrice transitions ; aucune écriture de statut hors enum | L |
| S3.2 | **Consolider les migrations** : supprimer doublons (`006` vs `006_FIXED`, `CRITICAL` vs `CRITICAL_CLEAN`, `26122025_01`×2, `IMPLEMENT` non-FIXED) ; squash de la chaîne shipping ; **rendre non destructif** (plus de DROP/DELETE, `ALTER TYPE ADD VALUE`) | D2, D3, D17, P-C11, D24 | `supabase/migrations/`, `scripts/*.sql` | Migrations rejouables sans perte ; base reconstruite = base actuelle | L |
| S3.3 | **Nettoyer la base** : supprimer tables débris (`shipping_preparations_backup_*`, `v_inserted`), colonnes `status_old_backup` ; ajouter PK manquantes | D22, P-C11, (advisor 3 no-PK) | migration | Advisor « no_primary_key » = 0 ; tables backup absentes | S |
| S3.4 | **Réécriture des RLS** par rôle/site (remplacer les 185 `USING(true)` / 107 `WITH CHECK(true)` / 40 DELETE ouverts) via fonctions `SECURITY DEFINER` non récursives ; DELETE réservé management | V2, D11, C08, CF08 | toutes migrations RLS | Test d'isolation : `factory` site A ne lit/écrit pas site B ; advisor RLS | XL |
| S3.5 | **Intégrité référentielle** : FK traçabilité en `ON DELETE RESTRICT` ; `CHECK ≥ 0` sur montants/poids/taxes ; contraintes d'identité artisan ; `mining_company_id` NOT NULL | D7, D12, D16, D21, CF09 | migrations | Tests d'insertion invalide → rejet | M |
| S3.6 | **Index** : ajouter les 80 FK non indexées + index composites hot-paths ; retirer index dupliqués/inutiles ; corriger `auth_rls_initplan` (wrap `select auth.uid()`) | D18, D19, D20 (advisor perf) | migrations | Advisor perf : FK non indexées ↓, duplicate_index=0 | M |
| S3.7 | **Durcir les fonctions** : `SET search_path` sur les 183 fonctions ; restreindre l'exécution des 87 `SECURITY DEFINER` exposées à `anon` | (advisor sécurité) | migrations fonctions | Advisor sécurité : `function_search_path_mutable` ↓ | M |
| S3.8 | **Réintégrer les scripts SQL manuels** dans le système de migrations horodaté | D24 | `scripts/*.sql` → `supabase/migrations/` | Plus de SQL hors migration | S |

> *Sortie de sprint* : schéma cohérent, RLS réelle, base rejouable. Preuve : tests d'isolation d'accès + advisors Supabase re-exécutés (baisse mesurable des alertes).

### Sprint 4 — Module Orpailleurs (Vague 2) *(~5-7 j)* ██ CAPITAL

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S4.1 | **QR code réel** via lib `qrcode` (déjà installée) encodant une URL de vérification signée ; regénérer pour les 3 cartes sans `qr_code_data` | C-01, Q1 | `carteProfessionnelleGeneratorService.ts` | Test : QR décodable ; **preuve = scanner physiquement un QR généré** | M |
| S4.2 | **Page publique de vérification** `/verifier/:numero` (statut, expiration, validité, sans données sensibles) | C-02 | nouvelle page + route, `snp_cartes_professionnelles` | Test e2e : scan → page affiche validité correcte | M |
| S4.3 | **Réparer tous les rapports** : préfixer les tables en `snp_` ; corriger `prenoms`, `montant_brut_fcfa`, `quantite_onces` | C-03, C-12, C-13, C-14 | `artisanAnalyticsService.ts`, `Rapport*.tsx` | Rapports CA/Quantités/Taxes affichent des données réelles | M |
| S4.4 | **Sécurité carte** : `numero_securite` cryptographique vérifié ; aligner `date_emission` (code lit `date_delivrance`) ; `UNIQUE(numero_carte/numero_recu)` ; séquence PG | C-06, C-09, C-10 | `carteProfessionnelleService.ts`, migrations | Test : numéros uniques ; secnum vérifiable | M |
| S4.5 | **Modèle fiscal artisan unifié** (retenue à la source vs TVA ajoutée) — un seul calcul paramétrable ; corriger `royalties=taxes×3%` (incohérent) | C-04, C-11, C-15, C-16, CF06 | `artisanGoldSalesService.ts`, triggers SQL, `20251228_003` | Test : vente↔facture↔paiement cohérents ; **taux validés métier** | L |
| S4.6 | **Garde-fous & cycle de vie** : bloquer paiement sans facture définitive ; brancher `validateActifPourVente` (carte valide + infractions) avant vente ; validation → génération carte automatique ; automatiser l'expiration ; corriger le renouvellement (numéro unique) | C-05, C-07, cycle de vie | `artisanGoldSalesService.ts`, `artisanPaiementsService.ts`, `CarteValidation.tsx`, tâche planifiée | Tests : vente refusée si carte invalide ; expiration auto | L |
| S4.7 | **Confidentialité** : bucket `cartes-professionnelles` en URL signées (pas public) | C (vie privée), CF07 | config Storage, service | Accès direct sans signature → refusé | S |

> *Sortie de sprint* : le module capital est fiable et vérifiable sur le terrain. Preuve reine : **générer une carte → scanner son QR → la page de vérification confirme la validité**.

### Sprint 5 — Workflow unifié & réception (Vague 3a) *(~6-8 j)*

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S5.1 | **Trancher le modèle unique** (modèle réel `freight_shipments`) ; **purger `batches`** (absent en base) ; neutraliser/reconstruire `ReceivingConfirm` cassé | P-C1, P-C2, P-C4, C1, C2 | `ReceivingConfirm.tsx`, `RefineryReceivingConfirm.tsx`, services statut morts | `ReceivingConfirm` ne plante plus ; aucun accès à `batches` | L |
| S5.2 | **Un seul moteur de statut** : finaliser `unified` et retirer les parallèles morts ; convertir les gardes en **triggers `BEFORE UPDATE`** (non contournables) | P-C4, P-C5, F13, CF09 | `unifiedStatusService.ts`, `statusTransitionControlService.ts` | Test : transition illégale par accès direct → refusée | L |
| S5.3 | **Audit trail consolidé** sur `unified_status_history` + triggers ; écriture **côté serveur** ; capture IP réelle ; append-only | P-C9, V9, CF01 | triggers, `auditLog.ts` | Test : insertion d'audit falsifié par client → refusée | M |
| S5.4 | **Réception fonctionnelle** branchée au modèle réel (ou retrait du rôle `airport` si la douane le remplace) ; câbler les dashboards Factory/Airport aux données réelles | P-C1, P-C12 | `receiving/*`, `dashboards/*` | Parcours réception rejoué de bout en bout | M |
| S5.5 | **Approbation vente unifiée** : un seul moteur ; email d'approbation **sécurisé** (token signé, validation serveur) | P-C6, P-C13 | `approvalService.ts`, `salesApprovalService.ts`, `notificationService.ts` | Test : lien d'approbation avec token falsifié → refusé | M |

### Sprint 6 — Modules manquants (Vague 3b) *(~6-9 j)*

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S6.1 | **Module « Paiement des productions aux mines »** (mandat SONASP) : enregistrement du dû, ordre de paiement, preuve, approbation, lien production↔paiement, multi-mines | P-C7 | nouvelles tables + service + pages | Parcours : production enregistrée → payée → tracée | XL |
| S6.2 | **Réconciliation d'écarts** côté serveur réellement branchée (seuils `business_rules` : mine-airport 0.8%, airport-refinery 0.5%, refining 2.5%) : persistance écart, approbation superviseur, blocage | P-C8 | `receivingValidationService.ts`, `variance_*` tables | Test : écart > seuil → investigation requise | L |
| S6.3 | **Reporting consolidé pays** (toutes mines) pour le management | multi-mines | analytics/reports | Rapport national multi-mines correct | M |
| S6.4 | **Notifications in-app temps réel** des transitions (Supabase Realtime) | P-C (notifications) | `notificationService.ts`, UI cloche | Notification reçue à un changement de statut | M |

### Sprint 7 — Qualité, i18n, a11y, tests (Vague 4) *(~7-10 j, parallélisable dès S2)*

| WP | Objectif | Constats | Fichiers clés | Preuve / Validation | Effort |
|----|----------|----------|---------------|---------------------|--------|
| S7.1 | **Centraliser l'accès données** dans les services + règle ESLint interdisant `@/lib/supabase` hors `services/**` (87 accès directs) | F8 | lint config, pages/components | Lint bloque les `.from()` directs | L |
| S7.2 | **i18n réel** : externaliser les 310+ chaînes FR en dur ; namespaces métier (artisan/freight/shipping/sales/admin) ; traduire le système de dialogue ; corriger marque « Mansa Resources »→SONASP | UX-01, UX-10, i18n | `src/i18n/`, composants | Bascule EN → écrans métier traduits | XL |
| S7.3 | **Feedback unifié** : router les 43 `alert()/confirm()` natifs vers Toast/Dialog ; consolider les 12 composants de feedback en 2 primitives | UX-02, UX-03 | `ui/`, `DialogContext.tsx` | Aucun `alert/confirm` natif (grep) | L |
| S7.4 | **Accessibilité** : labels associés (`FormField`), focus-trap + `aria-labelledby` sur modales ; grilles responsives | UX-07, UX-08, UX-11 | `Input.tsx`, `Modal.tsx`, formulaires | Audit a11y automatisé passe | L |
| S7.5 | **Navigation par rôle** (filtrer les 11 groupes/40 liens) | UX-04 | `AccordionSidebar.tsx` | Un rôle ne voit que ses modules | M |
| S7.6 | **Réduire `any`** (698) via types Supabase générés ; étendre `strictTypeChecked` ; typer les erreurs | F10, F11 | services, `eslint.config.js` | `any` en forte baisse ; strict étendu | L |
| S7.7 | **Tests métier** : étendre la couverture (transitions, permissions, paiements, PDF, e2e ventes) ; **logger** conditionné à `DEV` (retirer 970 `console.*`) ; **code-splitting** `React.lazy` | Q9, F14, F12, F15 | tests, `App.tsx` | Couverture ↑ ; bundle initial ↓ | L |

### Sprint 8 — Conformité réglementaire (Vague 5) *(continu, avec juriste)*

| WP | Objectif | Constats | Preuve / Validation | Effort |
|----|----------|----------|---------------------|--------|
| S8.1 | **Audit inviolable** : tables versionnées, append-only, **hash-chaining/signature**, interdiction hard-delete des certificats/historique | CF01, CF02 | Test : modification/suppression d'un maillon détectée | L |
| S8.2 | **Dispositif LBC/FT + KYC acheteurs** : identité, bénéficiaire effectif, screening PEP/sanctions, workflow déclaration CENTIF | CF03 | Parcours KYC bloquant à l'entrée en relation | XL |
| S8.3 | **Suivi rapatriement devises & reporting change** UEMOA/BCEAO (domiciliation, montants attendus vs rapatriés) | CF04 | États de rapatriement produits | L |
| S8.4 | **Barème redevance progressif** indexé sur le cours + assiette verrouillée (validation fiscaliste) | CF05, CF06 | Test : redevance correcte par palier de cours | M |
| S8.5 | **Souveraineté des données** : évaluation hébergement/localisation, formalités protection des données, DPO | CF07 | Dossier de conformité données | M |
| S8.6 | **États réglementaires** Mines/Douanes/ANEEMAS + **diligence OCDE/LBMA** + politique de **rétention/archivage** | CF11, CF12 | États normalisés + registre diligence | L |

---

## 4. Décisions requises AVANT certains lots (à tracer)

| Décision | Bloque | Qui décide |
|----------|--------|------------|
| Modèle fiscal artisan retenu (retenue à la source vs TVA ajoutée) + taux exacts (TVA, retenue, redevance) | S4.5, S8.4 | Métier + fiscaliste BF |
| Barème progressif de redevance or (paliers/taux) et assiette (déductions admises) | S2.2, S8.4 | Juriste minier BF |
| Conservation ou retrait du rôle/parcours « Airport » (remplacé par douane ?) | S5.4 | Métier SONASP |
| Hébergement souverain vs Supabase cloud | S8.5 | Direction SONASP |
| Rotation de la clé `service_role` et désactivation du signup public (accès console) | S1.2, S1.5 | Admin Supabase |

---

## 5. Gouvernance & Definition of Done

**Definition of Done d'un lot (WP)** :
1. Code + test(s) automatisé(s) vert(s) prouvant le comportement.
2. `typecheck` + `lint` + `test` verts.
3. Scénario métier rejoué sur la plateforme lancée, **preuve capturée**.
4. Aucune régression sur les parcours clés (checklist).
5. Revue par un pair de l'équipe (domaine concerné).
6. Migration réversible (script rollback) le cas échéant.

**Gates de fin de sprint** : advisors Supabase re-exécutés (sécurité/perf) après S1/S3 ; parcours e2e complet (production→expédition→raffinage→vente→paiement + cycle orpailleur) rejoué après S5/S6.

---

## 6. Matrice de couverture (traçabilité — chaque constat a un lot)

| Domaine | Constats | Lots |
|---------|----------|------|
| Sécurité | V1-V17 | S1.1-S1.9, S3.4, S3.7 |
| Base de données | D1-D24 | S0.3, S2.1, S3.1-S3.8 |
| Orpailleurs | C-01…C-16 | S4.1-S4.7 |
| Full-stack/Qualité | F1-F16 | S0.4, S2.1-S2.5, S7.1-S7.7 |
| Process/Modules | P-C1…P-C13 | S3.1, S5.1-S5.5, S6.1-S6.4 |
| UI/UX | UX-01…UX-12 | S0.4, S7.2-S7.5, S7.7 |
| Conformité | CF01-CF13 | S3.4, S4.5, S4.7, S5.3, S8.1-S8.6 |
| Tests/QA | Q1-Q10 | S0.1-S0.2, S2.0, S2.5, S7.7 |

> Les 121 constats de l'audit sont couverts. Les items « refonte design » (tokens, couleurs, typographie) restent **hors périmètre** jusqu'à réception des maquettes.

---

## Annexe A — Pages mortes à supprimer (S0.4)

`UserManagement.tsx`, `UserManagementPage.tsx` (+ son test), `AnalyticsDashboard.tsx`, `AnalyticsPage.tsx`, `PaymentCreateProfessional.tsx`, `AssayCertificatesPage.tsx`, `ShippingPreparationDetails.tsx`, `ShippingPreparationComplete.tsx`, `CustomersPage.tsx`, `SalesPage.tsx`, `RefiningPage.tsx`, `ReportGeneration.tsx`, `ReportsPage.tsx`, `SettingsPage.tsx`, `admin/AuditTrail.tsx`, `Sidebar.tsx`, `InfoPanelExamples.tsx`.
*(Vérifier `git log`/blame avant suppression — aucun feature-flag ne les réactive.)*
