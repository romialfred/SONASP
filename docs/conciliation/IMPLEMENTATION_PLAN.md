# Plan d'implémentation

Ordonné par dépendance réelle, non par confort. Chaque incrément est livrable
seul, testé, et ne laisse pas la plateforme dans un état intermédiaire.

---

## Prérequis déjà traités

| Sujet | État |
|---|---|
| SSRF non authentifiée | fermée en production |
| Élévation de privilège et franchissement de tenant | fermées en production |
| Chaîne de vente export (4 RPC, colonnes, déclencheur) | rétablie en production |
| Double réclamation fiscale, 16,57 M FCFA | corrigée en production |
| Privilèges hors RLS | retirés en production |

Sans la chaîne de vente, aucun incrément ci-dessous n'aurait de support.

---

## Incrément 1 — Référentiel fiscal versionné

**Contenu.** Généraliser `snp_artisan_tax_policies` : table de règles par taxe,
assiette, mode de calcul, bornes de tranche, date d'effet, référence
réglementaire, statut, auteur et approbateur. Contrainte d'exclusion interdisant
tout chevauchement de périodes pour un même code de taxe et une même catégorie
d'acheteur. Table d'instantanés de calcul. Capacités `tax.rules.read` et
`tax.rules.manage`.

**Ne fait pas.** Ne bascule pas le circuit artisanal, aujourd'hui le seul
automatisé. Ne livre aucun taux : ils seront saisis avec leur référence.

**Fini quand.** Une règle se crée, s'approuve par un autre acteur, se retrouve par
sa date d'effet ; un calcul de 2026 reste reproductible après modification du
barème en 2027 ; aucun chevauchement n'est acceptable en base.

---

## Incrément 2 — Ledgers commercial et fiscal

**Contenu.** Deux journaux d'écritures immuables calqués sur
`snp_artisanal_stock_ledger`, avec `reverses_entry_id` et clé d'idempotence.
Fonctions de reconstruction de solde. Écriture réservée aux RPC de confiance par
`snp_4i_require_trusted_mutation`.

**Fini quand.** Les sept invariants d'`ACCOUNTING_LEDGER.md` §6 sont couverts par
des tests ; un solde se reconstruit exclusivement depuis les écritures ; aucune
écriture validée ne peut être supprimée.

---

## Incrément 3 — Assay exposé

**Contenu.** Exposer `snp_analyses_teneur`, qui existe et n'a jamais servi. RPC de
saisie et de consultation, rattachement à la vente et au contrat, pièce jointe par
la voie sensible, contrôle de présence d'assay lorsque le contrat l'exige.

**Dépendance externe.** La fonction `sensitive-upload` n'est pas déployée (R-11).
Elle est la voie prévue pour le rapport de laboratoire : son déploiement conditionne
cet incrément.

**Fini quand.** Une analyse se saisit avec sa pièce, se rattache à une vente, et la
validation est refusée sans preuve quand le contrat l'exige.

---

## Incrément 4 — Moteur de conciliation

**Contenu.** `snp_conciliations`, ses versions et ses écarts. Machine à états
complète et transitions contrôlées côté serveur. RPC transactionnelle de
validation produisant en une fois : instantané, écriture commerciale, écritures
fiscales, facture définitive, audit. Séparation soumission / validation.
Capacités `reconciliation.*`.

**Fini quand.** Une double validation ne produit aucun doublon ; une conciliation
validée ne se modifie plus, une correction créant une version ; un échec en cours
de validation ne laisse aucun état partiel.

---

## Incrément 5 — Facturation provisoire et définitive

**Contenu.** Facture définitive référençant facture provisoire, expédition,
contrat et conciliation, affichant valeur définitive, déjà facturé, déjà reçu,
ajustements et solde. Numérotation sans collision, sur le motif de verrou
consultatif déjà employé par `snp_creer_vente_export`. Versionnage.

**À corriger au passage.** L'audit relève un net serveur — brut moins retenue —
divergeant du net imprimé — HT plus TVA plus taxes moins acompte. Sur 1 000 000
bruts : 950 000 enregistrés, 1 190 000 imprimés. À trancher avec la convention
d'assiette (point métier ouvert) avant d'imprimer une facture définitive.

---

## Incrément 6 — Avoirs, imputations et paiements

**Contenu.** Solde et imputations sur `snp_avoirs_achat`. Allocation des paiements
à une vente. Verrou en base sur l'avoir lors de l'imputation, contrainte
garantissant que la somme des imputations n'excède jamais le montant initial.

**Fini quand.** Deux utilisateurs tentant d'imputer le même avoir : un seul
réussit, prouvé par test de concurrence.

---

## Incrément 7 — Cloisonnement multi-tenant

**Contenu.** Poser le cloisonnement écarté en D-005, avec un prédicat aligné sur
l'état réel des capacités et non sur la version du 22 août.

**Condition d'acceptation.** Test négatif par rôle avant déploiement : un compte de
chaque rôle voit ce qu'il doit voir et rien de plus. Le critère de rejet est établi :
sur le miroir, un agent national ne voyait plus que 0 production sur 221.

---

## Incrément 8 — Cockpit, rapports et alertes

**Contenu.** Tableau de bord, page de détail à onglets, file des opérations à
concilier avec filtres, rapports par mine, par client et par période, exports
contrôlés, alertes de `WORKFLOWS.md` §10.

**Contrainte.** Aucun écran ne précède son service. Aucun bouton décoratif. Les
listes sont paginées et filtrées côté serveur.

---

## Incrément 9 — Dette révélée par l'audit

Traitée en continu plutôt qu'en fin de parcours :

- interfaces divergeant des types générés, dont quatre incompatibilités dans
  `ShippingPreparationNew` et 20 relations absentes de `src/types/database.ts` (R-07) ;
- montants non arrondis en XOF dans l'historique (R-10) ;
- fonctions Edge non déployées, 7 sur 14 (R-11) ;
- table `publications` appelée par la vitrine et absente du schéma (R-12).

---

## Ordre et parallélisme

Les incréments 1 et 2 sont indépendants et peuvent avancer de front. Le 3 dépend
du déploiement de `sensitive-upload`. Le 4 dépend de 1, 2 et 3. Le 5 dépend de 4 et
de la convention d'assiette. Le 6 dépend de 2. Le 7 est indépendant mais conditionné
par son test négatif. Le 8 vient en dernier, aucun écran ne devant précéder son
service.

## Points métier ouverts

Ils n'arrêtent pas la construction, le moteur étant paramétrable, mais conditionnent
l'exactitude des montants :

1. Taux, assiettes et affectataires opposables pour TVA, royalties et FNDL.
2. Définition du FNDL.
3. Convention d'assiette de la retenue et des taxes.
4. Ancrage contractuel des ventes aval.
5. Habilitation d'au moins un compte `management`, sans quoi aucune conciliation
   ne pourra être validée.
