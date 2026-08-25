# Ledgers commercial et fiscal

## 1. Principe

Un solde ne se stocke pas dans un champ que l'on écrase : il se **reconstruit** à
partir d'écritures. Aucune écriture validée n'est supprimée ni modifiée. Une
erreur se corrige par contrepassation, jamais par effacement.

Cette exigence (§37) est déjà satisfaite ailleurs dans la plateforme :
`snp_artisanal_stock_ledger` porte exactement la bonne forme, avec
`reverses_entry_id` pour la contrepassation. Les deux ledgers à créer la reprennent
plutôt que d'inventer un modèle concurrent.

## 2. Ledger commercial

Le compte courant entre deux parties : Mine ↔ SONASP, Mine ↔ client
international, SONASP ↔ client, Comptoir ↔ contrepartie éligible.

| Champ | Rôle |
|---|---|
| `id` | identité de l'écriture |
| `contrepartie_type`, `contrepartie_id` | avec qui |
| `mining_company_id` | cloisonnement organisationnel |
| `sens` | `debit` / `credit` |
| `montant`, `devise` | valeur, jamais en flottant |
| `montant_xof`, `taux_change`, `source_taux`, `taux_horodate` | conversion figée |
| `type_mouvement` | `facture_provisoire`, `facture_definitive`, `paiement`, `acompte`, `avoir`, `imputation_avoir`, `ajustement_conciliation` |
| `source_type`, `source_id` | pièce d'origine |
| `reverses_entry_id` | écriture contrepassée, si correction |
| `motif` | obligatoire pour une contrepassation |
| `idempotency_key` | interdit le doublon |
| `created_by`, `created_at` | piste d'audit |

Le solde d'une contrepartie est la somme signée de ses écritures. Un solde négatif
constate un trop-perçu, un solde positif une créance ouverte.

## 3. Ledger fiscal

Un sous-compte par mine et par taxe.

| Champ | Rôle |
|---|---|
| `mining_company_id` | la mine redevable |
| `code_taxe` | `tva`, `royalties`, `fndl`, … |
| `periode`, `exercice` | rattachement déclaratif |
| `sens` | `debit` / `credit` |
| `montant`, `devise` | valeur |
| `sale_id`, `facture_id`, `conciliation_id` | rattachement métier |
| `regle_id`, `calcul_id` | la règle et l'instantané qui justifient le montant |
| `type_mouvement` | `taxe_provisoire`, `ajustement_conciliation`, `reversement`, `compensation`, `remboursement` |
| `statut_credit` | `constate`, `disponible`, `approuve`, `utilise`, `rembourse` |
| `reverses_entry_id`, `motif` | contrepassation |
| `idempotency_key` | interdit le doublon |

Le solde fiscal d'une mine par taxe se reconstruit de la même façon. Un solde
créditeur est un trop-versé ; il ne devient compensable qu'après approbation
explicite (`TAX_ENGINE.md` §6).

## 4. Écritures produites par une validation de conciliation

En **une seule transaction**, sans état intermédiaire visible :

1. l'instantané des valeurs définitives ;
2. l'ajustement commercial — différence entre valeur définitive et valeur déjà
   facturée ;
3. un ajustement fiscal par taxe dont le montant change ;
4. la facture définitive ;
5. l'événement d'audit.

Un échec sur l'un annule tout. Une seconde validation ne produit rien de plus, la
clé d'idempotence étant portée par le journal d'opérations.

## 5. Avoirs et imputations

`snp_avoirs_achat` existe — `numero_avoir`, `facture_id`, `mining_company_id`,
`montant_fcfa`, `motif`, `statut` — mais ne porte ni montant utilisé ni solde :
elle ne peut pas soutenir une imputation partielle.

Deux compléments, sans table concurrente :

- un **solde** sur l'avoir, dérivé des imputations et non saisi ;
- une table d'**imputations** reliant un avoir à l'opération qui le consomme,
  avec montant imputé, date, acteur.

Statuts : `disponible`, `partiellement_utilise`, `utilise`, `rembourse`, `annule`.

**Concurrence.** Deux utilisateurs ne doivent jamais consommer le même avoir. Le
verrou est posé en base sur la ligne d'avoir au moment de l'imputation, et une
contrainte garantit que la somme des imputations n'excède jamais le montant
initial. Un contrôle applicatif ne suffirait pas.

## 6. Invariants vérifiables

Ils font l'objet de tests, non de commentaires :

1. Le solde d'une contrepartie est égal à la somme signée de ses écritures.
2. Le solde fiscal d'une mine par taxe est égal à la somme signée de ses écritures.
3. La somme des imputations d'un avoir n'excède jamais son montant initial.
4. Un crédit fiscal utilisé n'excède jamais le crédit approuvé disponible.
5. Le total des paiements alloués à une vente n'excède jamais sa valeur définitive
   sans produire explicitement un trop-perçu.
6. Toute écriture contrepassée porte un motif et une écriture de contrepassation.
7. Aucune écriture validée n'est supprimée : le nombre d'écritures ne décroît
   jamais.

## 7. Cas traités

**Trop-perçu** — facture provisoire 1 000 000 000, reçu 900 000 000, valeur
définitive 850 000 000. Le ledger commercial porte un solde débiteur de 50 000 000
en faveur du client : dette de la mine, remboursable ou convertible en avoir.

**Reliquat** — valeur définitive 950 000 000, reçu 900 000 000. Créance ouverte de
50 000 000, visible sur la facture, le compte client, l'échéancier.

**Trop-versé fiscal** — royalty provisoire 55 000 000, définitive 50 000 000.
Écriture de crédit de 5 000 000, statut `constate`. L'écart n'est jamais effacé ;
il attend une décision de compensation ou de remboursement.

**Sous-versement fiscal** — provisoire 50 000 000, définitive 55 000 000. Écriture
de débit de 5 000 000, visible jusqu'à régularisation.
