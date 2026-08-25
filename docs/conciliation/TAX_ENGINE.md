# Moteur fiscal versionné

## 1. État actuel

Le versionnement fiscal **existe déjà**, pour un seul circuit.
`snp_artisan_tax_policies` sert les ventes artisanales :

```
policy_code | effective_from | effective_until
vat_rate | withholding_rate | community_rate | source_note
```

Le principe est bon : une politique datée, bornée, justifiée par une note de
source. La forme ne l'est pas pour la cible :

- **trois taux figés en colonnes** — impossible d'ajouter le FNDL sans migration
  de schéma, ce que le cahier des charges §85 interdit précisément ;
- **aucune notion d'assiette** — le taux ne dit pas sur quoi il s'applique ;
- **aucune tranche** — un barème de royalties progressif selon le cours de l'or
  ne peut pas s'exprimer ;
- **aucun statut ni approbation** — une règle ne peut pas être préparée puis
  approuvée.

Ailleurs, les taux sont figés dans le code, en SQL comme en TypeScript. Le FNDL
est absent du schéma comme du code.

## 2. Décision

**Généraliser cette table, ne pas en créer une seconde.** Une seconde table de
taux ferait coexister deux vérités fiscales — exactement ce que la mission
interdit.

La politique artisanale devient un cas particulier du référentiel général. Sa
bascule est différée jusqu'à validation, le circuit artisanal étant aujourd'hui le
seul dont la fiscalité soit automatisée : le rompre serait une régression.

## 3. Forme cible

### 3.1 Règle fiscale

Une ligne par taxe et par période de validité :

| Champ | Rôle |
|---|---|
| `code_taxe` | `tva`, `royalties`, `fndl`, `retenue_source`, `taxe_communale` |
| `libelle` | intitulé opposable |
| `assiette` | `ca_ht`, `produit_net`, `montant_brut`, … |
| `mode_calcul` | `taux`, `tranche`, `forfait`, `exoneration` |
| `taux` | applicable si `mode_calcul = taux` |
| `seuil_min`, `seuil_max` | bornes de tranche |
| `borne_min_incluse`, `borne_max_incluse` | inclusivité explicite |
| `devise_seuil`, `unite_seuil` | ce que mesure le seuil (cours USD/oz, montant XOF…) |
| `date_effet`, `date_fin` | période d'application |
| `reference_reglementaire` | texte, arrêté, article |
| `statut` | `projet`, `approuvee`, `abrogee` |
| `categorie_acheteur` | régime particulier, exonération |
| `cree_par`, `approuve_par`, `approuve_le` | piste d'audit |

**Aucune période ne peut se chevaucher** pour un même `code_taxe` et une même
catégorie d'acheteur : contrainte d'exclusion en base, non contrôle applicatif.

### 3.2 Barème par tranches

Un barème progressif s'exprime par plusieurs lignes de même `code_taxe` et même
période, distinguées par leurs bornes :

```
royalties | tranche | seuil_min 0     | seuil_max 1000 | taux A | USD/oz
royalties | tranche | seuil_min 1000  | seuil_max 1300 | taux B | USD/oz
royalties | tranche | seuil_min 1300  | seuil_max NULL | taux C | USD/oz
```

Les valeurs de taux ne sont **pas** livrées : elles seront saisies par un acteur
habilité, avec leur référence réglementaire. Aucun taux n'est écrit dans le code.

### 3.3 Instantané de calcul

Chaque montant calculé conserve la preuve de son calcul :

| Champ | Rôle |
|---|---|
| `regle_id`, `version_regle` | la règle exacte appliquée |
| `assiette_retenue`, `montant_assiette` | la base |
| `taux_applique` | le taux effectif |
| `formule` | l'expression évaluée, lisible |
| `montant_obtenu`, `arrondi`, `devise` | le résultat |
| `calcule_le` | l'horodatage |

Une facture de 2026 reste recalculable à l'identique en 2027, la règle applicable
étant retrouvée par sa date d'effet, jamais par la règle courante.

## 4. Ce que le moteur doit expliquer

Tout montant fiscal doit pouvoir répondre : *pourquoi ce montant ?*

```
Règle appliquée : royalties, barème du <date>, réf. <texte>
Base taxable    : <montant> <devise>
Taux appliqué   : <taux> (tranche <min>–<max> <unité>)
Montant obtenu  : <montant>, arrondi à <règle>
```

## 5. Ajustement après conciliation

Lorsque la conciliation modifie le chiffre d'affaires, le moteur recalcule chaque
taxe et produit, par taxe : montant provisoire, montant définitif, écart.

L'écart alimente le ledger fiscal — jamais un champ écrasé. Un écart négatif
constate un crédit, un écart positif un reliquat. Voir `ACCOUNTING_LEDGER.md`.

## 6. Crédit fiscal : ne pas confondre constaté et compensable

Le cahier des charges §36 est explicite et le moteur doit distinguer :

```
constaté ──> disponible ──> approuvé pour compensation ──> utilisé
                        └──> remboursement demandé ──> remboursé
```

Un trop-versé fiscal n'est pas automatiquement compensable. Le passage de
*constaté* à *approuvé* exige une décision habilitée, tracée. Aucune compensation
automatique.

## 7. Non-régression du circuit artisanal

`snp_artisan_transition_paiement` inscrit aujourd'hui trois taxes à partir de
`snp_artisan_factures_definitives`. Ce circuit reste inchangé tant que la bascule
n'est pas éprouvée. La correction du 25 août — détachement du déclencheur en
double — a déjà assaini son flux.

## 8. Points bloquants pour l'exactitude, non pour la construction

Le moteur se construit sans eux ; les montants ne seront justes qu'une fois
tranchés :

1. Taux, assiettes et affectataires opposables pour TVA, royalties et FNDL.
2. Définition du FNDL. Le métier évoque 1 % du chiffre d'affaires hors taxes ;
   cette valeur reste à confirmer et sera saisie, jamais codée.
3. Convention d'assiette : la retenue se déduit-elle du brut ? TVA et taxe
   communale sont-elles déduites, collectées ou ajoutées ?

Ces règles sont marquées `projet` tant qu'elles ne sont pas approuvées, et un
calcul s'appuyant sur une règle en projet est signalé comme provisoire.
