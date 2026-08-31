# Fiche de vente internationale et versements partiels — 30 août 2026

## Périmètre

Refonte de `/sales/:id` suivant la maquette fournie : bandeau de référence, informations générales, six onglets, cartes de détail, échéancier, synthèse financière, conciliation et documents. Conservation de la navigation SONASP et de la liste des ventes déjà refondue. Le bouton **Procéder au paiement** ouvre `/payments/create?saleId=…` avec la vente présélectionnée et le solde disponible proposé.

Les composants utilisent les données de la base, jamais les nombres d’illustration de la maquette. Le jeu synthétique `internationalSaleDetail.fixture.ts` appartient exclusivement aux tests et au banc visuel local, absent des routes applicatives.

## Diagnostic et corrections

- Le serveur acceptait déjà les règlements partiels ; le sélecteur du formulaire ne chargeait que `waiting_for_payment`. Après un premier versement, la vente passe à `virtual_payment` et disparaissait du sélecteur. Les deux états sont maintenant pris en charge, et le statut effectivement lu est transmis au contrôle optimiste.
- Les versements réels approuvés constituent le montant confirmé. Les versements `processing` réservent une partie du solde disponible, sans être présentés comme des encaissements confirmés. Les engagements virtuels, rejets et annulations ne sont pas additionnés comme des fonds reçus.
- Le registre des paiements est paginé indépendamment des ventes : les limites de réponse PostgREST ne doivent pas masquer des versements et gonfler le solde. Une erreur de chargement bloque le calcul au lieu de produire des zéros trompeurs.
- Chaque versement conserve son montant, sa référence bancaire et sa preuve privée. Un échec de dépôt permet de reprendre la preuve sans réexécuter le paiement ; l’idempotence et le contrôle des versions existants sont conservés.
- Le changement de devise efface le montant pour éviter de réinterpréter une saisie USD en EUR. Les anciennes réponses de taux de change sont ignorées après changement de sélection. Le serveur reste l’autorité du taux à la date de paiement et du contrôle cumulatif.
- Les lectures secondaires utilisent exclusivement les identifiants de la vente autorisée : paiements, expédition, vendeur, documents, lots et conciliation. Aucun élargissement de périmètre depuis une URL, aucune clé de service dans le client.
- Les profils, routes et droits existants ne sont pas contournés. L’exécution financière demeure limitée aux ventes SONASP éligibles et aux comptes disposant de la capacité sensible correspondante. Le rapprochement exige un autre acteur, y compris si l’exécutant est Owner.
- La fiche et le formulaire ne rechargent pas leurs données à chaque focus ou renouvellement équivalent du profil. Un changement réel d’identité ou de périmètre invalide l’affichage précédent et ignore ses réponses tardives.
- La liste et la fiche partagent la reconnaissance d’un ancien encaissement explicitement daté. Une vente clôturée sans preuve comptable exploitable reste « Encaissement à vérifier », sans inventer de versement.

## Décisions de présentation

- Réutilisation des composants et tokens SONASP, hiérarchie en deux colonnes, onglets distincts, navigation clavier avec déplacement du focus, adaptation mobile sans débordement global.
- Le bouton de paiement n’est proposé que si le règlement est ouvert, un solde reste disponible et la capacité financière est présente. La seule validation de gestion ne remplace pas l’accord client prévu dans le workflow existant.
- L’Incoterm, absent du modèle de vente existant, reste « — ». Aucune valeur CIF, assurance ou donnée financière n’est inventée pour imiter la capture.
- La différence de valorisation issue de la conciliation reste distincte du solde bancaire.
- La page enregistre un encaissement et son justificatif ; elle n’émet aucun virement bancaire.

## Vérifications

- Suite complète : **245 fichiers / 1 883 tests réussis**, durée 435,18 s. Après les dernières corrections de cohérence liste/fiche : **10 fichiers / 94 tests ciblés réussis** ; après le dernier ajustement des libellés : **8 tests du formulaire réussis**.
- SQL en base locale isolée `sonasp_seed_validation_live_20260830` : **19 assertions réussies** dans `international_partial_payment_flow_test.sql` (400 + 600 sur une vente de 1 000, idempotence, solde réservé, dépassement, version obsolète, preuve par versement, interdiction d’auto-approbation, clôture après rapprochement complet).
- Isolation interstructures : **19 assertions réussies** dans `international_sales_scope_test.sql` (mines distinctes, client, Owner, paiements et documents, MFA, sessions révoquées, compte inactif).
- Les tests SQL utilisent une transaction annulée en fin d’exécution. Le stockage y simule les métadonnées du gateway privé, pas un téléversement réseau de fichier.
- Contrôles visuels du composant réel sur le banc séparé : 360, 768, 1280 et 1364 px, aucun débordement global ; ouverture des onglets Paiements et Documents vérifiée.
- Compilation TypeScript, couverture des types de base et lint réussis. Dernier `npm run build` réussi (38,23 s), entrée `index-B5NXn78r.js`. `git diff --check` réussi sur les fichiers suivis du périmètre.

## Limites et livraison

Aucune migration, aucun versement et aucune preuve n’ont été créés dans la base distante pour cette demande. Les protections SQL utilisées sont celles déjà présentes ; le correctif de session active proposé lors de la précédente demande reste indépendant et non déployé à distance. Les contrôles visuels utilisent un jeu local synthétique : le parcours connecté complet avec dépôt réseau de justificatif n’a pas été exécuté sous le compte de l’utilisateur.

Le build local est servi sur le port 5180. Les modifications restent dans le workspace, sans commit ni publication distante.
