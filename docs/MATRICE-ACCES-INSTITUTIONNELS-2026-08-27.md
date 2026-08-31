# Matrice d’accès institutionnels SONASP

Date de référence : 27 août 2026.

Cette matrice décrit le modèle effectivement implémenté dans le frontend, la fonction Edge de création de compte et la migration SQL `20260827230000_refonte_acces_institutionnels.sql`. Un droit effectif est l’intersection du rôle, de la responsabilité active, du périmètre d’organisation, de l’habilitation module/action et des règles RLS/workflow.

## Rôles et portails

| Rôle | Portail | Périmètre obligatoire | Finalité | Mutation métier par défaut |
| --- | --- | --- | --- | --- |
| Administrateur | SONASP | SONASP facultatif | Comptes, référentiels et paramètres | Aucune |
| Direction SONASP | SONASP | SONASP facultatif | Pilotage et opérations institutionnelles | Selon responsabilités |
| DGMG | DGMG | Organisation DGMG | Supervision des sites, opérateurs et productions | Selon responsabilités |
| Société minière | Opérateur | Une société minière | Production et opérations de sa société | Selon responsabilité obligatoire |
| Comptoir d’achat | Opérateur | Un comptoir | Collecte, stock et ventes du comptoir | Selon responsabilité obligatoire |
| DGI | DGI | Organisation DGI | Contrôle fiscal, taxes et rapprochement | Selon responsabilités |
| Agent Collecteur | Collecteur | Comptoir et profil collecteur | Opérations des orpailleurs rattachés | Selon responsabilité obligatoire |
| Client | Client | Compte propre | Consultation de ses opérations et documents | Aucune |

Les anciens rôles `manager`, `factory`, `airport` et `refinery` restent lisibles pour la migration. Ils ne sont plus proposés à la création. Toute modification d’un ancien compte exige une conversion explicite vers un rôle cible.

## Responsabilités métier

| Responsabilité | Rôles compatibles | Obligatoire | Actions ouvertes |
| --- | --- | --- | --- |
| SONASP Gestionnaire | Direction SONASP | Non | Créer/modifier production, achats, ventes, expéditions, raffinage, stocks, contrats, clients et documents |
| SONASP Approbateur | Direction SONASP | Non | Approuver production, achats, ventes, expéditions et raffinage |
| Finance — exécution | Direction SONASP | Non | Créer/modifier les paiements |
| Finance — rapprochement | Direction SONASP | Non | Approuver paiements et conciliations |
| Raffinage | Direction, Mine, Comptoir | Non | Suivi du domaine, sous réserve du rôle |
| Conciliation | Direction SONASP | Non | Créer/modifier les conciliations |
| Supervision DGMG | DGMG | Oui | Créer/modifier sites et artisans/opérateurs |
| Validation production | DGMG | Non | Approuver les productions |
| Gestion de la production | Société minière | Oui | Créer/modifier les opérations autorisées de sa société |
| Gestion du comptoir | Comptoir | Oui | Créer/modifier artisans, production, ventes, paiements et documents du comptoir |
| Gestion des collecteurs | Direction, Comptoir, DGMG | Non | Gérer les rattachements historisés |
| Contrôle fiscal | DGI | Oui | Contrôler/modifier taxes et rapprochements fiscaux |
| Rapprochement fiscal | DGI | Non | Approuver paiements et rapprochements |
| Collecte terrain | Agent Collecteur | Oui | Créer/modifier artisans, productions et documents rattachés |

## Séparation des fonctions

- `sonasp.prepare` et `sonasp.approve` sont incompatibles sur un même compte.
- `sonasp.finance.execute` et `sonasp.finance.reconcile` sont incompatibles sur un même compte.
- Le créateur ou demandeur ne peut pas décider sa propre demande d’approbation.
- Un résultat de raffinage n’est approuvable qu’avec une demande en attente assignée à un autre acteur.
- Une habilitation hors plafond rôle-responsabilité est refusée par le serveur, même si elle est forgée côté client.
- `Owner` et `Administrateur` ne disposent d’aucune approbation métier implicite.

## Domaines visibles par rôle

| Rôle | Domaines consultables |
| --- | --- |
| Administrateur | Tous les domaines déclarés ; mutations limitées à utilisateurs et paramètres |
| Direction SONASP | Sites, artisans, production, achats, ventes, paiements, expéditions, raffinage, stocks, conciliation, fiscalité, contrats, clients, documents, rapports, audit |
| DGMG | Sites, artisans, production, documents, rapports, audit |
| Société minière | Production, achats, ventes, paiements, expéditions, raffinage, stocks, contrats, clients, documents, rapports |
| Comptoir | Sites, artisans, production, ventes, paiements, stocks, fiscalité, documents, rapports |
| DGI | Production, ventes, paiements, conciliation, fiscalité, documents, rapports, audit |
| Agent Collecteur | Sites, artisans, production, documents, rapports |
| Client | Ventes, paiements, documents, rapports |

Tout module actif sans `access_domain` reconnu provoque un arrêt de la migration et reste refusé par défaut dans l’application.

## Portée des habilitations

Les cases `Consulter`, `Créer`, `Modifier`, `Supprimer` et `Approuver` ne peuvent qu’affiner un plafond : elles ne créent jamais un droit absent du rôle ou de la responsabilité. Les gabarits proposés sont `Aucun droit`, `Consultation seule` et `Droits recommandés`. Le changement de rôle remet à zéro les responsabilités, le rattachement et les habilitations incompatibles.
