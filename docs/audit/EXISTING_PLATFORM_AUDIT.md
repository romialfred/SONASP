# Audit de la plateforme existante — Phase 0 du module Conciliation

> Audit en lecture seule. Aucun fichier du dépôt, aucun objet de la base et aucune fonction hébergée n'ont été modifiés.
> Base observée : Supabase `yyverzuhkdonjjuficor`, schéma `public`, en `SELECT` / `information_schema` / `pg_catalog` uniquement.
> Dépôt : `F:\Development\SONASP`, branche `SONASP_2026`, `HEAD = cb57572`.
> Date de l'audit : 25 août 2026.

**Convention de preuve.** Chaque constat cite un chemin `fichier:ligne` ou un nom d'objet SQL réellement observé.
La mention **[vérifié]** signale un fait que j'ai constaté moi-même pendant cet audit (lecture de fichier ou requête).
La mention **[rapporté]** signale un constat issu de la cartographie amont que je n'ai pas re-vérifié individuellement.
Aucun test d'intrusion, aucune écriture et aucune exécution de RPC n'ont été réalisés : les constats de sécurité sont
des analyses **statiques** de politiques, de privilèges et de déclencheurs.

---

## 1. Résumé exécutif

SONASP est une plateforme de traçabilité et de commercialisation de l'or déjà en production, structurée en quatre
portails (national, société minière, comptoir, collecteur), avec authentification PKCE, MFA, capabilities calculées
côté serveur et cloisonnement RLS. Le socle applicatif est de bonne facture : registre de routes contractuel,
design system unique, RPC transactionnelles idempotentes, audit par déclencheur.

L'écart avec la cible n'est pas un écart d'infrastructure, c'est un écart de **domaine**. Le module de Conciliation
n'existe sous aucune forme : aucune table, aucune RPC, aucune route, aucun écran, aucune capability dédiée
**[vérifié]**. Il n'existe pas non plus de notion de facture provisoire, de ledger comptable en valeur, ni de FNDL —
ce dernier sigle est totalement absent du code et du schéma.

Trois faits dominent la préparation du module. Premièrement, **un moteur fiscal versionné existe déjà, mais pour un
seul circuit** : `snp_artisan_tax_policies` (1 ligne) sert la facturation artisanale ; les circuits industriel et export
figent leurs taux en dur, dans le SQL comme dans le TypeScript. Deuxièmement, **la chaîne aval est structurellement
vide et partiellement cassée** : `snp_contrats`, `snp_analyses_teneur`, `snp_ventes_lots`, `snp_avoirs_achat`,
`receiving_records` comptent 0 ligne, et surtout quatre RPC appelées par le code de vente **n'existent pas dans la base
de production** [vérifié]. Troisièmement, **les données fiscales déjà produites sont fausses** : la taxe de
développement communal est comptabilisée deux fois (16,57 M FCFA en double), et 36 ventes sur 39 portent des montants
non arrondis allant jusqu'à 42 décimales, sur une devise sans subdivision [vérifié].

Conséquence pour la phase suivante : la conciliation ne doit pas être construite au-dessus de la chaîne de vente
export en l'état, et le moteur fiscal doit être une **généralisation** de `snp_artisan_tax_policies`, non une seconde
table de taux. Le socle transactionnel (idempotence, immuabilité, audit, allowlist RPC) est en revanche réutilisable
tel quel et doit l'être intégralement.

---

## 2. Architecture et conventions à respecter

| Sujet | Convention en vigueur | Preuve |
|---|---|---|
| Frontière public/privé | 9 routes vitrine sous `PublicLayout`, tout le reste capté par `<Route path="/*" element={<PrivateApp />} />`, lazy | `src/App.tsx:22-33` |
| Déclaration des routes | Toutes les routes privées dans un fichier unique, sous l'habillage parent `NationalDashboardChrome` | `src/PrivateApp.tsx:250`, catch-all `:1571` |
| Autorisation de route | Registre contractuel gelé `PRIVATE_ROUTE_REGISTRY` (roles, accountTypes, capabilities, readOnly, national), échec fermé sur route non enregistrée | `src/lib/routeAccessRegistry.ts:76`, `:508-542` |
| Garde-fou d'enregistrement | `privateRoutePath()` lève au chargement du module si la route n'est pas enregistrée | `src/lib/routeAccessRegistry.ts:561-566` |
| Grammaire d'autorisation | `src/lib/capabilities.ts` ; `hasSensitiveCapability()` refuse tout repli par rôle | `src/lib/capabilities.ts:154-163` |
| Navigation | Menus projetés depuis le registre et filtrés par `canAccessPrivateRoute()` | `src/components/layout/sidebarNavigation.ts:481-566` |
| Chaîne de données | page → service `src/services/*.ts` → client unique `src/lib/supabase.ts` → PostgREST ou RPC | `src/lib/supabase.ts:57-83` |
| Nommage RPC récent | `snp_` + verbe français ; transitions d'état toujours par RPC, jamais par `UPDATE` client | `src/services/reglementsAchatService.ts`, `requisitionsService.ts` |
| Design system | Jetons `--sn-*` et primitives `ui/sn` ; aucune couleur littérale en CSS de page | `src/styles/design-system.css:11-62`, `src/components/ui/sn/index.tsx` |
| Migrations | Additives, `YYYYMMDDHHMMSS_*.sql`, catalogue mis à jour dans le même commit | `CLAUDE.md` §9 ; 148 fichiers [vérifié] |
| Allowlist RPC | Toute RPC `SECURITY DEFINER` exposée doit figurer dans `snp_rpc_execution_allowlist` (115 lignes) | table observée [vérifié] |

**Points de structure à intégrer sans les aggraver.** `src/PrivateApp.tsx` compte ~1 596 lignes et ~130 routes ;
seules 11 d'entre elles utilisent `privateRoutePath()`, les autres sont des littéraux dont l'enregistrement n'est
vérifié qu'au moment du test **[rapporté]**. `src/services` est un répertoire plat de ~160 fichiers. Le module de
conciliation doit suivre la convention en vigueur (`<domaine>Service.ts` à plat) et systématiser `privateRoutePath()`
sur ses propres routes.

**Deux systèmes d'autorisation frontend coexistent** : `PERMISSIONS` (`src/lib/permissions.ts`, matrice de rôles
embarquée dans le bundle, consultée par `ProtectedRoute.requiredPermission`) et `CAPABILITIES` (serveur). Le module de
conciliation doit s'appuyer **exclusivement** sur `requiredAnyCapabilities` / `requiredSensitiveCapability`, et
n'ajouter aucune nouvelle `PERMISSION`.

---

## 3. Modèle de données existant

Volumétries **[vérifiées]** le 25 août 2026 via `pg_stat_user_tables`.

### 3.1 Achat industriel (mines) — le socle le plus complet

| Table | Lignes | Ce qu'elle couvre déjà |
|---|---|---|
| `snp_factures_achat` | 9 | Facture d'achat : HT, `tva_taux`/`tva_montant_fcfa`, `taxe_dev_comm_*`, `retenue_source_*`, TTC, `montant_ajustements_fcfa`, `montant_paye_fcfa`, `statut`, `statut_certification`, `facture_remplacee_id` |
| `snp_factures_achat_lignes` | — | Lignes de facture, rang unique par facture |
| `snp_reglements_achat` | 5 | Ordre de virement, cycle à 8 états, acteurs horodatés, accusé de réception mine |
| `snp_reglements_affectations` | 5 | Lettrage règlement→facture, mode manuel/FIFO, annulation par statut |
| `snp_reglements_preuves` | 3 | Preuve bancaire typée (MT103, avis SWIFT…), SHA-256, cycle de vérification |
| `snp_avoirs_achat` | **0** | Avoir : `numero_avoir`, `facture_id`, `montant_fcfa`, `motif`, `statut` — répercuté par déclencheur |
| `snp_achats_mines` | 54 | Achat valorisé, `cours_once_usd`, `taux_usd_xof`, imputation contractuelle |
| `snp_factures_certification` | **0** | Journal de tentatives de certification DGI/SECeF |

### 3.2 Circuit artisanal / comptoir — le seul circuit fiscalement versionné

| Table | Lignes | Ce qu'elle couvre déjà |
|---|---|---|
| `snp_artisan_tax_policies` | **1** | Politique fiscale datée : `policy_code`, `effective_from`/`until`, `vat_rate`, `withholding_rate`, `community_rate`, `source_note`. RLS + FORCE, **0 policy** [vérifié] |
| `snp_artisan_factures_definitives` | 32 | Facture définitive, `tax_policy_id` (FK RESTRICT), `taux_tva`, `taux_retenue_source`, `version` |
| `snp_artisan_taxes_retenues` | 96 | Ligne fiscale : type, taux, montant, `compte_comptable`, `statut_reversement`, `periode_fiscale` |
| `snp_artisan_ventes_or` | 39 | Vente d'or artisanale, taxes calculées par déclencheur |
| `snp_artisan_paiements` | 26 | Paiement artisan, tout-ou-rien |
| `snp_artisanal_stock_ledger` | 0 | Ledger append-only en **grammes**, `reverses_entry_id`, `idempotency_key` |
| `snp_artisan_finance_operation_ledger` | — | Journal d'idempotence d'opération. RLS + FORCE, 0 policy [vérifié] |

### 3.3 Chaîne physique et vente export — largement vide

| Table | Lignes | Ce qu'elle couvre déjà |
|---|---|---|
| `sales` | 19 | Vente export : `gross_proceeds`, `net_proceeds`, `royalty_amount`, `final_proceeds`. **Aucune colonne de tenant, ni `royalty_rate`, ni `fx_rate`** [vérifié] |
| `sales_line_items` | **0** | Lignes de vente, jamais écrites |
| `snp_ventes_lots` | **0** | Traçabilité amont FIFO d'une vente ; **pas de colonne `released_at`** malgré le code [vérifié] |
| `snp_contrats` | **0** | Contrat amont, 73 colonnes : teneur, tolérances, laboratoires, délai de contestation, pricing, prime/décote |
| `customer_contracts` | **0** | Contrat client aval — **référencé par aucun code applicatif** |
| `snp_analyses_teneur` / `snp_analyses_resultats` | **0** / **0** | Instruction contradictoire de teneur, résultats immuables, décision motivée |
| `shipping_preparations` / `freight_shipments` | 16 / 8 | Chaîne physique, FK composite tenant-safe |
| `gold_inventory` | 2 | Pesée après fonte ; `variance_with_export_invoice_oz` isolée |
| `receiving_records` / `variance_investigations` | **0** / 0 | Écart de pesée en réception, sans effet financier |
| `refining_records` | **0** | Raffinage |

### 3.4 Socle transversal

`snp_capability_catalog` (31), `snp_role_capabilities` (51), `snp_user_capabilities` (14),
`snp_rpc_execution_allowlist` (115), `snp_payment_operation_ledger` (RLS + FORCE, 0 policy),
`snp_workflow_audit`, `snp_achats_audit` (223), `unified_status_history` (322),
`snp_workflow_notification_outbox`, `business_rules`, `variance_thresholds` (4),
`gold_prices_daily` (532), `fx_rates_daily`.

**Résidus en production** : `v_inserted`, `shipping_preparations_backup_final`,
`shipping_preparations_backup_simple` sont des tables de base réelles du schéma `public`, exposées à PostgREST [vérifié].

---

## 4. Correspondance entités cibles / existant

| Entité cible | État | Objet réel | Commentaire |
|---|---|---|---|
| **Sale** | EXISTE PARTIELLEMENT | `sales` (19), `sales_line_items` (0), `snp_ventes_lots` (0) | Pas de tenant, pas de taux figé, lignes jamais écrites. Aucun lien vers une expédition. |
| **Shipment** | EXISTE | `shipping_preparations` (16) → `freight_shipments` (8) | Chaîne complète, FK composite tenant-safe. Mais **aucune FK vers `sales`**. |
| **Contract** | EXISTE PARTIELLEMENT | `snp_contrats` (0) amont ; `customer_contracts` (0) aval | `snp_contrats` est riche et exploitable mais couvre l'ACHAT. `customer_contracts` est morte : 0 ligne, aucun code, `sales.contract_id` NULL partout. |
| **Assay** | EXISTE PARTIELLEMENT | `assay_certificates` (4) + `assay_certificate_data` (1) ; `snp_analyses_teneur` (0) + `snp_analyses_resultats` (0) | Deux mécanismes disjoints. Le certificat est rattaché à l'**expédition**, jamais à une vente ni à un acheteur. Le contenu chiffré n'alimente aucune valorisation. |
| **Reconciliation** | **ABSENT** | — | Aucune table, vue, RPC, route ni écran. Objets voisins seulement : `receiving_records` (écart de poids, 0 ligne) et `gold_inventory.variance_with_export_invoice_oz` (colonne isolée). |
| **Invoice** | EXISTE PARTIELLEMENT | `snp_factures_achat` (9), `snp_artisan_factures_definitives` (32) | Deux moteurs de facture solides mais disjoints. **Aucune notion de facture provisoire** ; aucune facture de vente export en base. |
| **Payment** | EXISTE | `snp_reglements_achat` (5) + affectations ; `payments` (8) ; `snp_artisan_paiements` (26) | Trois circuits. Les deux derniers sont **tout-ou-rien** : ni acompte ni solde possible. |
| **TaxRule** | EXISTE PARTIELLEMENT | `snp_artisan_tax_policies` (1) | Versionné par date, mais artisanal seulement, 3 taux fixes en colonnes, sans assiette, ni régime, ni royalties, ni FNDL. |
| **TaxLedgerEntry** | EXISTE PARTIELLEMENT | `snp_artisan_taxes_retenues` (96) + vue `v_taxes_a_reverser` | Bonne structure (compte, période, exercice, reversement) mais **mutable**, sans FK vers la politique appliquée, et artisanale seulement. |
| **CommercialLedgerEntry** | **ABSENT** | — | Les objets nommés `*_ledger` sont soit des journaux d'idempotence, soit un ledger de **stock en grammes**. Le relevé fournisseur `snp_releve_societe` est un ledger reconstruit à la lecture, pas une table d'écritures. |
| **CreditNote** | EXISTE PARTIELLEMENT | `snp_avoirs_achat` (0) | Table, contraintes, déclencheur de répercussion et RLS en place. **Aucune RPC d'émission, aucune numérotation serveur, aucun écran, aucun code applicatif** [vérifié]. Montant global unique, sans ventilation fiscale. Circuit mines uniquement. |
| **AuditEvent** | EXISTE | `snp_achats_audit` (223), `snp_workflow_audit`, `snp_ventes_evenements_audit`, `unified_status_history` (322) | Immuables par déclencheur. `snp_workflow_audit` porte déjà `capability_code` et `status_before/after`. Pas de dimension de tenant. |

---

## 5. Workflows existants et machines à états

**Ce qui est correctement contraint côté serveur.**
La production (`production_status_v2` : `prepared` → `ready_for_customs`, `cancelled`) et la préparation d'expédition
(`shipping_preparation_status`) transitent par des RPC à statut attendu et clé de rejeu
(`snp_transition_daily_production`, `snp_transition_shipping_preparation`). Le règlement d'achat suit un cycle à
8 états avec séparation des tâches horodatée. La vente interne comptoir → SONASP a son propre cycle serveur.

**Ce qui n'est pas contraint.**
La machine à états des ventes (`sale_status`, 15 valeurs) **n'est validée par aucun déclencheur** : les fonctions de
contrôle existent mais ne sont attachées à rien, et leur table de référence `sales_status_transitions` est vide
**[rapporté]**. Les transitions d'expédition de fret passent par un `UPDATE` direct sans statut attendu ni verrou
(`src/services/freightShipmentService.ts:385-418`) — or ce sont précisément les valeurs provisoires
(`total_pure_gold_oz`, `gold_price_usd_per_oz`, `total_value_usd`) qui serviront d'assiette de conciliation.

**Chaos de vocabulaire.** Trois à quatre définitions concurrentes du même circuit coexistent
(`src/constants/unifiedStatuses.ts:165-175`, `src/services/unifiedStatusService.ts:162-199`,
`src/services/statusTransitionControlService.ts:94-120`), employant des libellés — `customs_approved`, `refined`,
`in_sale`, `shipped` — qui n'appartiennent à **aucun** enum live. Une règle de conciliation exprimée en termes de
statut viserait une valeur inexistante et échouerait silencieusement.

**Dérive schéma/code confirmée [vérifié].** Quatre RPC appelées par le code de vente sont **absentes de la base
de production** :

| RPC appelée | Appelant | En base |
|---|---|---|
| `snp_creer_vente_export` | `src/services/saleCreationService.ts:28` | **ABSENTE** (seule `snp_creer_vente_export_mine` existe) |
| `snp_decider_approbation` | `src/services/approvalService.ts:33` | **ABSENTE** |
| `snp_vente_a_valider_client` | `src/services/customerSaleDecisionService.ts:27` | **ABSENTE** |
| `snp_repondre_vente_client` | `src/services/customerSaleDecisionService.ts:46` | **ABSENTE** |

De plus, `src/services/tracabiliteVenteService.ts:184` filtre `.is('released_at', null)` sur `snp_ventes_lots`, colonne
qui **n'existe pas** [vérifié]. La création d'une vente export et toute la chaîne d'approbation direction/client sont
donc inopérantes contre la production.

> **Contradiction tranchée.** La cartographie amont présentait `snp_decider_approbation` à la fois comme objet
> réutilisable (« circuit d'approbation générique ») et comme fonction absente. **La fonction n'existe pas** : elle ne
> peut pas être réutilisée.

---

## 6. Fiscalité : où sont les règles, et pourquoi le versionnement est aujourd'hui impossible

### 6.1 Localisation actuelle des règles

| Règle | Où elle vit | Versionnée ? |
|---|---|---|
| TVA / retenue / taxe communale artisanales | `snp_artisan_tax_policies` (`BF-ARTISAN-2026` : 18 / 5 / 1 %) | **Oui**, par `effective_from`/`until` |
| TVA / taxe communale industrielles | Codées en dur dans la RPC de facture (`round(v_brut*0.18,2)`, `*0.01`) et en DEFAULT SQL (`tva_taux DEFAULT 18`) | Non |
| TVA / taxe communale artisanales (chemin vente) | Constantes TypeScript `TVA_TAUX = 18`, `TAXE_DEV_COMM_TAUX = 1` postées par le navigateur | Non |
| Taux de conversion réquisition → achat | **Paramètres de RPC** `p_tva_taux DEFAULT 18`, `p_taxe_dev_comm_taux DEFAULT 1` | Non |
| Royalties | `src/constants/goldConstants.ts:34` (`GOLD_ROYALTY_RATE = 0.03`) [vérifié], littéral `3` dans l'écran de vente, `0.03` en dur dans `calculate_sale_proceeds`, et `business_rules.gold_royalty_percentage` | Non |
| Retenue à la source | Trois barèmes divergents : 1,5 % (défaut de fonction), 5 % (politique), valeur libre par facture | Partiellement |
| **FNDL** | **Nulle part** : aucune table, colonne, fonction ni constante | — |

### 6.2 Pourquoi le versionnement est impossible en l'état

1. **Quatre sources de vérité pour le même taux.** Le taux de royalties existe simultanément comme constante
   TypeScript, littéral d'écran, littéral SQL dans une fonction `IMMUTABLE`, et ligne de `business_rules`. Rien ne les
   synchronise.
2. **`business_rules` n'a ni date d'effet ni historique.** Ses colonnes sont `rule_key, rule_name, rule_value,
   rule_category, description, unit, updated_at, updated_by` ; son seul déclencheur est un `touch` d'horodatage. Toute
   modification réécrit la règle en place : les calculs passés deviennent irreproductibles.
3. **Le taux appliqué n'est pas figé sur la transaction.** `sales` ne porte **ni `royalty_rate` ni `fx_rate`**
   [vérifié]. Une vente ne conserve pas la règle qui l'a produite. Le motif correct existe pourtant : la facture
   artisanale porte `tax_policy_id` en FK RESTRICT.
4. **Les taux sont client-contrôlés sur deux chemins.** Le déclencheur `calculate_vente_or_taxes` applique
   `NEW.tva_taux` tel que fourni, sans consulter aucune politique ; et la conversion réquisition accepte les taux en
   arguments de RPC. Un taux fiscal ne peut pas être un paramètre du navigateur.
5. **Deux assiettes contradictoires coexistent pour la même opération artisanale** [vérifié] :
   - serveur, `snp_artisan_emettre_facture` : `v_retenue := round(v_brut*v_policy.withholding_rate/100,2)` puis
     `v_net := v_brut - v_retenue` ;
   - écran, `src/services/factureVenteService.ts:318-321` : `totalTtc = montantHt + totalTva + totalAutresTaxes`,
     puis `netAPayer = totalTtc - acompte`.

   Sur 1 000 000 FCFA bruts et la politique `BF-ARTISAN-2026`, le serveur enregistre **950 000** et l'écran imprime
   **1 190 000**.
6. **Les montants ne sont pas arrondis** et les colonnes n'ont pas d'échelle. `snp_artisan_ventes_or.tva_montant_fcfa`
   et les colonnes financières de `sales` sont `numeric` **sans précision ni échelle** [vérifié] ; le déclencheur de
   taxation ne comporte aucun `ROUND`. En production, **36 ventes sur 39** portent une TVA non arrondie, jusqu'à
   **42 décimales** [vérifié], sur une devise sans subdivision.

### 6.3 Anomalie de données avérée

**La taxe de développement communal est comptabilisée deux fois** [vérifié]. Deux écritures automatiques concurrentes
insèrent le même prélèvement sous deux codes distincts, ce que la contrainte `ON CONFLICT (paiement_id, type_taxe)`
ne bloque pas :

| `type_taxe` | Lignes | Total (FCFA) |
|---|---|---|
| `tva` | 24 | 298 315 898,90 |
| `retenue_source` | 24 | 82 865 527,47 |
| `autre` | 24 | **16 573 105,49** |
| `taxe_municipale` | 24 | **16 573 105,48** |

Les deux dernières lignes sont le même prélèvement, compté deux fois : **~16,57 M FCFA d'inflation** du total des
taxes à reverser. Aucune écriture de ledger fiscal ne peut être posée avant correction.

---

## 7. Facturation existante et facture spécimen

**Trois moteurs de facture, deux vivants.** `snp_factures_achat` (achat industriel, création par RPC transactionnelle
avec verrou et ré-entrée idempotente) et `snp_artisan_factures_definitives` (émission par RPC idempotente à verrou
optimiste, politique fiscale résolue sur la date de vente et figée par `tax_policy_id`). La facturation de **vente
export n'existe pas en base** : `src/services/factureVenteService.ts` est un composeur de document côté client.

**Immuabilité et honnêteté réglementaire — à préserver.** Les déclencheurs `snp_proteger_facture` et
`snp_guard_artisan_invoice_immutability` figent montants, numéro et référence DGI. Surtout, la plateforme **refuse de
fabriquer une certification** : `src/services/factureVenteService.ts:3-21` documente la note DGI n°2025-0885, le QR
annonce en clair `SPECIMEN — FACTURE NON CERTIFIÉE`, et la contrainte `snp_facture_certification_prouvee` interdit
qu'une facture se dise certifiée sans preuve. `snp_factures_certification` compte 0 ligne [vérifié] et aucune Edge
Function DGI n'existe. **Cette doctrine doit être reconduite sans exception.**

Une exception y déroge déjà : `src/pages/achats/FactureAchatApercu.tsx:437-447` affiche, dès que
`statut_certification = 'certifiee'`, un NIM MCF qui n'est que la référence SECeF recopiée, un ISF valant le mot
« Homologué » et un compteur « 1 / 1 ». Ce sont des valeurs fabriquées sur une pièce présentée comme certifiée.

**Numérotation — inadaptée à une pièce fiscale.** `snp_numero_suivant` procède par `SELECT max(...)+1` sans séquence ni
verrou (collision sous charge, trous après rollback), tandis que la facture artisanale est numérotée par
10 caractères hexadécimaux **aléatoires**. Ni l'un ni l'autre ne produit la séquence continue par exercice qu'exige un
contrôle fiscal. Aucune séquence PostgreSQL dédiée n'existe.

**Aucun archivage.** `pdf_url` n'est jamais renseignée ; la facture est recomposée à chaque affichage depuis l'état
courant des tables — une correction ultérieure modifie rétroactivement la pièce affichée. Trois générateurs PDF sont du
code mort, dont `saleInvoiceService.ts` qui écrit dans un bucket `sale-documents` inexistant et met à jour des colonnes
`sales.invoice_pdf_*` inexistantes.

**Facture spécimen.** Aucun fichier de facture de référence n'est versionné dans le dépôt : la facture ayant servi de
modèle n'est décrite qu'en prose dans `docs/JOURNAL-IMPLEMENTATION.md`. Les seuls documents sources bruts sont des
`.docx` et `.pptx` à la racine, non convertis en spécification. L'invariant `HT + TVA + autres taxes − acompte = net`
est en revanche documenté et testé, et le gabarit visuel partagé (`src/pages/artisan-minier/facture-vente.css`,
importé par l'aperçu de facture d'achat) est réutilisable.

---

## 8. RBAC, isolation multi-tenant et audit

**Ce qui est solide.** Le catalogue de capabilities est une table SQL autoritative (31 codes, colonne `sensitive`).
`snp_actor_has_capability` exige un compte actif, honore les overrides datés, refuse `manager` hors lecture, et refuse
toute capability sensible sans AAL2. `snp_require_capability` y ajoute la session applicative non révoquée : c'est le
garde-fou à placer en première instruction de toute RPC de conciliation. Le tenant est dérivé du serveur
(`snp_societe_utilisateur`, `snp_current_organization_id`, `snp_can_access_artisan`), jamais d'un paramètre d'URL —
`MinePortalGuard` ignore explicitement `?mine`. Les ledgers d'idempotence sont en RLS + FORCE avec **0 policy**
[vérifié] : inaccessibles hors `SECURITY DEFINER`. C'est le modèle exact à reprendre.

**Désynchronisation du contrat d'habilitation [vérifié].** `snp_capability_catalog` contient **31** codes ;
`src/lib/capabilities.ts` en déclare **25**. Six codes existent en base sans constante TypeScript (`freight.read`,
`freight.prepare`, `freight.invoice.manage`, `freight.customs.approve`, `freight.transport.dispatch`,
`workflow.history.read`). Aucun test ne garde cette correspondance.

**`sonasp.tax.reconcile` est déclarée et totalement inerte** [vérifié] : présente au catalogue et dans
`src/lib/capabilities.ts:14`, elle n'apparaît dans aucune route, aucun écran, et n'est décrite par aucun document.

### 8.1 Constats de sécurité structurants (analyse statique, non testée)

**a) Élévation de privilège par auto-modification du rôle — correction d'une preuve erronée.**
La cartographie amont affirmait que la policy `users_update_own_profile` a un `WITH CHECK` nul. **C'est faux**
[vérifié] : elle porte bien
`with_check = ((auth.uid() = id) AND (is_active = (SELECT is_active FROM user_profiles WHERE id = auth.uid())))`.
Le risque subsiste néanmoins, pour une raison différente et vérifiée : ce `WITH CHECK` ne contraint **que `is_active`**,
il ne dit rien de `role` ni de `mining_company_id` ; `authenticated` détient bien le privilège `UPDATE` sur ces deux
colonnes [vérifié] ; et le déclencheur `snp_2m_versionner_profil_securite`, qui couvre pourtant
`UPDATE OF role, is_active, mining_company_id`, **ne bloque que le changement de `is_active`** — un changement de
`role` se contente d'incrémenter `version` [vérifié, lecture de la définition de la fonction]. Aucun des déclencheurs
restants ne s'oppose à un passage vers `management` ou `admin`. Le rôle `management` porte 14 capabilities, dont
`sonasp.approve`, `sonasp.finance.execute` et `sonasp.finance.reconcile`.
**Constat statique ; à confirmer par un test négatif non destructif avant toute implémentation.**

**b) Sur-privilège du rôle `anon`.** `anon` détient `TRUNCATE` sur **121 tables** du schéma `public` [vérifié].
`TRUNCATE` n'est jamais soumis à RLS : seule l'absence de privilège protège. Les nouvelles tables de conciliation
hériteront du même défaut si les `ALTER DEFAULT PRIVILEGES` ne sont pas corrigés d'abord.

**c) Extension `http` dans le schéma `public`** [vérifié], donc atteignable par PostgREST. Vecteur de SSRF depuis la
base et contournement possible de toute allowlist HTTPS que le futur pont DGI mettrait en place.

**d) AAL2 contournable pour les comptes jamais enrôlés.** `snp_mfa_satisfaite()` retourne `true` lorsque
`mfa_enrolled_at IS NULL`. L'enrôlement obligatoire n'est imposé que par un composant client
(`src/components/auth/MandatoryMfaGate.tsx`), qui ne bloque rien au niveau PostgREST.

**e) Écriture non cloisonnée sur les tables enfants de vente.** Les policies restrictives de périmètre ne couvrent que
le `SELECT` ; des policies permissives `WITH CHECK (true)` subsistent en écriture sur `snp_ventes_lots`,
`gold_inventory`, `inventory_transactions`.

**f) Cumul de pouvoirs sur `management`** : préparation, approbation, exécution du paiement et rapprochement sur un
même rôle. Ajouter `reconciliation.prepare` et `reconciliation.approve` à ce rôle annulerait la séparation des tâches.

**g) Divergence dépôt / production des Edge Functions [vérifié].** 14 fonctions ont du code ; **7 seulement sont
ACTIVE** (`envoyer-courriel`, `create-user`, `get-users`, `reset-user-password`, `delete-user`, `get-user-details`,
`manage-user-status`). Ne sont **pas déployées** : `sensitive-upload`, `activate-account`, `public-assistance`,
`revoke-user-sessions`, `scheduled-tasks`, `fetch-daily-lbma-prices`, `fetch-daily-fx-rates` — dont quatre sont
appelées par le client. Le téléversement de tout document sensible (donc le futur rapport de laboratoire acheteur)
passe par `sensitive-upload`, absent de la production.

**Audit.** `snp_workflow_audit` porte `capability_code`, `status_before`, `status_after` et `reason` — exactement ce
qu'exige une transition de conciliation — mais **aucune colonne de tenant** : sa lecture n'est pas cloisonnée par mine
ni par comptoir. `security_events` accepte des `INSERT` en `WITH CHECK (true)` depuis le navigateur.

---

## 9. Les dix points exigés par la mission

### 9.1 Ce qui fonctionne
Registre de routes contractuel à échec fermé ; capabilities serveur autoritatives avec contrôle AAL2 ;
dérivation serveur du tenant ; patron de RPC transactionnelle complet (capability, réservation d'idempotence,
`FOR UPDATE`, verrou optimiste `40001`, table de transitions, séparation des tâches, audit) ;
ledgers d'idempotence en RLS + FORCE sans policy ; immuabilité par déclencheur (audit, ledger de stock, facture
émise) ; moteur de solde de facture (`snp_facture_net_exigible`, `_paye`, `_reste_du`) et relevé fournisseur
reconstruit à la lecture ; distinction « engagé » vs « payé » ; passerelle unique de téléversement sensible ;
refus documenté de fabriquer une certification DGI ; design system et primitives uniques ; conversion once troy
canonique et testée (`TROY_OZ_GRAMS = 31.1034768`) [vérifié].

### 9.2 Ce qui est à améliorer
Deux systèmes d'autorisation frontend concurrents ; nommage RPC hétérogène (héritage anglais) ;
`PrivateApp.tsx` monolithique avec 11 routes protégées par `privateRoutePath()` sur ~130 ;
`src/services` plat à ~160 fichiers ; 51 feuilles de style de page en marge du design system ;
`snp_numero_suivant` sans séquence ni verrou et sans `search_path` ; `snp_facture_statut_calcule` ignore le paramètre
d'échéance qui lui est passé ; 49 fonctions `SECURITY DEFINER` sans `search_path` ; statuts financiers en `text + CHECK`
alors que les statuts logistiques sont des enums ; agrégation de pièces de paiement sans filtre de rattachement
(`src/services/paymentDocumentsService.ts:77-205`) ; URL brutes au lieu d'URL signées pour licences, raffinage et
facture de vente dans ce même fichier.

### 9.3 Ce qui est incomplet
Le moteur fiscal versionné ne couvre qu'un circuit et **aucune des 32 factures artisanales ne porte de
`tax_policy_id`** ; `snp_artisan_taxes_retenues` n'a aucune FK vers la politique appliquée et ses 96 lignes ont
`compte_comptable` vide ; les avoirs existent sans RPC, sans numérotation, sans écran ; `snp_analyses_teneur` et son
service existent sans aucune route ni écran ; le rapprochement de pesée est modélisé mais son service écrit des
colonnes inexistantes (`src/services/receivingValidationService.ts:58-126`) et n'a aucun consommateur ; les seuils de
`variance_thresholds` ne sont lus par aucun écran ; `receiving_records`, `refining_records`, `sales_line_items`,
`snp_ventes_lots`, `snp_contrats`, `customer_contracts` sont vides ; la certification DGI est inerte.

### 9.4 Ce qui manque
Toute l'entité **Reconciliation** (table, machine à états, RPC, routes, écrans, capabilities) ;
la **facture provisoire** et le lien provisoire → définitive ;
le **FNDL**, absent du code et du schéma ;
un **TaxRule générique** (par type de taxe, assiette, régime, devise, juridiction, statut brouillon/publié/retiré,
référence réglementaire) ;
un **barème de royalties** versionné, a fortiori progressif ;
un **CommercialLedgerEntry** et un **TaxLedgerEntry** en valeur, append-only ;
une **CreditApplication** (imputation partielle d'un avoir, report de solde) — `snp_avoirs_achat` n'imputant que sur
une facture unique ;
la **facturation de vente export** en base ;
le **lien Sale ↔ Shipment** ;
le rattachement d'un **assay acheteur** à une vente ;
les capabilities `reconciliation.*` et `tax.rules.*` ;
un **générateur de séquence** fiscale continue ;
tout **test SQL** portant sur conciliation, avoirs ou fiscalité ;
toute **Edge Function DGI**.

### 9.5 Incohérences de données (production)
1. Taxe communale **comptabilisée deux fois** : 24 lignes `autre` (16 573 105,49) + 24 lignes `taxe_municipale`
   (16 573 105,48) [vérifié].
2. **36 ventes sur 39** avec TVA non arrondie, jusqu'à **42 décimales**, en XOF [vérifié].
3. Deux régimes de retenue coexistent sans version : 30 factures à 5,00 %, 2 à 1,50 % ; les 32 ont `tax_policy_id` NULL.
4. Divergence net serveur (`brut − retenue`) vs net imprimé (`HT + TVA + taxes − acompte`) [vérifié].
5. Référentiel de cours dégradé : **232 cotations sur 532** marquées `Synthetic (Fallback)`, dernier cours au
   **2026-08-20** soit 5 jours de retard [vérifié].
6. `business_rules.grams_to_ounces = 31,1035` contre `31,1034768` dans le code, valeur elle-même redupliquée dans
   `src/services/achatMineService.ts:20` et `src/hooks/useCoursOr.ts:5`.
7. `sales.contract_id` NULL sur les 19 ventes ; `customer_contracts` vide.
8. Tables résiduelles en production : `v_inserted`, `shipping_preparations_backup_final`, `_backup_simple` [vérifié].

### 9.6 Problèmes de sécurité
Voir §8.1 : (a) élévation de privilège par `role` — preuve corrigée et risque confirmé ; (b) `TRUNCATE` accordé à
`anon` sur 121 tables ; (c) extension `http` exposée ; (d) AAL2 contournable pour les comptes non enrôlés ;
(e) écriture non cloisonnée sur les enfants de vente ; (f) cumul de pouvoirs sur `management` ;
(g) `sensitive-upload` non déployée. S'y ajoutent : taux fiscaux fournis par le navigateur, cours de l'or saisi
librement sans confrontation au référentiel ni aux bornes `gold_price_minimum`/`maximum`, royalties calculées côté
client et transmises telles quelles, `business_rules` lisible par tout compte authentifié en `USING (true)` et
modifiable sur un contrôle de rôle brut hors capabilities, et décodage non vérifié du claim `aal` dans
`supabase/functions/_shared/assurance.ts:9-21`.

### 9.7 Problèmes de workflow
Machine à états des ventes non contrainte côté serveur ; quatre RPC de vente et d'approbation **absentes de la
production** alors que le code les appelle [vérifié] ; colonne `released_at` absente de `snp_ventes_lots` [vérifié] ;
transitions de fret par `UPDATE` direct sans verrou sur les valeurs d'assiette ; trois à quatre vocabulaires de statut
divergents dont plusieurs libellés n'existent dans aucun enum ; `salesService` interrogeant une table `batches`
inexistante ; `allowed_status_transitions` décrivant un circuit aéroport/raffinerie que plus aucune table ne porte ;
paiements international et artisan **tout-ou-rien**, incompatibles en l'état avec un acompte provisoire ;
`prix_a_recalculer` produit par `snp_evaluer_teneur` et consommé par personne — c'est pourtant le déclencheur métier
naturel de la conciliation.

### 9.8 Risques de régression
Toucher `snp_facture_net_exigible`, `snp_recalculer_facture` ou `snp_facture_paye` impacte le relevé fournisseur, la
balance âgée et l'éligibilité au paiement ; relâcher la garde de ±0,5 % de `snp_paiement_international_executer` pour
laisser passer un acompte détruirait le seul contrôle serveur du montant d'un paiement ; ajouter une route non
enregistrée au registre casse la suite de tests et produit un comportement incohérent entre `PrivateApp` et la
sidebar ; déclarer `/conciliations/nouvelle` après `/conciliations/:id` la fait capter par le paramètre — piège déjà
rencontré (`src/PrivateApp.tsx:660-661`) ; créer un second relevé de compte ferait diverger deux soldes ; émettre un
avoir hors du déclencheur `snp_repercuter_avoir` laisserait le net exigible faux ; omettre la mise à jour de
`supabase/migrations.catalogue.json` fige une nouvelle dérive dans un historique déjà hétérogène (148 fichiers,
préfixes mixtes) ; un jeu de données de démonstration encore présent en base produirait des soldes de ledger faux et
irrécupérables une fois les écritures posées.

### 9.9 Modifications de base nécessaires (constat, non plan)
Avant toute écriture de ledger : corriger la double comptabilisation de la taxe communale ; imposer l'arrondi et une
échelle explicite (`numeric(20,2)` XOF, `numeric(18,4)` onces) sur les colonnes financières de `sales` et du circuit
artisanal ; matérialiser un tenant sur `sales` (aujourd'hui absent) faute de quoi aucun enfant financier ne pourra
hériter du tenant par FK composite ; figer taux et cours sur la transaction (`royalty_rate`, `fx_rate`,
`tax_policy_id`) ; ajouter une contrainte d'exclusion sur les périodes de `snp_artisan_tax_policies` ; retirer
`TRUNCATE` à `anon` et corriger les `ALTER DEFAULT PRIVILEGES` ; déplacer l'extension `http` hors de `public` ;
réconcilier `snp_capability_catalog` et `src/lib/capabilities.ts` ; retirer les tables résiduelles ; réconcilier les
migrations non enregistrées qui expliquent les RPC manquantes ; déployer `sensitive-upload` et les deux fonctions de
cours.

### 9.10 Dépendances entre nouveaux et anciens modules
Le module dépendra de : `snp_contrats` (tolérances, laboratoire faisant foi, délai de contestation, prix ajusté sur
teneur) ; `snp_analyses_teneur` / `snp_analyses_resultats` et `assay_certificate_data` (valeur définitive) ;
`shipping_preparations` / `freight_shipments` (valeur provisoire) ; `snp_ventes_lots` (ventilation de l'écart vers les
lots amont) ; `snp_factures_achat` et `snp_avoirs_achat` (régularisation industrielle) ;
`snp_artisan_tax_policies` (moteur fiscal) ; `gold_prices_daily` et `fx_rates_daily` (valorisation) ;
`snp_require_capability`, `snp_4i_idempotency_reserve`, `snp_workflow_audit`, `snp_rpc_execution_allowlist`
(socle transversal) ; `sensitive-upload` (pièce justificative) ; `snp_workflow_notification_outbox` (notification).
Réciproquement, l'émission d'une facture définitive ou d'un avoir modifiera le solde lu par `snp_releve_societe`,
`snp_situation_societe`, `snp_balance_agee` et l'éligibilité calculée par `snp_factures_eligibles`.

---

## 10. Objets à réutiliser impérativement

| Objet | Emplacement | Pourquoi ne pas le dupliquer |
|---|---|---|
| `snp_require_capability` | fonction SQL, `SECURITY DEFINER` | Session active **et** capability, `ERRCODE 42501`. Première instruction de toute RPC du module. |
| `snp_actor_has_capability` / `snp_actor_capabilities` | fonctions SQL | Unique source d'autorisation dans les policies et unique alimentation de `user.capabilities`. |
| `snp_capability_catalog` / `_role_capabilities` / `_user_capabilities` | tables | Y déclarer `reconciliation.*` et `tax.rules.*` avec `sensitive = true` ; attribution nominative datée plutôt qu'élargissement de `management`. |
| `snp_4i_idempotency_reserve` / `_complete` + `snp_4i_capability_for_scope` | fonctions SQL | Rejouabilité et choix de capability selon périmètre. Évite le double avoir sur rejeu réseau. |
| `snp_artisan_transition_reversement_taxe` | fonction SQL | Patron complet de RPC de transition (verrou, `40001`, transitions autorisées, séparation des tâches par comparaison d'acteur, retour `replayed`). |
| `snp_payment_operation_ledger` / `snp_artisan_finance_operation_ledger` | tables, RLS + FORCE, 0 policy | Gabarit exact des ledgers à créer. |
| `snp_artisanal_stock_ledger` + `snp_block_ledger_mutation` | table + déclencheur | Ledger append-only réversible (`reverses_entry_id`, unicité partielle, motif obligatoire). À transposer en valeur. |
| `snp_artisan_tax_policies` + `snp_artisan_factures_definitives.tax_policy_id` | table + FK RESTRICT | **Seul** moteur fiscal versionné. À généraliser (régime, assiette, royalties, FNDL, statut de publication), jamais à dupliquer. |
| `snp_artisan_emettre_facture` | fonction SQL | Résolution de la politique par la **date de l'opération**, échec fermé si non couverte, gel de la version sur la pièce. |
| `snp_avoirs_achat` + `snp_repercuter_avoir` + `snp_recalculer_facture` | table + déclencheurs | Compensation déjà branchée sur le statut de facture. À câbler (RPC, numérotation, plafond, ventilation fiscale), pas à recréer. |
| `snp_facture_net_exigible` / `_paye` / `_reste_du` / `_reste_a_affecter` | fonctions SQL | Algèbre de solde unique. Le ledger doit s'y adosser. |
| `snp_reglements_affectations` + `snp_affecter_reglement` + FIFO | table + fonctions | Imputation d'un solde de conciliation et gestion du trop-perçu. |
| `snp_releve_societe` / `snp_situation_societe` / `snp_balance_agee` | fonctions SQL | Ledger commercial fournisseur existant, déjà branché sur les avoirs. Y ajouter les natures de conciliation. |
| `snp_contrats` | table (73 colonnes) | Les paramètres de conciliation y sont : `teneur_tolerance_pct`, `teneur_faisant_foi`, `delai_contestation_jours`, `frais_contre_expertise`, `prix_ajuste_sur_teneur`, `prime_pct`, `decote_pct`. La conciliation les **lit**. |
| `snp_analyses_teneur` / `_resultats` + `snp_evaluer_teneur` | tables + fonction | Instruction contradictoire avec résultats immuables et décision motivée. À **étendre** (rattachement vente/expédition), pas à recréer. |
| `snp_workflow_audit` + `snp_auditer` | table + déclencheur | `capability_code` et `status_before/after` déjà présents. Prévoir une dimension de tenant. |
| `snp_rpc_execution_allowlist` | table | Y déclarer chaque nouvelle RPC dans la même migration que le `GRANT`. |
| `snp_workflow_notification_outbox` | table | Notifier un écart par l'outbox serveur, jamais par un envoi direct. |
| `sensitiveUploadGateway` + `_shared/secure-upload.ts` | `src/services/sensitiveUploadGateway.ts:49`, `:97` | Unique voie d'attachement d'un rapport de laboratoire. **Attention : la fonction n'est pas déployée.** |
| `snp_reglements_preuves` + `TYPES_PREUVE` | table + `src/services/reglementsAchatService.ts:53-65` | Preuve typée MT103/SWIFT, SHA-256, cycle de vérification par un tiers. |
| `factureVenteService` (`GROUPES_TAXATION`, `recapitulerGroupes`, `montantEnLettres`, `contenuQrSpecimen`) | `src/services/factureVenteService.ts:37-43`, `:162-264` | Seule composition de facture testée du dépôt. Le barème doit être alimenté par le serveur. |
| `facture-vente.css` | `src/pages/artisan-minier/facture-vente.css` | Gabarit d'impression déjà partagé entre facture d'achat et de vente. À importer, pas à recopier. |
| `goldConstants` (`TROY_OZ_GRAMS`, `gramsToTroyOz`) | `src/constants/goldConstants.ts:20-48` | Conversion canonique testée. `GOLD_ROYALTY_RATE` doit en revanche devenir une règle versionnée. |
| `PRIVATE_ROUTE_REGISTRY` / `privateRoutePath` / `ProtectedRoute` | `src/lib/routeAccessRegistry.ts`, `src/components/auth/ProtectedRoute.tsx:28-29` | Enregistrer chaque route avec `requiredSensitiveCapability`, jamais `requiredPermission`. |
| Primitives `ui/sn` + jetons `--sn-*` | `src/components/ui/sn/index.tsx`, `src/styles/design-system.css` | Interdiction d'un second design system. |
| `supabase/tests/*.sql` | `reglement_sod_test.sql`, `mine_scope_rls_test.sql`, `export_quota_idempotence_contract_test.sql` | Gabarits de tests négatifs Mine A/Mine B et de séparation des tâches. |

---

## 11. Questions réellement bloquantes

Seules figurent ici les questions qu'aucune lecture du dépôt, des données ou du cahier des charges ne permet de
trancher. Les autres arbitrages relèvent de la conception et seront traités en phase suivante.

1. **Barème fiscal opposable.** Quels sont les taux, assiettes et affectataires légalement applicables pour la TVA,
   les royalties et le FNDL sur les circuits industriel et export ? Le dépôt contient trois jeux de taux
   contradictoires et aucun n'a de validation juridique tracée. Le FNDL n'a **aucune** définition dans le dépôt :
   ni assiette, ni taux, ni fait générateur, ni bénéficiaire. *Décideur : métier + fiscaliste BF.*

2. **Assiette de la retenue et convention de calcul.** Le serveur déduit la retenue du brut ; l'écran additionne les
   taxes. Laquelle est juridiquement exacte, et quel est le traitement réel de la TVA et de la taxe communale (déduite,
   collectée, ajoutée) ? Cette question conditionne la correction des 32 factures existantes. *Décideur : fiscaliste BF.*

3. **Correction des données fiscales déjà produites.** La double comptabilisation de la taxe communale (~16,57 M FCFA)
   et les 36 montants non arrondis portent sur des factures **déjà émises** et des taxes déclarées « à reverser ».
   Faut-il corriger en place, contrepasser, ou geler l'historique et n'appliquer la règle qu'aux opérations futures ?
   *Décideur : direction SONASP + comptabilité.*

4. **Ancrage contractuel de la conciliation.** `snp_contrats` (amont, achat, 0 ligne, riche et exploitable) ou
   `customer_contracts` (aval, vente, 0 ligne, aucun code, `sales.contract_id` NULL partout) ? Aucun des deux n'a
   jamais servi ; le cahier des charges pose « le contrat est la source de vérité » sans dire lequel.
   *Décideur : métier SONASP.*

5. **Paiement provisoire.** Les paiements international et artisan sont tout-ou-rien par construction serveur (garde
   de ±0,5 % sur `final_proceeds`, montant imposé égal au net à payer). Un versement provisoire est-il un acompte sur
   la même vente, ou une opération d'une nature distincte ? La réponse détermine s'il faut assouplir une garde de
   sécurité existante — ce que je déconseille — ou créer une entité séparée. *Décideur : métier + finance SONASP.*

6. **Périmètre du circuit artisanal.** Le cahier des charges exclut explicitement Orpailleur → Comptoir du moteur de
   conciliation et de la génération automatique de TVA/FNDL/royalties. Or c'est précisément le circuit où des taxes
   sont aujourd'hui calculées automatiquement à la vente. Faut-il neutraliser cette taxation automatique, ou maintenir
   deux régimes ? *Décideur : métier SONASP + fiscaliste.*

7. **Statut du cahier des charges.** `Implementation-Concilliation.md` est **non suivi par Git** [vérifié :
   `?? Implementation-Concilliation.md`]. Seule source d'exigences du module, il peut disparaître sans trace.
   Doit-il être versionné ? *Décideur : responsable projet.*

---

## 12. Zones de test nues à couvrir

| Zone | Objet | État actuel | Preuve |
|---|---|---|---|
| Vente export | `salesService.ts` | Aucun test | absence de `.test.ts` voisin |
| Facture de vente | `saleInvoiceService.ts` | Aucun test ; code mort ciblant un bucket et des colonnes inexistants | `src/services/saleInvoiceService.ts:397`, `:441-447` |
| Vente artisanale | `artisanGoldSalesService.ts` | Aucun test ; taux en dur `|| 18`, `|| 1` | `src/services/artisanGoldSalesService.ts:132-133` |
| Cours de l'or | `goldPriceService.ts` | Aucun test ; écrit des dérivés fabriqués dans le référentiel | `src/services/goldPriceService.ts:62-67`, `:132-139` |
| Paramètres de vente or | `goldSalesSettingsService.ts` | Aucun test | — |
| PDF facture | `factureDefinitivePdfService.ts`, `factureArtisanPdfService.ts` | Aucun test ; mentions légales et IFU factices | `src/services/factureArtisanPdfService.ts:71-77`, `:218` |
| Facture fret | `freightInvoiceGenerationService.ts` | Aucun test | — |
| Réception / écarts | `receivingValidationService.ts` | Aucun test, aucun consommateur, écrit des colonnes inexistantes | `src/services/receivingValidationService.ts:58-126` |
| Calcul fiscal SQL | — | **Aucun** des 29 tests SQL ne porte sur un calcul de taxe | `supabase/tests/*.sql` |
| Facture définitive / avoir SQL | — | Aucun test de contrat | idem |
| Ledger (commercial, fiscal) | — | Aucun test | idem |
| Conciliation multi-tenant | — | Aucun test négatif Mine A/Mine B ni Comptoir A/Comptoir B possible avant création des tables | — |
| Séparation des tâches conciliation | — | À écrire avec la migration, pas après | gabarit `supabase/tests/reglement_sod_test.sql` |
| Synchronisation catalogue ↔ code | `snp_capability_catalog` vs `src/lib/capabilities.ts` | Aucun test ; écart de 6 codes constaté | 31 vs 25 [vérifié] |
| Couverture des routes | `PRIVATE_ROUTE_REGISTRY` | Test existant mais ~119 routes déclarées en littéral | `src/lib/routeAccessRegistry.test.ts:73-82` |
| E2E Comptoir → SONASP → Finance | — | Nu | audit du 24 août |
| Parcours Collecteur | — | Nu | audit du 24 août |
| Concurrence quota / stock | — | Nu | audit du 24 août |
| Arrondi monétaire XOF | — | Aucun test ; 36/39 ventes non arrondies en production | [vérifié] |

---

*Fin de l'audit de phase 0. Aucun plan d'implémentation n'est proposé ici : il relève de la phase suivante.*
