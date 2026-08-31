# Registre des ventes d’or à l’international — 30 août 2026

## Périmètre livré

Refonte de `/sales` à partir de la capture `codex-clipboard-e14e62da-2b83-4a31-8365-f8180e6508bb.png`, sans modifier les routes de création/détail, le chrome national, les portails ni les transitions métier.

- En-tête, actions, statuts, filtres, tableau compact à dix colonnes et pagination inspirés précisément de la capture.
- Facture, pays du client, structure vendeuse, licence et date d’expédition issus des relations réelles ; absence affichée explicitement, sans numéro ou date inventés.
- Recherche combinable avec statut, client, structure, dates inclusives, devise et étape métier. Le portail tenant ne propose pas de sélecteur de structure.
- Liens vers les détails existants, menu accessible au clavier, copie de référence, ouverture séparée et export XLSX de tous les résultats filtrés, pas seulement de la page visible.
- États chargement, erreur, vide et résultat filtré distincts. Le menu est rendu hors du conteneur de défilement pour ne pas être coupé quand une seule vente subsiste.
- Pas de rechargement au focus/retour d’onglet. Un changement réel de compte, rôle, e-mail, organisation ou périmètre invalide les anciennes lignes et ignore une réponse réseau tardive.

Les principes `senior-frontend`/`ui-ux-pro-max` ont guidé la réutilisation des primitives et jetons SONASP, la densité du registre, le responsive et les interactions clavier. `senior-backend` a guidé les contrôles du périmètre serveur.

## Exactitude des données

`internationalSalesListService.ts` utilise exclusivement le client connecté et les politiques RLS. Les lectures liées sont limitées aux identifiants des ventes déjà autorisées. Aucune clé privilégiée, aucun catalogue global chargé pour alimenter un filtre.

Les lectures sont paginées par lots de 500 et les listes d’identifiants découpées par lots de 100 ; une erreur interrompt le chargement au lieu de présenter un sous-ensemble comme complet.

La base stocke les quantités et prix par once troy. La présentation en grammes utilise exactement **31,1034768 g/oz**. Les valeurs de démonstration de la capture ne sont pas recopiées.

Le montant encaissé provient de `payments.amount`, dans `payments.currency`, uniquement pour `status = approved` et `is_virtual = false`. `received_amount`, exprimé dans la devise d’origine d’un virement, n’est pas additionné. Les engagements virtuels ne sont pas des encaissements. Pas de double comptage avec `sales.payment_amount` ; le résumé historique n’est utilisé qu’avec une date de réception et un statut compatible. Les devises inconnues/incompatibles et les règlements historiques non justifiés restent à vérifier.

Les ventes encore en validation ou refusées restent distinctes des ventes en attente de paiement. Un litige est rattaché à une conciliation réellement contestée.

## Cloisonnement et correctif serveur

Les lectures de `sales`, `payments` et `sales_documents` héritent du contrôle canonique `snp_peut_consulter_vente` : mine rattachée, client destinataire ou acteur SONASP habilité, avec vue consolidée Owner.

Une lacune a été reproduite sur une copie locale du schéma distant : les branches mine/client ne vérifiaient pas la session applicative révoquée. Quatre assertions échouaient avant correction (vente/paiement mine et vente/facture client).

La migration additive `20260830171500_exiger_session_active_lecture_ventes.sql` ajoute `snp_session_est_active()` à l’entrée de ce helper, sans modifier les branches de périmètre, l’AAL2, les données, les workflows ou le catalogue de permissions. Préflight, postflight, droits d’exécution minimaux et catalogue de migrations mis à jour. Aucune migration historique modifiée par ce lot.

**Cette migration est appliquée uniquement à la base de validation isolée `sonasp_seed_validation_live_20260830`, pas à Supabase hébergé.** Sa publication nécessite une autorisation explicite et la procédure de déploiement du dépôt ; ne pas pousser en bloc les autres migrations locales en attente.

## Vérifications

- Suite globale : **240 fichiers / 1 844 tests réussis** (630,87 s). Les derniers ajustements de clé de périmètre ont ensuite été vérifiés par la suite ciblée finale.
- Suite ciblée finale : **36 tests réussis** (présentation, service, filtrage, unités, règlements, export, stabilité au focus et changement de compte/e-mail).
- Base isolée : **19 assertions pgTAP réussies**, avec les véritables politiques RLS et helpers : Mine A/B, identifiant ou filtre forgé, paiements, factures, Owner, client, AAL1 refusé, sessions révoquées et compte inactif. Toutes les fixtures sont annulées par `ROLLBACK`.
- **10 tests d’intégrité des migrations réussis** ; catalogue et checksums conformes, dette historique inchangée.
- Lint global réussi ; contrôles TypeScript et build vérifiés séparément pendant le lot.
- Banc visuel isolé : largeurs de contenu 360, 768, 1134, 1208, 1364 et 1688 px. Aucun débordement global observé ; défilement horizontal limité au tableau lorsque nécessaire. À la largeur de référence : tableau 1316 px, lignes 58 px.
- Navigateur : recherche, filtrage par statut, détail des actions et focus vérifiés ; états erreur/vide/chargement distincts. Banc exécutable via `tests/visual/international-sales/README.md`, non importé par la configuration de production.

## Limites et publication

Aucune donnée métier créée, modifiée ou supprimée dans la base hébergée. Aucune donnée de démonstration ajoutée à l’application ; les fixtures sont réservées aux tests. Aucun commit, push ni déploiement distant effectué.

Le contrôle visuel porte sur le composant réel dans un banc isolé. La recette du parcours complet sous session Owner puis Mine sur le site connecté reste à effectuer : l’onglet de contrôle de la plateforme était à l’écran de connexion. Cela ne constitue pas une certification pixel-perfect de l’ensemble header/sidebar sous chaque profil.

Le serveur local statique sur 5180 lit le build. Les changements se chargent par navigation/actualisation manuelle, sans HMR ni rechargement automatique de l’onglet de travail de l’utilisateur.

Contrôle de clôture : TypeScript (schéma + compilateur) réussi, lint global et lint final ciblé réussis, build final réussi en 67 s. `http://127.0.0.1:5180/build-version.json` répond HTTP 200 avec `local-mtg3g7tf`. Aucun marqueur des fixtures de ce lot trouvé dans les assets compilés.
