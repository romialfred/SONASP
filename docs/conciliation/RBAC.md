# Habilitations — Conciliation et fiscalité

## 1. Socle existant

`snp_capability_catalog` compte 31 capacités réparties sur dix-sept domaines
(`sonasp`, `mine`, `comptoir`, `collector`, `artisan`, `freight`, `accounts`,
`reports`, `workflow`, …). Aucune ne concerne la conciliation ni la fiscalité :
`reconciliation.*` et `tax.*` sont à créer.

Le mécanisme d'évaluation est en place et ne change pas.
`snp_actor_has_capability` applique dans l'ordre :

1. `service_role` passe ;
2. profil actif exigé ;
3. capacité devant exister au catalogue ;
4. **capacité sensible refusée sans MFA satisfaite** ;
5. `manager` restreint à la lecture ;
6. dérogation explicite par `snp_user_capabilities`, bornée dans le temps ;
7. `owner` passe ;
8. sinon, table `snp_role_capabilities`.

Les nouvelles capacités s'inscrivent dans ce mécanisme ; aucune logique
d'autorisation parallèle n'est créée.

## 2. Capacités à créer

| Code | Sensible | Objet |
|---|---|---|
| `reconciliation.read` | non | consulter les dossiers de son périmètre |
| `reconciliation.create` | oui | ouvrir un dossier |
| `reconciliation.edit` | oui | saisir les résultats acheteur |
| `reconciliation.submit` | oui | soumettre à validation |
| `reconciliation.approve` | oui | valider les valeurs définitives |
| `reconciliation.reject` | oui | refuser une soumission |
| `reconciliation.dispute` | oui | contester un résultat |
| `reconciliation.close` | oui | clore un dossier soldé |
| `reconciliation.export` | non | exporter |
| `reconciliation.tax.adjust` | oui | ajuster une écriture fiscale |
| `reconciliation.credit.apply` | oui | imputer un avoir |
| `tax.rules.read` | non | consulter le référentiel fiscal |
| `tax.rules.manage` | oui | créer et approuver une règle fiscale |

Toute capacité modifiant une valeur financière ou fiscale est **sensible**, donc
soumise à MFA côté serveur.

## 3. Séparation des tâches

Le principe maker/checker s'applique aux opérations financières :

- `reconciliation.submit` et `reconciliation.approve` ne peuvent être exercées
  **par le même acteur sur le même dossier**. Le contrôle porte sur `auth.uid()`
  comparé à l'acteur ayant soumis, côté serveur.
- `tax.rules.manage` couvre création et approbation, mais une règle ne peut être
  approuvée par son auteur : `cree_par` et `approuve_par` doivent différer.
- `reconciliation.credit.apply` est distincte de `reconciliation.approve` : imputer
  un avoir n'est pas valider une conciliation.

## 4. Cloisonnement organisationnel

Une mine ne voit que ses dossiers, un comptoir que les siens, un client que les
opérations qui le concernent. Le filtre est posé côté serveur, jamais par masquage
d'un bouton.

**Réserve.** Le prédicat `snp_est_agent_sonasp()` ne reconnaît aujourd'hui que le
rôle `management`, via quatre capacités sensibles — et **aucun compte `management`
n'existe en production**. S'en servir tel quel pour cloisonner priverait `admin`,
`manager`, `factory`, `airport` et `refinery` de tout accès. C'est la raison pour
laquelle la migration de cloisonnement a été écartée (D-005).

Le cloisonnement de la conciliation utilisera donc un prédicat aligné sur l'état
réel des capacités, vérifié par test négatif avant déploiement : un compte de
chaque rôle doit voir ce qu'il doit voir, et rien de plus.

## 5. Attribution par rôle

L'attribution définitive relève du commanditaire. La proposition, à confirmer :

| Rôle | Capacités |
|---|---|
| `owner` | toutes, par la règle existante |
| `management` | lecture, création, édition, soumission, validation, rejet, clôture, ajustement fiscal, imputation d'avoir |
| `admin` | lecture, export, gestion du référentiel fiscal |
| `manager` | lecture et export seuls, conformément à la restriction existante |
| `mine` | lecture et soumission sur ses propres dossiers |
| `comptoir` | lecture sur les opérations éligibles |
| `customer` | lecture des dossiers le concernant |

`management` n'ayant aucun titulaire en production, l'ouverture du module suppose
d'en habiliter au moins un — sans quoi aucune conciliation ne pourra être validée.
C'est un point d'exploitation à traiter avant mise en service.

## 6. Audit

Toute opération sensible consigne acteur, rôle, organisation, horodatage, valeurs
antérieures et nouvelles, motif, objet concerné, et le `capability_code` exercé —
comme le font déjà les journaux existants. L'audit est écrit par le serveur et
demeure immuable pour le demandeur.
