# Audit préproduction SONASP — 1er septembre 2026

## Décision exécutive

**Décision actuelle : NO-GO production. Note de préparation : 54/100.**

Le dépôt contient une plateforme fonctionnelle importante, plus de 100 routes privées et une couverture de tests substantielle. Il ne s'agit pas d'une simple maquette. En revanche, la production n'est pas autorisable tant que les P0 ci-dessous ne sont pas clos sur une base miroir puis vérifiés par des scénarios multitenants réels.

La note est un score de sortie, pas une note esthétique :

| Axe | Note | Critère bloquant |
|---|---:|---|
| Sécurité / RBAC / RLS | 11/20 | historique RLS non reproductible et droits Admin encore partiellement découplés des contrôles serveur |
| Base / intégrité | 8/20 | création fret non atomique, allocation physique sur-allouable |
| Workflows interportails | 9/20 | vente export pas systématiquement adossée au stock physique, conciliation non consommée par le solde exigible |
| UI / accessibilité / cohérence | 13/20 | primitives accessibles incomplètes, statuts et langues fragmentés |
| QA / livraison / exploitation | 13/20 | tests solides, mais migration catalogue en échec et CI historiquement limitée |

Le score cible **100/100** signifie : zéro P0/P1 ouvert, reconstruction/upgrade de base convergents, tests multitenants et métier complets, contrôle navigateur des portails, build reproductible, rollback testé et reçu de déploiement signé.

## Mise à jour d'implémentation et contre-analyse

Les corrections suivantes ont été réalisées après l'audit initial. La décision
reste **NO-GO** tant que la reconstruction complète de la base, la suite globale
et les contrôles navigateur multirôles ne sont pas tous conclusifs.

| Lot | Correction mise en œuvre | Preuve indépendante obtenue |
|---|---|---|
| Fret | Création parent/enfants atomique et idempotente, aucune ligne partielle | pgTAP PostgreSQL réel 43/43 ; rejeu identique ; échec enfant = zéro parent |
| Préparations | Verrouillage des productions, conservation brut/net/or fin, refus de surallocation | pgTAP 38/38 ; deux allocations concurrentes de 600 g sur 1 000 g : une seule acceptée |
| Vente / stock physique | Adossement exact achat → production → fret en stock → `gold_inventory` ; verrou commun Vente/Réserve | pgTAP 24/24 et Vitest 5/5 ; courses Vente/Réserve testées dans les deux ordres |
| Paiements | Agrégat recomposé depuis les seuls paiements actifs ; rejet/annulation retirés du payé | scénarios PostgreSQL réels et tests structurels réussis |
| Conciliation | `final_proceeds` canonique, solde exigible partagé, avoir du trop-perçu unique et idempotent, plafond concurrent | pgTAP 48/48 ; deux paiements concurrents plafonnés ; rejeu de conciliation sans doublon |
| Productions engagées | Gel des 11 attributs physiques/identitaires après allocation d'achat ; notes encore modifiables | pgTAP 40/40 ; courses allocation/modification vérifiées dans les deux ordres |
| Création de comptes | Saga GoTrue/base idempotente, écritures PostgreSQL regroupées en RPC, compensation vérifiée, hiérarchie Owner/Admin en base | pgTAP 30/30 ; runtime Edge 31/31 ; lot ciblé 97/97 |
| Réserve nationale | Snapshot daté et sourcé des cours, XOF strict, activation dédiée et idempotente | tests structurels et service réussis ; validation PostgreSQL réelle encore en cours |
| Accessibilité | Onglets, tableaux, modales, champs, combobox et `PageHeader` renforcés | 8 fichiers / 27 tests d'accessibilité réussis |

Limites maintenues explicitement : les sources artisan/comptoir ne sont pas
vendables tant qu'un chemin physique autoritatif jusqu'au fret et au stock
raffiné n'existe pas ; les ventes historiques non adossées sont placées en
registre de remédiation bloquant, jamais rattachées par supposition.

## P0 — corrections obligatoires avant production

### P0-1 — Reproductibilité des migrations

Le catalogue historique contient des versions à 8 et 14 chiffres, des collisions de préfixes et des fichiers non canoniques. Un ancien SQL peut recréer des policies ouvertes `USING(true)` après un durcissement tenant si l'ordre d'application n'est pas strictement celui attendu.

Actions :

1. Ne renommer aucune migration déjà appliquée.
2. Créer une baseline canonique issue du schéma de référence.
3. Ajouter une migration finale idempotente de réconciliation des ACL, fonctions et policies.
4. Tester base vierge et upgrade depuis une copie historique.
5. Comparer le schéma final aux empreintes du schéma cible.

Critères de fermeture : catalogue sans dérive nouvelle, `db reset` réussi, upgrade miroir réussi, policies Mine A/Mine B prouvées.

### P0-2 — Workflow fret et douane

Constats initiaux : fallback de statut par `UPDATE` direct si la RPC manque, enfants permissifs, contenu modifiable après approbation, auteur pouvant approuver, absence d'idempotence et d'audit systématique.

Lot déjà implémenté :

- suppression définitive du fallback DML navigateur ;
- clé canonique de statut douanier ;
- mutation shipping déléguée à la RPC transactionnelle ;
- habilitation effective du module Shipping ajoutée aux transitions ;
- séparation créateur/approbateur ;
- gel du contenu commercial/logistique après approbation ;
- clé de requête, verrou optimiste et événement d'audit ;
- RLS des productions/signataires héritée du parent et écriture limitée au statut `pending`.

Reste bloquant : remplacer la création séquentielle parent → productions → signataires par une RPC atomique et idempotente. Un échec enfant doit laisser **zéro** parent.

### P0-3 — Quantité physique des préparations

Une production peut encore être liée à plusieurs préparations sans garantie transactionnelle que la somme des poids n'excède pas le lingot source.

Correction attendue : verrou sur la production, règle explicite lot indivisible/fractionnable, contrôle cumul brut/net/or fin et recalcul lors d'une modification/suppression.

Tests : somme exacte acceptée, dépassement refusé, deux allocations concurrentes dont une seule réussit, lot annulé/non prêt refusé.

### P0-4 — Vente export et stock réel

La capacité exportable peut provenir d'un achat acquis sans preuve que le métal est reçu, raffiné et entré au stock. Vente et Réserve doivent verrouiller le même actif physique.

Correction attendue : actif canonique de `gold_inventory`, ou fret admissible explicitement réservé pour le seul cas `in_process`. Un lingot réservé ne peut être vendu et un lingot vendu ne peut être affecté à la Réserve.

Tests : achat sans stock refusé, fret traité + stock accepté, concurrence vente/réserve atomique, stock réservé refusé.

## P1 — risques élevés

### Gestion des comptes et habilitations

Le resolver `snp_actor_can_module_action` est correct, mais n'était pas utilisé par toutes les fonctions Edge. Le lot courant impose désormais : session active, capacité `accounts.manage`, puis droit effectif `administration` pour l'action exacte.

À généraliser à chaque RPC/RLS métier encore fondée uniquement sur le rôle ou une capacité statique. Matrice obligatoire : Owner permanent, Admin tous droits, Admin lecture seule, Admin aucun droit, révocation immédiate et appels API forgés.

La création de compte reste une saga Auth + écritures PostgreSQL. Les écritures profil/organisation/memberships/responsabilités/permissions doivent être regroupées dans une RPC transactionnelle ; la frontière GoTrue/base doit utiliser une clé idempotente et une compensation vérifiée.

### Suppression des ventes

La suppression directe par simple Owner/Admin a été retirée du chemin applicatif par la migration `20260901130000_interdire_suppression_directe_ventes.sql`. Une vente réglementaire doit être annulée par transition auditée, jamais supprimée physiquement.

### Achats et productions

Les attributs d'une production déjà allouée à un achat restent modifiables dans certains statuts. Il faut verrouiller poids, teneur, date et société dès l'allocation active, ou recalculer toutes les allocations sous verrou.

### Conciliation et paiement

La conciliation calcule des impacts commerciaux/fiscaux, mais le paiement continue de contrôler le montant historique de la vente. Créer un solde exigible canonique : valeur nette + ajustements débit − crédits/imputations. Échéancier, formulaire de paiement et statut de vente doivent lire cette même fonction.

### Agrégats de paiement

Après rejet/annulation, les agrégats de vente peuvent conserver un montant présenté comme payé. Une seule fonction serveur doit recomposer les agrégats depuis les paiements aux statuts autoritatifs après chaque transition.

### Réserve nationale

La valorisation doit figer le cours, sa date et sa source au jour de l'affectation. Le mélange XAF/XOF doit être interdit ou régi par une règle versionnée. L'activation doit disposer d'une capacité dédiée, d'un statut attendu et d'une clé d'idempotence.

## UI/UX, formulaires et accessibilité

Évaluation statique initiale : design system 68/100, navigation 75/100, formulaires 66/100, statuts 55/100, responsive 72/100, WCAG 58/100, états 75/100, cohérence linguistique 45/100.

Lot déjà implémenté :

- onglets : déplacement réel du focus, flèches, `Home` et `End` ;
- tableaux interactifs : accès clavier par `Tab`, `Entrée` et `Espace` ;
- modale partagée : nom accessible, focus initial, confinement, `Escape`, restauration du focus et conservation du scroll ;
- `Input`, `Select`, `TextArea` : erreur/aide reliée par `aria-describedby` ;
- tableaux de bord : sortie garantie du loader et action de reprise en cas de rejet inattendu.

Reste prioritaire : combobox ARIA complète, contrastes des petits textes/badges, `PageHeader` en `h1`, suppression des erreurs SQL/PostgREST brutes, politique linguistique unique, migration des pages `MainLayout`, validation responsive 360/768/1366/1440/1920 et zoom 200 %.

## Statuts métier

Une divergence concrète a été corrigée : `waiting_customs_approval` n'existe pas dans l'enum de la base ; la clé unique est `waiting_for_customs_approval`. Le service unifié ne fait plus d'`UPDATE` direct et délègue à `snp_transition_shipping_preparation`.

Reste à supprimer les registres concurrents et à dériver libellé, couleur et transitions d'une source typée par domaine, alignée sur les enums PostgreSQL.

## DevOps et qualité

Constats : la CI historique ne contrôlait que le catalogue de migrations et seulement sur `main`. Un workflow `quality-gates.yml` a été ajouté pour lint, TypeScript, tests, audit npm et build sur PR, `main` et `SONASP_2026`.

Résultats vérifiés pendant l'audit :

- `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité ;
- lint : réussi avant le lot, nouvelle exécution en cours au moment de cette édition ;
- typecheck : réussi avant le lot ;
- build production/PWA : réussi avant le lot ;
- suite complète avant le lot : 267 fichiers, 2 065 tests réussis ;
- tests ciblés du lot : statuts, fret, Edge admin, accessibilité et loaders réussis ;
- intégrité migrations : échec attendu tant que les nouvelles migrations ne sont pas validées et cataloguées.

## Ordre d'implémentation retenu

1. Fermer les P0 fret/RLS et rendre la création atomique.
2. Fermer la sur-allocation des productions.
3. Unifier l'actif physique Vente/Réserve.
4. Raccorder conciliation, solde exigible et agrégats de paiement.
5. Finaliser IAM transactionnel et brancher le resolver aux RPC/RLS restantes.
6. Terminer les primitives WCAG et les pages legacy.
7. Construire et tester la baseline de migrations sur miroir.
8. Exécuter E2E multitenant, charge, sauvegarde/restauration et rollback.
9. Recalculer la note. Toute note inférieure à 100/100 déclenche une nouvelle itération.

## Conditions de déploiement

Aucun déploiement production ne doit être exécuté depuis cet état. Le déploiement sera autorisé uniquement après :

- zéro P0/P1 ;
- lint, typecheck, suite complète et build verts après le dernier changement ;
- catalogue migrations vert ;
- migration miroir et rollback testés ;
- preuves E2E Owner/Admin/Mine/DGI/DGMG/Comptoir ;
- reçu de versions locales/distantes et surveillance post-déploiement.
