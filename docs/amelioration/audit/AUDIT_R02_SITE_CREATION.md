# R02 — audit borné de création d'un site

7 septembre 2026. **Création et persistance du dossier observées ; recette complète du module non terminée.** Cet audit lit uniquement des fichiers de preuve locaux. Il n'a exécuté aucune requête SQL distante, écriture métier ou interaction navigateur.

## Périmètre vérifié

RUN `QA20260907-R02`, site `d9f7160a-aadd-41d9-ad4d-c9f886d41e0c`, nom `QA20260907-R02-SITE`, code `SA-CEN-2026-0004`. La fiche est planifiée, artisanale et non formalisée, avec capacité 10 et effectif 2. Les captures identifient le contexte Administrateur ; elles ne constituent pas un test de tous les autres rôles.

Le coordinateur rapporte la création dans Chrome. Les artefacts relus sont : formulaire avant soumission, détail avec confirmation « Le site et ses responsables ont été enregistrés », liste retrouvant le site sous son vrai nom, attendu de saisie, SQL exact par UUID/préfixe, résultat et reçu de lecture SQL, comparaison de l'opérateur. Les trois PNG ont été inspectés visuellement par l'auditeur.

La base rapporte la création à `12:14:16.805103+00:00` et la relecture à `12:18:23.612405+00:00`. Le reçu local annonce exit0 et READ ONLY. Les horloges du poste et du serveur diffèrent légèrement ; ne pas déduire une latence précise de leur soustraction.

## Contrôle indépendant exécuté

Commande locale : `node docs/amelioration/audit/verify-r02-site-creation.mjs`.

Résultat : **PASS**, empreintes des onze artefacts stables avant/après. Preuve : `r02-site-creation-independent.evidence.json`.

- UUID, type et préfixe exacts ; SHA256 du SQL conforme au reçu d'exécution.
- Dix-huit champs parent conformes à l'attendu enregistré séparément ; aucune reprise aveugle de l'assertion PASS de l'opérateur.
- Exactement deux responsables, appariés par rôle, noms/téléphones/e-mails conformes, deux IDs distincts et rattachement au bon site. La date de création des deux contacts correspond à celle du site.
- Les deux contacts sont également présents dans le texte accessible du détail après sauvegarde. La liste accessible contient le nom et le lien vers le bon UUID ; le PNG montre cette ligne.
- Tableau photos vide, aucun objet Storage rattaché, cinq champs AEA NULL. Ces absences sont cohérentes avec le dossier non formalisé ; elles ne prouvent aucun upload.
- Six relations contrôlées : deux lignes d'affectation, zéro production, origine de vente, artisan rattaché, vente de collecteur ou rattachement de collecteur pour cet UUID.

Les IDs des contacts sont `12bd6c4e-52f4-4e9d-a2aa-81e101ab5e12` et `d585b8e2-8f0c-4acd-bb90-bfd03acd6a8c`. Ils serviront à vérifier la conservation des identités lors d'une éventuelle édition ; aucune édition n'est certifiée ici.

## Limites de la preuve

La capture `site-03-liste-sans-rechargement.png` montre l'onglet **Tous**, tandis que le texte accessible associé montre **Non formalisés** sélectionné. La ligne du site existe dans les deux états. Les deux artefacts peuvent documenter deux instants successifs, mais ne doivent pas être présentés comme une paire simultanée ni comme preuve de sélection du même onglet. Aucun fichier n'a été modifié pour effacer cette différence.

Le nom « sans rechargement » du fichier et le récit du coordinateur ne remplacent pas une chronologie de navigation. Un manifeste doit rattacher URL, build/hash des sources, étapes et horodatages aux captures ; ces renseignements ne sont pas tous contenus dans les fichiers relus. Cet audit ne certifie donc pas une version à déployer ni l'absence de tout rechargement depuis les pixels seuls.

Restent hors de cet avis : upload/lecture/retrait de photos, AEA, passage à un site formalisé, modification, concurrence, rechargement forcé, nettoyage et comparaison d'intégrité globale hors RUN. La recette UI→base→édition→nettoyage reste en cours. La lecture SQL privilégiée prouve les valeurs persistées, pas les refus d'accès Auth/MFA/RLS.

**Avis : preuve recevable de création et persistance de ce seul site non formalisé et de ses deux responsables, avec affichage du résultat. Aucune validation générale du module, des pièces jointes ou d'une promotion distante.**
## Complément — comparaison de la base après création

Le contrôle en lecture seule de 13:09 UTC a été comparé indépendamment aux empreintes initiales de 11:40 UTC, à partir des fichiers déjà produits par l’agent environnement. Aucun nouvel accès SQL par l’auditeur. Preuve : `r02-baseline-comparison-independent.evidence.json`.

Sur les dix tables suivies : aucune ligne disparue, un artisan préexistant dont l’empreinte a changé, cinq nouvelles lignes. Trois ajouts correspondent exactement au manifeste R02 (le site et ses deux responsables) ; les deux autres sont un artisan et une carte non attribués à ce manifeste. Les métadonnées Storage suivies sont identiques. Les UUID et SHA sont consignés dans la preuve, sans extraction supplémentaire des dossiers.

La création Sites reste confirmée dans son périmètre exact. En revanche, la préservation globale des lignes préexistantes et l’attribution de tous les ajouts **ne sont pas validées** par cette comparaison. Aucun lien causal n’est déduit entre les changements hors manifeste et notre parcours Sites. Ils ne doivent être ni réattribués arbitrairement au RUN ni nettoyés comme des données de test. Le nettoyage des trois lignes du RUN demeure en attente et nécessite le protocole borné prévu.
