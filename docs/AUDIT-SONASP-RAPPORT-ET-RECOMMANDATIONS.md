# Rapport d'Audit & Recommandations — Plateforme SONASP

**Plateforme** : SONASP (Société Nationale des Substances Précieuses) — traçabilité de la production et de la vente de l'or, Burkina Faso.
**Stack** : React + Vite + TypeScript + Tailwind + Supabase/PostgreSQL. Conçue par Bolt (nov. 2025).
**Nature de la mission** : amélioration d'une plateforme mature (pas une réécriture). La refonte **visuelle** est différée (maquettes à venir).
**Méthode** : audit multi-experts en lecture seule (8 domaines), constats sourcés `fichier:ligne`, **complétés par une inspection en lecture seule de la base Supabase déployée** (SONASP_OPS). Aucune modification de code ni de base effectuée.
**Date** : 2026-08-08.

> ⚠️ **Avertissements**
> - Le volet **Conformité** n'est **pas un avis juridique** : taux, quotas et obligations doivent être validés par un juriste minier/fiscaliste burkinabè.
> - Les points « à vérifier » des experts ont été **levés en base live** (voir §4) ; restent quelques paramètres projet lisibles uniquement dans la console Supabase.
> - Ce document contient des informations de **sécurité sensibles** (vulnérabilités exploitables). Diffusion restreinte.

---

## 1. Verdict global

La plateforme est **fonctionnellement riche et mature** (126 pages, 64 services, workflow métier étendu, module orpailleurs complet, infrastructure FX/prix). Mais elle porte une dette lourde de « modernisation partielle » et **quatre risques structurels bloquants** pour une mise en production étatique :

| # | Risque structurel | Gravité | Domaines convergents |
|---|-------------------|---------|----------------------|
| A | **Sécurité effondrée** : backdoor d'élévation de privilèges, RLS ouverte à tous, rôle `management` par défaut, 2FA factice, clé `service_role` en clair | 🔴 CRITIQUE | Sécurité, BD, Conformité, Orpailleurs |
| B | **Intégrité financière compromise** : constante once incohérente (3 valeurs), taux/assiette de royalties divergents, 2 modèles fiscaux artisan contradictoires, arrondis non uniformes | 🔴 CRITIQUE | Full-stack, QA, Orpailleurs, BD, Conformité |
| C | **Module Orpailleurs (capital) défaillant** : QR code **factice non scannable**, aucune page de vérification, rapports cassés, carte sans réelle sécurité anti-falsification | 🔴 CRITIQUE | Orpailleurs, QA, Conformité |
| D | **Fondations données/workflow instables** : 2 modèles de données parallèles (un mort/cassé), 9+ vocabulaires de statut, migrations destructrices/dupliquées, schéma de base non versionné | 🔴 CRITIQUE | Process, BD, Full-stack |

**Conclusion** : la plateforme **ne doit pas être exploitée en production étatique en l'état**. Les vagues 0 à 3 ci-dessous sont des **prérequis de mise en service**. La bonne nouvelle : la majorité des correctifs sont ciblés (pas de réécriture), et un socle solide existe (traçabilité d'origine, numérotation atomique des lots, quotas de licences, historisation des statuts).

---

## 2. Les 10 problèmes les plus graves (arbitrage inter-experts)

Classés par risque décroissant. Chaque ligne a été **confirmée par au moins 2 experts indépendants**.

| Rang | Problème | Preuve principale | Experts |
|------|----------|-------------------|---------|
| 1 | **Edge function backdoor** sans authentification exécutant du SQL arbitraire + octroi `management` codé en dur | `supabase/functions/fix-rls-and-grant-access/index.ts:9-129` | Sécurité (V1) |
| 2 | **RLS `USING(true)`** généralisée (22/61 migrations) → tout compte lit/écrit/supprime toutes les données | `add_shipping_system.sql:176-257`, `26122025_01`, budgets | Sécurité (V2), BD (D11), Orpailleurs (C08), Conformité (CF08) |
| 3 | **Auto-élévation au rôle `management`** (repli par défaut + update de son propre rôle) | `AuthContext.tsx:194,35,419` ; policy `update_own` | Sécurité (V3, V4) |
| 4 | **QR code de la carte orpailleur factice** (`Math.random`, non scannable) + aucune vérification | `carteProfessionnelleGeneratorService.ts:9-40` | Orpailleurs (C01/C02), QA (Q1) |
| 5 | **Constante once incohérente** : `31.1035` vs `31.1034768` vs `28.3495` (avoirdupois pour de l'or !) → écarts matière ~9,7 % | `weightConversion.ts:8-9`, `salesUtils.ts:12`, `WeightInput.tsx:20` | Full-stack (F1/F2), QA (Q2) |
| 6 | **Royalties : taux dupliqué (5+) et assiette divergente** (net vs final vs total vs taxes) | `salesService.ts:47,247` ; `invoiceGenerationService.ts:414` ; `GlobalDashboardEnhanced.tsx:355` | Full-stack (F3/F4), QA (Q3/Q4), Conformité (CF05) |
| 7 | **2FA factice** (tout code 6 chiffres accepté, jamais déclenché au login) | `ActivateAccount.tsx:307-311` ; `Login.tsx:22,177` | Sécurité (V5) |
| 8 | **Deux modèles de données parallèles** : `batches` (mort/cassé) vs `freight_shipments` (réel) ; écran réception aéroport plante | `ReceivingConfirm.tsx:122,165` ; `RefiningProcess.tsx:84` | Process (P-C1/P-C2), Full-stack (F7) |
| 9 | **Chaos des ENUMs de statut** : `'shipped'` écrit mais absent de l'enum ; valeurs contradictoires ; migrations destructrices rejouables | `20251114_004:57` ; `dailyProductionService.ts:17` ; `20251114_011:95` | BD (D1/D2/D3), Process (P-C3) |
| 10 | **Audit trail non inviolable** : table non versionnée, écrite par le client, modifiable/supprimable, IP non capturée | `auditLog.ts:15,159` ; `AuthContext.tsx:240` | Sécurité (V9), Conformité (CF01/CF02) |

**Modèle manquant à fort enjeu métier** : le **paiement des productions aux mines** (« enregistrer les productions et les payer ») est **totalement absent** (Process P-C7). C'est une fonctionnalité du mandat SONASP, à concevoir (P0).

---

## 3. Plan de recommandations priorisé — par vagues

Séquencement conçu pour **maximiser la valeur en minimisant le risque de régression** : on sécurise d'abord, on fige les calculs par des tests, puis on refactore sur ce filet de sécurité.

### 🟥 Vague 0 — Sécurité d'urgence (prérequis absolu, ~3-5 j)
Objectif : fermer les portes d'entrée critiques avant tout le reste.

1. **Supprimer** la fonction `fix-rls-and-grant-access` et **révoquer la RPC `exec_sql`** (V1).
2. **Roter immédiatement** la clé `service_role` (manipulée en clair), la retirer de `.env` frontend et des scripts (V10, F16, CF13).
3. **Trigger `BEFORE UPDATE`** sur `user_profiles` interdisant la modification de `role`/`is_active`/`site_ids` hors `service_role` (V3).
4. **Rôle de repli minimal** (jamais `management`) dans `AuthContext`/`createMinimalProfile` (V4).
5. **Désactiver l'inscription publique** Supabase + supprimer `createUserDirect` (V6).
6. **Authentifier** `scheduled-tasks` (secret d'en-tête) et restreindre le **CORS** aux origines SONASP (V8, V11).
7. Cesser de **renvoyer les secrets** (mot de passe temporaire, secret TOTP, backup codes) dans les réponses API (V7).

> *Sans-régression* : ces actions retirent du code mort/dangereux ou durcissent des contrôles ; impact fonctionnel quasi nul pour l'utilisateur légitime. Validation : tests d'accès par rôle (un compte `factory` ne doit plus lire les données d'un autre site).

### 🟥 Vague 1 — Intégrité financière & fondations données (~5-8 j)
Objectif : une seule vérité pour chaque calcul et chaque statut. **On écrit les tests AVANT de refactorer.**

1. **Constante once unique** `TROY_OZ_GRAMS = 31.1034768`, supprimer tous les `31.1035`/`28.3495` (F1/F2, Q2). Tests de conversion aller-retour g↔oz.
2. **Taux et assiette de royalties centralisés** (source unique, idéalement `business_rules`), corriger l'assiette de la facture (`net_proceeds`) (F3/F4, Q3/Q4, CF05). Tests de non-régression du calcul.
3. **Fusionner les 3 logiques de calcul de vente** en une fonction paramétrée (F5).
4. **Politique d'arrondi unique** documentée (remplacer les `Math.ceil` sur montants) (F6).
5. **Unifier le vocabulaire de statut** : un seul fichier de constantes + enums DB alignés ; corriger `'shipped'`, les fautes `waiting_customs_approval`→`waiting_for_customs_approval` (D1/D2/D3, P-C3, F13).
6. **Consolider les migrations** : supprimer doublons (`006` vs `006_FIXED`, `CRITICAL` vs `CRITICAL_CLEAN`, `26122025_01` ×2, `IMPLEMENT…` non-FIXED), retirer backups committés, **capturer un baseline** des tables non versionnées (D6, D24, P-C10/P-C11).
7. **Rendre les migrations non destructives** (interdire `DROP/DELETE`, passer en `ALTER TYPE ADD VALUE`) (D3).
8. **CHECK ≥ 0** sur montants/poids/taxes ; **FK traçabilité** en `ON DELETE RESTRICT` (D7, D12, D21).

### 🟥 Vague 2 — Module Orpailleurs (capital, ~5-7 j)
1. **QR code réel** via la lib `qrcode` déjà installée, encodant une **URL de vérification signée** (C01, Q1).
2. **Page publique de vérification** `/verifier/:numero` (statut, expiration, validité) (C02).
3. **Réparer tous les rapports** : préfixer les tables en `snp_` dans `artisanAnalyticsService` (C03).
4. **Sécurité anti-falsification** : `numero_securite` cryptographique, rempli à la création, vérifié (C06).
5. **Unifier le modèle fiscal artisan** (retenue à la source vs TVA ajoutée) — un seul calcul paramétrable (C04/C15, CF06).
6. **Bloquer le paiement sans facture définitive** (supprimer le fallback surpayant) (C05).
7. **Garde-fous vente** : vérifier carte valide + infractions avant création de vente (brancher `validateActifPourVente`) (C07).
8. **Fiabiliser le cycle de vie** : validation → génération carte automatique, automatiser l'expiration, corriger le renouvellement (numéro unique), `UNIQUE(numero_carte/numero_recu)` (C09/C10, trous cycle de vie).
9. Durcir la **RLS** du module par rôle (C08).

### 🟧 Vague 3 — Workflow unifié & modules manquants (~10-15 j)
1. **Trancher pour un modèle de données unique** (le modèle réel `freight_shipments`), **purger le modèle `batches` mort** et neutraliser `ReceivingConfirm` cassé (P-C1/P-C2/P-C4).
2. **Concevoir le module « Paiement des productions aux mines »** (P-C7, P0 métier) : dû, ordre de paiement, preuve, approbation, lien production↔paiement.
3. **Implémenter la réconciliation d'écarts** côté serveur (variance/seuil) réellement branchée (P-C8).
4. **Un seul moteur d'approbation de vente** + email d'approbation sécurisé (token signé, validation serveur) (P-C6/P-C13).
5. **Consolider l'audit trail** sur `unified_status_history` + triggers cohérents, écriture côté serveur (P-C9, V9).
6. **Câbler les dashboards** Factory/Airport aux données réelles (ou retirer le rôle Airport si le flux douane le remplace) (P-C12).

### 🟨 Vague 4 — Qualité, nettoyage, tests, i18n (~7-10 j)
1. **Supprimer ~15 pages mortes (~7 600 lignes)** et le sidebar mort ; garder une seule variante par écran (F7, UX-05/UX-06).
2. **Centraliser l'accès données** dans les services + règle ESLint interdisant `@/lib/supabase` hors `services/**` (F8).
3. **Réduire les `any`** (698 occ.) via types Supabase générés ; étendre `strictTypeChecked` (F10/F11).
4. **i18n réel** : externaliser les 310+ chaînes FR en dur, namespaces métier (artisan/freight/shipping/sales/admin), traduire le système de dialogue (UX-01, i18n).
5. **Feedback unifié** : router `alert()/confirm()` natifs (43 occ.) vers Toast/Dialog ; consolider les 12 composants de feedback en 2 primitives (UX-02/UX-03).
6. **Accessibilité** : labels associés, focus-trap + `aria-labelledby` sur les modales (UX-07/UX-08).
7. **Filtrer la navigation par rôle** (UX-04).
8. **Socle de tests** : installer `@vitest/coverage-v8`, factory de mock Supabase, tests P0 (calculs, conversions, QR, transitions, permissions) (Q5-Q10, F15).
9. **Nettoyer les `console.*`** (~970) via un logger conditionné à `DEV` (F14, UX-12).
10. **Code-splitting** via `React.lazy` sur les routes (F12).

### 🟦 Vague 5 — Conformité réglementaire (à cadencer avec le juriste, ~continu)
1. **Audit inviolable** : tables versionnées, append-only, hash-chaining/signature, interdiction hard-delete (CF01/CF02).
2. **Dispositif LBC/FT + KYC acheteurs** : identité, bénéficiaire effectif, screening PEP/sanctions, déclaration CENTIF (CF03).
3. **Suivi rapatriement des devises** & reporting change UEMOA/BCEAO (CF04).
4. **Barème de redevance progressif** indexé sur le cours, assiette verrouillée (CF05).
5. **Souveraineté des données** : localisation d'hébergement, URL signées (fin des URL publiques), formalités protection des données (CF07).
6. **États réglementaires** Mines/Douanes/ANEEMAS + **diligence OCDE/LBMA** (CF11/CF12).
7. **Politique de rétention/archivage** documentée (CF).

---

## 4. Vérifications en base live (projet SONASP_OPS `yyverzuhkdonjjuficor`) — RÉSOLUES

Inspection en lecture seule effectuée le 2026-08-08 (117 tables, 431 policies, advisors Supabase). Résultats :

**Confirmé (aggrave le diagnostic) :**
- **RLS permissive prouvée** : sur **431 policies**, **185 en `USING(true)`**, **107 en `WITH CHECK(true)`**, **40 policies DELETE/ALL ouvertes**. RLS est *activée* sur toutes les tables, mais ~43 % des policies sont grandes ouvertes (V2).
- **Bug enum `'shipped'` confirmé live** : `daily_production.status` est de type `production_status_v2` = {prepared, ready_for_customs, cancelled} — **ne contient pas `shipped`** ; tout `status='shipped'` échoue. L'ancien enum `production_status` {prepared, shipped, refined, sold} coexiste, inutilisé (D1).
- **`sale_status` boursouflé** (15 valeurs : legacy `for_sale/sold/paid` + `create_sales` + 11 workflow) ; **deux modèles de raffinage** confirmés (`refinery_status` dédié ET statuts refining dans `freight_shipment_status`) (D8, D9).
- **Tables débris présentes en base** : `shipping_preparations_backup_final`, `shipping_preparations_backup_simple`, `v_inserted` (sans clé primaire) (D22, P-C11).
- **Modèle `batches` ABSENT de la base** → toutes les pages/services l'interrogeant (`ReceivingConfirm`, `RefineryReceivingConfirm`, `ReceivingDashboard`) sont **cassés en production** (P-C1/P-C2).
- **`business_rules` : source de vérité contournée** — `gold_royalty_percentage = 3.0` **existe** mais le code code 0.03 en dur (F4/Q3). Pire : `grams_to_ounces = 31.1035` (valeur **imprécise** stockée comme « canonique » ; le troy exact est 31.1034768) (F1).
- **Advisors sécurité (358 WARN)** : **183** `function_search_path_mutable`, **87** fonctions `SECURITY DEFINER` **exécutables par `anon`**, **87** par `authenticated`, 1 extension en schéma public. → large surface d'élévation via fonctions.
- **Advisors performance (778)** : 399 index inutilisés, 162 `auth_rls_initplan`, 98 `multiple_permissive_policies`, **80 FK non indexées** (D18), 35 index dupliqués, **3 tables sans clé primaire**.
- **Table artisans en minuscules** `snp_artisans_miniers` (63 lignes) ; `SNP_...` et `artisans_miniers` (sans préfixe) **n'existent pas** → la FK de `scripts/20251228_002` échouerait (D4/D5). Les **3 tables de ventes** coexistent : `snp_artisan_ventes_or` (2), `snp_artisan_transactions` (80) — `artisan_ventes_or` (sans préfixe) absent (D15).
- **Carte** : colonne `date_emission` déployée (le code lit `date_delivrance` → NULL, C-10). 23 cartes, **3 sans `qr_code_data`** ; l'image QR reste factice même quand la donnée existe (C-01).

**Nuances corrigées (probité) — moins grave qu'estimé :**
- **`audit_logs` (21 lignes) et `audit_trail` (11) EXISTENT** en base (créées hors migration versionnée). Le constat CF01 porte donc sur la **non-versionnement + non-inviolabilité**, pas sur l'absence de table. `security_events` (831 lignes) est actif.
- **RPC `exec_sql` NON déployée** : la fonction backdoor `fix-rls-and-grant-access` appelle une RPC inexistante → **actuellement inerte**. Le code reste à supprimer (défense en profondeur), mais l'exploitation immédiate de V1 par `exec_sql` n'est pas possible en l'état.
- **`user_profiles` partiellement durci** : ses policies ne sont **pas** `USING(true)` (elles utilisent `is_admin_user()` et `auth.uid()=id`), et `is_active` est verrouillé à sa valeur courante. **MAIS** le `with_check` **ne protège pas la colonne `role`** → l'auto-élévation de rôle (V3) **reste possible**.

**Restant à confirmer (hors SQL) :** `verify_jwt` par edge function, activation de l'inscription publique, caractère public du bucket `cartes-professionnelles`, fonctionnement effectif des edge ECB/LBMA — à vérifier dans la console Supabase (paramètres projet, non lisibles en SQL).

---

## 5. Méthode d'implémentation sans régression

1. **Filet de tests d'abord** : figer les calculs financiers et les transitions par des tests unitaires **avant** tout refactor (Vague 1.1-1.4).
2. **Petits lots vérifiables** : une recommandation = une branche = un test de preuve + validation manuelle sur la plateforme lancée.
3. **Vérification base live** avant les correctifs de schéma.
4. **Preuve fonctionnelle** à chaque étape : capture/scénario montrant que la fonctionnalité marche (ex. scanner réellement un QR généré).
5. **Non-régression** : `npm run typecheck`, `npm run lint`, `npm run test`, et parcours métier clés après chaque vague.
6. **Journal des décisions** (notamment taux fiscaux, modèle de données retenu) validé avec le métier/juriste.

---

## 6. Ce qui relève de la refonte design (différé)

Pour mémoire, à traiter avec les maquettes à venir (ne pas anticiper une nouvelle charte) : tokens couleur dédupliqués (`primary`=`accent` emerald), couleurs inline en hex à remplacer par des tokens, hiérarchie typographique, style glassmorphism du sidebar, densité des cartes de dashboard. La dette **UX structurelle** (feedback, a11y, i18n, navigation) est traitée en Vague 4 car indépendante du visuel.

---

## 7. Annexe — Registre complet des constats

121 constats sourcés répartis par domaine (Sécurité V1-V17, BD D1-D24, Orpailleurs C01-C16, Full-stack F1-F16, Process P-C1..13, UI/UX UX-01..12, Conformité CF01-CF13, QA Q1-Q10). Détail complet conservé dans le fichier de travail d'audit et disponible sur demande, chaque constat portant sévérité, preuve `fichier:ligne`, impact, recommandation et effort.
