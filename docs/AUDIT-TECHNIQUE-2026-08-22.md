# Audit technique continu — état au 22 août 2026

> Ce document distingue strictement les corrections présentes dans le dépôt,
> les fonctions effectivement déployées et les migrations encore non appliquées.
> Il ne constitue ni une homologation de sécurité ni une autorisation de mise en
> production.

## 1. Décision

**NO-GO production à ce stade.** Le lint, les tests et le build sont exploitables,
mais le typecheck strict reste en échec et l'intégrité de la base ne peut pas être
certifiée tant que les migrations de sécurité n'ont pas été appliquées et
éprouvées sur une recette restaurable.

| Barrière | Résultat du 22/08/2026 |
|---|---|
| ESLint global | réussi, 0 erreur |
| TypeScript strict | échec : dette importante dans les modules historiques et désalignement avec le schéma Supabase généré |
| Vitest complet | 108 fichiers, 881 tests réussis |
| Build Vite/PWA | réussi, 3 342 modules, 32,85 s |
| Cohérence du diff | `git diff --check` réussi |
| Migrations de sécurité en recette | non exécutées : environnement local Supabase indisponible |
| Audit des dépendances | non conclu : registre npm inaccessible (`ENOTFOUND`) |
| Recette courriel réelle | fonctions déployées, boîte de recette et réception à confirmer |

Le code peut donc être qualifié de **candidat de recette**, pas de candidat de
production.

## 2. Architecture observée

| Couche | Technologie | État |
|---|---|---|
| Interface | React 18, TypeScript strict, Vite, Tailwind | build et tests réussis ; typecheck strict en échec |
| Identité | Supabase Auth + `user_profiles` | MFA obligatoire, profil actif et `aal2` exigés |
| Session | `sessionStorage` + surveillance d'inactivité | avertissement à 9 min, fermeture à 10 min |
| Données | Supabase/PostgreSQL/PostgREST | appels directs historiques et RPC métier coexistants |
| Serveur | fonctions Edge Deno | fonctions de comptes/courriels déployées, fonctions financières durcies localement |
| Schéma | 117 migrations locales | historique distant à réconcilier avant application globale |
| Livraison | Vercel + Supabase | domaine `https://sonasp.data-univers.com` |

Les rôles applicatifs sont `owner`, `admin`, `management`, `manager`, `mine`,
`factory`, `airport`, `refinery` et `customer`. Seuls le profil actif en base,
le rôle de `user_profiles` et le périmètre organisationnel serveur font foi.

## 3. Identité, comptes, session et MFA

Le parcours cible est maintenant explicite :

```text
administrateur actif + aal2
  → création transactionnelle du compte et de ses habilitations
  → lien GoTrue envoyé par le courriel SONASP
  → choix d'un mot de passe personnel
  → enrôlement TOTP obligatoire
  → vérification aal2
  → accès au rôle et au périmètre autorisés
```

Corrections présentes ou livrées :

- aucune élévation Owner par adresse électronique ou metadata client ;
- aucune restitution ni journalisation d'un mot de passe provisoire ;
- création compensée si le courriel ne peut pas être finalisé ;
- fonctions administratives réservées à un profil interne actif en `aal2` ;
- stockage de session non persistant entre redémarrages du navigateur ;
- fermeture après dix minutes d'inactivité et avertissement à la neuvième ;
- accès métier refusé avant enrôlement TOTP et niveau `aal2` ;
- protection contre la désactivation du dernier Owner actif ;
- sélecteur de mine réservé à l'Owner, sans changement du rattachement du compte.

Le déploiement coordonné du commit `041dc99` a activé sur Supabase :
`envoyer-courriel` v6, `create-user` v4 et `reset-user-password` v2. Le secret
`SONASP_APP_URL` pointe vers `https://sonasp.data-univers.com`. Cette information
provient du contrôle de déploiement dédié ; aucun autre déploiement n'a été
effectué dans le présent lot local.

## 4. Autorisation et cloisonnement

Sept migrations correctives ont été ajoutées localement :

1. restriction de l'émission des notifications ;
2. verrouillage des profils et exigence MFA ;
3. cloisonnement des périmètres miniers ;
4. décisions de vente atomiques ;
5. création atomique des ventes export ;
6. cloisonnement des documents de vente ;
7. retrait ciblé des jeux de démonstration identifiables.

Ces migrations utilisent des contrôles serveur, le verrouillage des lignes et des
RPC pour les opérations sensibles. Elles ne sont **pas considérées actives** tant
qu'une application en recette n'a pas démontré :

- l'absence d'accès inter-sociétés ;
- l'impossibilité de modifier son propre rôle ou périmètre ;
- l'impossibilité de contourner MFA ;
- l'idempotence des décisions et de la création de vente ;
- le rollback intégral en cas d'erreur ;
- la continuité des comptes et données légitimes.

Le relevé distant réalisé au début de l'audit montrait 149 politiques d'écriture
permissives sur 65 tables et aucune politique restrictive. Une nouvelle preuve
doit être produite après application des migrations ; le frontend n'est jamais
une frontière de sécurité.

## 5. Workflows sensibles

Les décisions d'approbation, les décisions client et la création de ventes ont
été déplacées vers des RPC atomiques. Le vendeur SONASP est validé comme
institution active ; le client doit être autorisé et une raffinerie approuvée est
obligatoire pour le mécanisme `in_process`. Les documents de vente sont limités
à une vente autorisée.

Les écritures directes historiques les plus dangereuses et le service générique
de notifications ont été retirés. Les écrans ne peuvent plus court-circuiter la
sélection du client ou de la raffinerie depuis le calculateur de prix.

Les anciens vocabulaires de statuts restent à harmoniser dans les domaines fret,
douane et raffinage. Aucun renommage massif ne doit être fait avant une migration
de données et une matrice de transitions signées par le métier.

## 6. Données, cours et contenus simulés

- les cours de l'or et devises n'utilisent plus de valeur aléatoire de repli ;
- les fonctions planifiées exigent la clé de service et ne s'appellent plus avec
  la clé anonyme ;
- les taux enregistrés sont limités à EUR/USD, USD/XOF et EUR/XOF, avec la parité
  BCEAO explicitement identifiée ;
- le cours observé ne se présente plus comme un fixing officiel LBMA ;
- les anciennes fonctions de courriel fictives et les libellés Gold Shipper ont
  été supprimés ;
- les données artisanales de présentation ont été déplacées dans les fixtures de
  tests ; aucun repli de production ne fabrique désormais des sites ;
- une migration cible uniquement des lignes de démonstration identifiables. Les
  budgets sans marqueur fiable ne sont pas supprimés automatiquement et doivent
  faire l'objet d'un rapprochement métier signé.

Les factures restent marquées comme spécimens tant que la certification ou
l'intégration DGI n'est pas confirmée. Aucune revendication fiscale ne doit être
affichée avant homologation.

## 7. Qualité, performance et maintenabilité

Le type Supabase a été régénéré. Ce contrôle a révélé de nombreux contrats
historiques encore désalignés : tables ou vues absentes du schéma généré, valeurs
nullables et composants anciens. Le typecheck strict reste donc rouge. ESLint est
propre ; le build Vite réussit parce qu'il transpile sans exécuter `tsc`.

Améliorations de performance :

- suppression du recalcul réseau automatique du devis de vente à chaque frappe ;
- calcul déclenché explicitement par l'utilisateur ;
- suppression de services et écrans d'analytique simulés non opérationnels ;
- chargement par routes et découpage explicite de Recharts ;
- scripts `dev:fresh` et `build:fresh` portables sous Windows ;
- parallélisme Vitest borné pour stabiliser les contrôles locaux.

Le build avertit encore sur `recharts` (531,25 kB), le service de certificats
d'essai (487,23 kB), `xlsx` et `jspdf`. Ces modules doivent être profilés puis
chargés à la demande. La base Browserslist est également ancienne de huit mois.

## 8. Points bloquants restants

1. corriger la dette du typecheck strict sans désactiver les contrôles ;
2. réconcilier les 117 migrations locales avec l'historique du projet Supabase ;
3. restaurer une copie anonymisée en recette et exécuter les sept migrations ;
4. rejouer la matrice RLS par rôle et par société ;
5. rapprocher manuellement les budgets et autres lignes sans marqueur de démo ;
6. tester réellement réception, expiration et réutilisation impossible des liens
   de bienvenue/récupération ;
7. homologuer la chaîne de facture et ses obligations DGI ;
8. exécuter l'audit de dépendances dès que le registre npm est accessible ;
9. réaliser un test de restauration et documenter le RPO/RTO ;
10. rejouer en E2E les chaînes production → expédition → vente → paiement.

## 9. Critères de passage au GO

Le GO ne peut être prononcé que si chaque point bloquant possède une preuve datée,
un responsable et un résultat reproductible. Le build vert et les 881 tests sont
nécessaires, mais ne remplacent ni la recette de sécurité en base, ni le contrôle
des données financières, ni la restauration.
