# Sites artisanaux : création, AEA et conformité

## Utilisation

La rubrique **Sites artisanaux & Artisans** regroupe le registre artisanal. Le type d’exploitation est fixé à **Site artisanal**. La DGMG et l’administrateur peuvent créer les sites artisanaux, sociétés minières, comptoirs et artisans ; l’accès global Owner est conservé. Les habilitations de module et la MFA continuent de s’appliquer.

1. Ouvrir le registre et choisir **Enregistrer un site**.
2. Compléter l’identification, la localisation, la capacité et les deux responsables.
3. Choisir **Site formalisé** ou **Site non formalisé**. Un site formalisé nécessite le numéro d’AEA, la date d’émission, une durée en mois et un justificatif PDF/JPEG/PNG de 10 Mo maximum. L’échéance est calculée en mois calendaires, avec ajustement au dernier jour du mois lorsque nécessaire.
4. Enregistrer. La fiche détaillée s’ouvre et les listes se rechargent au retour, sans actualisation manuelle du navigateur.
5. Utiliser **Modifier la fiche** pour compléter ou corriger les données. L’AEA déjà déposée est conservée si aucun fichier de remplacement n’est choisi.

Les anciens dossiers ont la catégorie **À renseigner** : une catégorie n’est pas déduite de l’absence de données historiques. Leur ancienne classification d’exploitation est conservée dans `legacy_exploitation_type` lors de l’unification du registre.

## Lecture du tableau opérationnel

Les onglets **Tous**, **Formalisés**, **Non formalisés**, **À surveiller** et **Suspendus** filtrent la liste du bas. Les onglets de catégorie utilisent la valeur enregistrée dans la fiche ; les dossiers historiques **À renseigner** restent accessibles dans **Tous**. Les filtres de supervision s’appliquent également à cette liste. **Réinitialiser** rétablit tous les filtres et l’onglet **Tous**. Les actions de l’en-tête sont **Actualiser** et **Enregistrer un site** ; l’export a été retiré.

| Colonne | Signification |
| --- | --- |
| Site | Nom enregistré du site, puis code et catégorie de formalisation. Le nom ouvre la fiche détaillée. La localité reste une donnée géographique et ne remplace pas le nom. |
| Région | Rattachement géographique enregistré. |
| Statut | Planifié, Actif ou Suspendu. Un site actif dont l’indice est inférieur à 80 apparaît **À surveiller**. |
| Artisans / Capacité | Nombre d’artisans actifs déclaré dans la fiche / capacité autorisée. La barre représente le taux d’occupation. Ce compteur n’est pas calculé à partir du nombre de fiches artisan. |
| Production | Somme en kilogrammes des ventes d’or non annulées rattachées au site sur la période sélectionnée. Le rattachement explicite de l’artisan est prioritaire ; la localité sert de repli historique. |
| Conformité | Indice opérationnel calculé automatiquement. **Non évalué** remplace l’ancien libellé **En attente** pour les sites planifiés. |
| Taxes déclarées | TVA et taxe de développement communautaire portées par les ventes rattachées, sur la période sélectionnée. L’ancien libellé « Taxes recouvrées » ne correspondait pas au calcul : celui-ci ne vérifie pas l’encaissement. |
| Dernière déclaration | Date de la dernière vente non annulée connue, indépendamment du filtre de période. **Aucune déclaration** signifie qu’aucune vente non annulée n’est rattachée au site ; cela ne décrit pas son statut d’exploitation. Une date inexploitable affiche **Date indisponible**. |
| Menu ⋮ | Ouvre la fiche et ses onglets Vue d’ensemble, AEA et documents, Conformité. |

## Calcul et suivi

La formule existante est conservée et part de 100 points :

- Occupation supérieure à 100 % : retrait du dépassement exprimé en points de pourcentage, plafonné à 25 points.
- Occupation inférieure à 50 % : retrait de 8 points.
- Dernière déclaration de plus de 30 jours : retrait de `(jours écoulés − 30) / 3`, plafonné à 30 points. Aucune déclaration : retrait de 30 points.
- Site suspendu : retrait de 45 points.

Le résultat est arrondi et limité entre 0 et 100. Un site planifié n’est pas évalué. L’onglet **Conformité** affiche les observations, les règles et les déductions utilisées pour le site consulté.

Exemple : un site actif occupé à 80 %, sans déclaration, obtient **70 points**. Un site planifié affiche **Non évalué**, même si des artisans sont déjà renseignés.

Pour commencer l’évaluation, renseigner la fiche puis passer le statut à **Actif lorsque l’exploitation démarre réellement**. Rattacher les artisans au site et enregistrer leurs ventes dans les écrans habituels : le score s’actualise à partir de ces données. Aucun pourcentage ne se saisit manuellement.

La catégorie de formalisation et les dates AEA sont distinctes de cet indice. L’application affiche une AEA en cours de validité, à venir, expirée ou incomplète à partir des informations saisies. **Ce calcul ne constitue pas une décision administrative de validation de l’AEA.** Aucun circuit d’approbation réglementaire n’a été inventé dans cette évolution.

## Activation technique

**Déployé le 6 septembre 2026** sur `https://sonasp.data-univers.com` : migration enregistrée, fonction `sensitive-upload` version 5 ACTIVE et frontend `local-mtpnxi2f`. Le reçu de vérification est conservé dans [sites-artisanaux-deployment-2026-09-06.receipt.json](audits/sites-artisanaux-deployment-2026-09-06.receipt.json).

Le correctif d’alignement des actions, de suppression de l’export et d’ajout des onglets de catégorie est publié dans le frontend `local-mtpogc52`, sans modification de la base. Voir [sites-ui-deployment-2026-09-06.receipt.json](audits/sites-ui-deployment-2026-09-06.receipt.json).

Ordre de mise en service :

1. Appliquer uniquement `20260906093115_sites_artisanaux_formalisation_aea.sql` au projet cible, puis enregistrer cette version dans l’historique des migrations.
2. Déployer la fonction Edge `sensitive-upload`, qui autorise aussi les pièces des sociétés minières pour les gestionnaires du registre.
3. Livrer le frontend issu de `npm run build`.

La migration crée le bucket privé AEA, les contraintes documentaires, la sauvegarde transactionnelle du site et des responsables, ainsi que les règles d’accès. Les écrans Sociétés minières et Comptoirs du portail DGMG sont rattachés au module Sites déjà attribué, sans ouvrir l’administration générale des parties prenantes. Les éventuelles restrictions individuelles restent gérables dans l’administration des habilitations.

Le script `scripts/test-artisanal-site-migration.mjs` vérifie les principaux scénarios PostgreSQL dans une base PGlite isolée. Son socle de test couvre les objets concernés ; il ne remplace pas le rejeu de toutes les migrations historiques Supabase.
