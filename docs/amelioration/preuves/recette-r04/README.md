# R04 — parcours préparé, non soumis

7 septembre 2026. La reconnexion est confirmée par l’utilisateur. L’onglet Chrome connecté poursuit sa navigation, mais son contrôle par Codex échoue, y compris avec la prise en charge documentée de l’onglet. Le nouvel onglet de test arrive au login : aucune session n’est copiée entre onglets et aucun contournement d’authentification n’est utilisé. Une demande de réactivation de l’accès navigateur est en attente.

**Aucun site, responsable, document ou objet Storage R04 n’a été créé.** Le baseline de 16:21:34 UTC et le préflight sont en lecture seule. Leurs informations ne constituent pas une recette métier. Les corrections sont disponibles sur `http://127.0.0.1:5192`, build `local-mtrbrhf4`, source applicative `5d0d29f9` ; leur audit et les preuves R02/R03 sont archivés au commit local `e5776ff5`.

## Prochain parcours

1. Créer `QA20260907-R04-SITE`, planifié et non formalisé, avec deux responsables fictifs. Conserver les valeurs saisies et l’UUID retourné avant toute autre opération.
2. Vérifier le détail et la présence dans la liste sans rechargement manuel, puis comparer le parent et les deux responsables en base par UUID exact.
3. Modifier ce même site : superficie, effectif, coordonnées d’un responsable, observations, puis catégorie formalisée avec numéro AEA de test, émission `2026-09-07`, durée `12` mois. Ajouter le justificatif et une photo identifiés ci-dessous ; conserver les chemins retournés.
4. Vérifier l’enregistrement, la réouverture du formulaire, le document et la photo dans l’interface, puis leurs références et métadonnées en base. Les UUID du site et des responsables doivent rester stables.
5. Préparer un nettoyage limité aux lignes et objets réellement observés pendant ce parcours. Après vérification des dépendances, supprimer les lignes QA puis les seuls fichiers QA via Storage API. Comparer les données restantes avec le baseline. Aucune suppression par préfixe global.

Les procédures détaillées et les limites de comparaison sont dans `../../environnement/reprise-r04/README.md`. Si du temps s’est écoulé ou si l’utilisateur a saisi d’autres données, conserver le baseline historique et établir une nouvelle référence avant la première écriture ; ne pas attribuer les changements intermédiaires à R04.

## Fichiers de test réutilisables

Les deux PNG ci-dessous ont été inspectés visuellement : ils portent « DOCUMENT DE TEST » et « Sans valeur administrative », sans personne réelle. Ils ont été préparés pour R02 mais jamais téléversés pendant R02. Leur mention imprimée R02 est celle de la fixture ; elle n’est pas un numéro d’AEA ou un identifiant de la nouvelle recette.

- `../recette-r02/fixtures/photo-site.png`
- `../recette-r02/fixtures/justificatif-aea.png`

L’éventuel téléversement futur doit être enregistré dans un manifeste R04 avec le chemin exact du nouvel objet et son UUID. À la rédaction de cette note, aucun de ces fichiers n’a été sélectionné dans le formulaire R04. Aucun formulaire supplémentaire n’est déclaré validé.
