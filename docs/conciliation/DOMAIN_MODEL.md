# Modèle de domaine — Conciliation, fiscalité et facturation

Ce modèle part de l'existant. Chaque entité cible du cahier des charges est
rapprochée d'un objet réel du schéma `public` observé sur `yyverzuhkdonjjuficor`.
Rien n'est créé lorsqu'un objet couvre déjà le besoin.

---

## 1. Principe directeur

La conciliation est la couche qui rapproche **ce qui a été déclaré à l'expédition**
de **ce que l'acheteur reconnaît après analyse**, puis en tire les conséquences
commerciales et fiscales.

Elle doit répondre à cinq questions avec une piste d'audit :

1. Combien d'or a réellement été reconnu ?
2. Quelle est la valeur définitive de la vente ?
3. Combien le client a-t-il payé, combien reste-t-il à régler ou restituer ?
4. Quel écart subsiste par taxe ?
5. Quelle écriture explique chaque franc du solde commercial ou fiscal ?

---

## 2. Correspondance entités cibles / existant

| Entité cible | État | Objet réel | Décision |
|---|---|---|---|
| Contract | **existe** | `snp_contrats` | réutiliser tel quel |
| Sale | **existe** | `sales` | réutiliser, enrichir des références de conciliation |
| SaleLine | **existe partiellement** | `snp_ventes_lots`, `sales_line_items` | réutiliser `snp_ventes_lots` |
| Shipment | **existe** | `shipping_preparations`, `freight_shipments` | réutiliser |
| Assay | **existe** | `snp_analyses_teneur` | réutiliser et exposer |
| Invoice | **existe partiellement** | `snp_factures_achat`, `snp_artisan_factures_definitives` | réutiliser côté achat, étendre côté vente |
| Payment | **existe** | `payments`, `snp_artisan_paiements` | réutiliser |
| PaymentAllocation | **absent** | — | à créer |
| TaxRule | **existe partiellement** | `snp_artisan_tax_policies` | **généraliser**, ne pas dupliquer |
| TaxCalculation | **absent** | — | à créer (instantané de calcul) |
| TaxLedgerEntry | **absent** | — | à créer sur le modèle `snp_artisanal_stock_ledger` |
| CommercialLedgerEntry | **absent** | — | à créer sur le même modèle |
| CreditNote | **existe partiellement** | `snp_avoirs_achat` | étendre : solde et imputations |
| CreditApplication | **absent** | — | à créer |
| Reconciliation | **absent** | — | à créer |
| ReconciliationVersion | **absent** | — | à créer |
| AuditEvent | **existe** | `snp_ventes_evenements_audit`, `snp_decisions_approbation_audit`, journaux d'audit | réutiliser |

---

## 3. Ce qui existe déjà et qu'il ne faut pas réécrire

### 3.1 Le contrat est déjà la source de vérité

`snp_contrats` porte déjà l'intégralité des conditions que le cahier des charges
§25 demande de ne pas ressaisir :

- **Teneur** : `teneur_reference_pct`, `teneur_minimale_pct`, `teneur_tolerance_pct`
- **Analyse** : `methode_echantillonnage`, `methode_analyse`, `laboratoire_initial`,
  `laboratoire_independant`, `teneur_faisant_foi`
- **Contestation** : `delai_contestation_jours`, `frais_contre_expertise`
- **Prix** : `methode_prix`, `source_cours`, `devise_cours`, `devise_reglement`,
  `prix_fixe_fcfa`, `prime_pct`, `decote_pct`, `formule_prix`,
  `prix_ajuste_sur_teneur`
- **Quantité** : `tolerance_quantite_pct`, `plafond_depassement_pct`,
  `report_reliquat`
- **Paiement** : `conditions_paiement`, `delai_paiement_jours`, `penalites`
- **Différends** : `reglement_differends`

La conciliation lit ces valeurs ; elle ne les redemande jamais à l'utilisateur.
`teneur_faisant_foi` détermine à lui seul quelle teneur emporte la valeur
définitive, et `methode_prix` quelle règle de pricing appliquer.

### 3.2 L'analyse de teneur est déjà modélisée

`snp_analyses_teneur` porte le couple central de la conciliation :

- `teneur_declaree_pct` — la valeur provisoire, côté vendeur
- `teneur_retenue_pct` — la valeur définitive retenue
- `justification_retenue`, `retenue_par`, `retenue_le`, `decision`, `statut`
- le rattachement : `contrat_id`, `enlevement_id`, `achat_id`, `requisition_id`
- l'échantillonnage : `masse_echantillon_g`, `masse_lot_oz`,
  `methode_echantillonnage`, `lieu_prelevement`, `numero_echantillon`

La table est vide et n'a jamais été exposée. Le travail consiste à l'exposer et à
la relier à la vente, non à créer une entité concurrente.

### 3.3 Le socle transactionnel est réutilisable tel quel

- **Idempotence** : le motif `*_operation_ledger` (`idempotency_key`, `operation`,
  `request_fingerprint`, `actor_id`, `capability_code`, `response`) est déjà en
  place pour les paiements et la finance artisanale. Toute opération de
  conciliation l'adopte.
- **Ledger immuable** : `snp_artisanal_stock_ledger` donne la forme exacte à
  reprendre — `direction`, `movement_type`, `source_type`/`source_id`,
  `idempotency_key`, et surtout **`reverses_entry_id`**, qui matérialise la
  contrepassation sans jamais supprimer.
- **Écriture réservée aux RPC** : `snp_4i_require_trusted_mutation` refuse toute
  mutation directe par `anon` ou `authenticated`.
- **Audit** : `snp_ventes_evenements_audit` et `snp_decisions_approbation_audit`
  consignent acteur, rôle, statut avant et après.

---

## 4. Entités à créer

### 4.1 `snp_conciliations`

Une conciliation rattache une opération de vente à ses valeurs définitives.

Champs structurants : référence métier (`REC-AAAA-NNNNNN`), `sale_id`,
`contrat_id`, `analyse_teneur_id`, `mining_company_id`, statut, version courante,
et les deux jeux de valeurs — provisoires reprises de la vente, définitives issues
de l'analyse et du contrat.

Une vente ne peut porter qu'une conciliation non annulée : contrainte d'unicité
partielle, et non contrôle applicatif.

### 4.2 `snp_conciliations_versions`

Une conciliation validée ne se modifie pas. Toute correction produit une version :
valeurs antérieures, nouvelles valeurs, motif, acteur, date. La table porte
l'historique complet ; la conciliation ne porte que l'état courant.

### 4.3 `snp_conciliations_ecarts`

Un écart par paramètre — poids, teneur, or fin, prix, chiffre d'affaires, et une
ligne par taxe. Chaque ligne conserve valeur initiale, valeur définitive, écart
absolu et relatif, et le dépassement éventuel du seuil contractuel.

### 4.4 Référentiel fiscal généralisé

`snp_artisan_tax_policies` versionne déjà par date d'effet
(`effective_from`, `effective_until`, `source_note`) mais fige trois taux en
colonnes (`vat_rate`, `withholding_rate`, `community_rate`). Cette forme ne peut
porter ni le FNDL, ni un barème de royalties par tranches.

La généralisation conserve le principe et change la forme : une règle par taxe,
avec assiette, mode de calcul, bornes de tranche, devise de seuil, date d'effet,
référence réglementaire et statut. Le détail figure dans `TAX_ENGINE.md`.

### 4.5 Ledgers commercial et fiscal

Deux journaux d'écritures immuables, calqués sur `snp_artisanal_stock_ledger`.
Le détail figure dans `ACCOUNTING_LEDGER.md`.

### 4.6 Avoirs et imputations

`snp_avoirs_achat` existe mais ne porte ni montant utilisé ni solde : elle ne peut
pas soutenir une imputation partielle. Deux ajouts : un solde sur l'avoir, et une
table d'imputations reliant un avoir à la vente qui le consomme.

---

## 5. Périmètre exclu

Les achats d'orpailleurs auprès d'un comptoir (`snp_artisan_ventes_or`) restent
hors du moteur de conciliation, conformément au cahier des charges §C. Ils
conservent leur circuit fiscal propre, aujourd'hui le seul automatisé, servi par
`snp_artisan_tax_policies` et `snp_artisan_transition_paiement`.

La généralisation du référentiel fiscal ne doit donc pas rompre ce circuit : elle
l'englobe sans le remplacer tant que sa bascule n'est pas testée.

---

## 6. Précision et devises

Tous les montants restent en `numeric`. Aucun calcul financier ne transite par un
flottant binaire, côté base comme côté application.

Chaque opération en devise conserve la devise source, le montant source, le taux
retenu, sa source et son horodatage, ainsi que le montant en XOF. Une opération
passée n'est jamais recalculée avec un taux courant.

Le XOF n'a pas de subdivision : les montants y sont arrondis à l'unité. L'état
actuel ne le respecte pas — voir R-10 au registre des risques.

---

## 7. Points métier à confirmer

Ils n'empêchent pas de construire, le moteur étant paramétrable.

1. Taux, assiettes et affectataires opposables pour TVA, royalties et FNDL. Trois
   jeux contradictoires coexistent dans le dépôt, sans validation tracée.
2. Définition du FNDL, absent du code comme du schéma.
3. Convention d'assiette : la retenue se déduit-elle du brut ? TVA et taxe
   communale sont-elles déduites, collectées ou ajoutées ?
4. Ancrage contractuel des ventes aval : `snp_contrats` ou `customer_contracts`,
   cette dernière étant vide.
