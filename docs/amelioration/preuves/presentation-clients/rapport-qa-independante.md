# Recette indépendante de présentation — pilote Clients

Date : 7 septembre 2026, Afrique/Abidjan (UTC). Agent exécutant : `inventaire_architecture`, indépendant de l'auteur des corrections applicatives. Origine visitée : `http://127.0.0.1:5187`. Aucune navigation ni écriture en production.

## Conclusion et portée

Les interactions de liste et de création décrites ci-dessous ont été observées dans le navigateur. Elles utilisent les vrais composants, mais les données et l'authentification sont des fixtures : **la recette intégrée interface → base → détail → rechargement → modification reste BLOQUÉE et n'est pas validée**. La soumission a explicitement échoué comme prévu par le banc. Aucun client ni compte bancaire n'a été enregistré en base ; aucun nettoyage de base n'était donc à effectuer dans ce banc.

Le tableau `resultats-controles.csv` distingue 8 contrôles de présentation réussis, 1 refus de sauvegarde attendu, 2 contrôles partiels et 8 non exécutés. Ces nombres portent sur ce plan restreint ; ils ne constituent ni un pourcentage de conformité métier ni une couverture de tous les formulaires de l'application.

## Environnement et données

- Navigateur : Chrome extension, profil Romuald ; onglet QA propre `357297776` ; viewport demandé et mesuré **1536 × 1024**. Les identifiants de navigateur sont propres à la session d'agent (Chrome était `1` ici).
- Bandeau permanent observé : « Aperçu de présentation — données fictives, enregistrement indisponible ».
- Liste : 25 clients fictifs ; 8 actifs, 8 inactifs, 8 en attente et 1 statut non renseigné.
- Agrégats observés : 2 ventes approuvées, total du premier client 445 000 USD, moyenne de vente 222 500 USD.
- Saisie temporaire : `QA Présentation Banque Essai SA`, `qa-clients@example.test`, téléphone fictif `+226 70 00 00 01`, contact `QA Contact Isolé`, Burkina Faso, IFU `QA-IFU-0001`, adresse de présentation, paiement immédiat, crédit `0`, statut Actif.
- Banque temporaire : Burkina Faso, Ouagadougou, `QA Banque Personnalisée`, XOF, numéro fictif `QA000000123`, IBAN de test `FR1420041010050500013M02606`, SWIFT de test `ABCDEFGH`. Aucun compte financier réel n'a été ouvert, modifié ni utilisé.

## Résultats effectivement observés

1. Le répertoire se charge avec les 25 fixtures. Les mesures DOM initiales donnent `innerWidth=1536`, `documentElement.scrollWidth=1536` et `scrollHeight=1024` : aucun débordement horizontal du document à cet instant. Le contenu principal possède son propre défilement.
2. Recherche `Atlas` : 1 résultat et compteurs Tous (1), Actif (1). Les indicateurs de synthèse restent globaux (25 clients, 8 actifs, 2 ventes), conformément au libellé « Répertoire accessible ».
3. Filtre pays Ghana : 6 résultats et 2 clients dans chaque statut Actif/Inactif/En attente. Clic Actif (2) : 2 lignes Ghana. Réinitialiser rétablit le répertoire.
4. Pagination : deuxième page 11–20 sur 25 ; dernière page 21–25 sur 25, 5 lignes et bouton Suivant désactivé. Choix 25 lignes : 25 lignes, page 1/1.
5. Soumission du formulaire vide : six erreurs françaises, focus sur Raison sociale. Les champs portent chacun `aria-invalid=true` et `aria-describedby` vers leur erreur, et des labels associés.
6. Les dix champs du client ont été saisis ou modifiés dans l'interface. La valeur zéro du crédit est visible dans le formulaire de création. Ce contrôle ne prouve pas encore la conservation de zéro au chargement du formulaire de modification.
7. Choix « Autre (à préciser ci-dessous) » : le champ de banque hors catalogue reste affiché après la saisie du seul caractère `Q`, puis accepte le nom complet. Ville, devise, numéro de compte, IBAN, SWIFT et case du compte principal sont présents.
8. Ajout d'une seconde banque : compteur 2 ; sélection de cette banque comme principale, puis retrait de cette seconde banque. La première banque et ses valeurs sont conservées et elle redevient principale, compteur 1. Il s'agit uniquement de l'état du formulaire non enregistré.
9. Soumission du dossier rempli : dialogue « Erreur » indiquant explicitement qu'aucune persistance n'est disponible et qu'aucune donnée n'a été sauvegardée. Après OK, les valeurs du client et de la banque restent visibles. Ce refus est attendu et **ne constitue pas un enregistrement réussi**.
10. Clic Annuler : confirmation JavaScript « Des modifications ne sont pas enregistrées. Quitter le formulaire ? », boutons Cancel et OK. Le déclenchement est observé ; acceptation, refus et destination finale ne sont pas attestés.

## Blocage et limites

Le contrôle Annuler a déclenché un dialogue natif. L'outil CUA a ensuite dépassé ses délais sur `getJsDialog().accept()`, sur la récupération de l'onglet, sa fermeture et la création d'un nouvel onglet Chrome. Les premières captures avaient aussi nécessité un second essai après des délais `Page.captureScreenshot`. Cela décrit un blocage de pilotage ; ces erreurs d'outil ne sont pas assimilées à une erreur métier du formulaire.

Le pilote a été libéré pour le coordinateur. Il a pu ouvrir une surface IAB indépendante ; celle-ci n'est pas disponible dans les outils de ce sous-agent (`cua.getState()` ne liste ici que Chrome ; `createBrowserTab('iab',...)` répond « Browser is not available: iab »). Les contrôles suivants doivent être exécutés par le coordinateur dans cette autre surface puis audités séparément : détail, lien de vente, modification avec crédit zéro, états vide/erreur/ventes en erreur, mobile 390 × 844, zoom 200 %, filtres conservés dans l'URL et retour au répertoire.

L'override Chrome 1536 × 1024 n'a pas pu être réinitialisé après ce blocage. Aucun autre onglet n'a été manipulé. Les tentatives de création ayant expiré n'ont retourné aucun nouvel identifiant ; ne pas fermer un onglet sans vérifier son identité.

Le serveur a HMR désactivé. Le coordinateur a annoncé une stabilisation supplémentaire vers 05:15 UTC (filtres URL, retour détail, décimales, volet sous 1200 px, focus des erreurs bancaires). Les pages déjà ouvertes n'ont pas été rechargées après cette annonce à cause du blocage : **les captures ne certifient pas l'intégralité du dernier état du code**. Les empreintes sources du manifeste sont un relevé après les essais, pas la preuve des octets compilés au moment de chaque capture.

## Qualité visuelle et captures

Les cinq PNG sont des captures navigateur non retouchées obtenues avec `fullPage:true`. Le shell utilise un défilement interne : l'option capture donc le document à l'état courant, sans dérouler automatiquement tout le contenu de `main`. Elles ne doivent pas être présentées comme une capture intégrale verticale du long formulaire. Les vues 03 et 05 montrent respectivement les informations client et les banques. Aucune capture mobile n'a été produite par ce sous-agent.

| Preuve | Ce qu'elle démontre |
|---|---|
| `01-liste-desktop.png` | Liste initiale et synthèse ordinateur, partie haute |
| `02-liste-pagination-desktop.png` | Dernière page : cinq lignes et pagination complète |
| `03-creation-erreurs-requis-desktop.png` | Erreurs des six champs requis, focus raison sociale |
| `04-creation-refus-persistance-desktop.png` | Refus explicite de sauvegarde du banc isolé |
| `05-creation-banque-desktop.png` | Banque personnalisée renseignée et compte principal, partie bancaire |

Observation visuelle mineure : la section bancaire répète le titre « Comptes bancaires » puis « Comptes bancaires (1) » dans la capture 05. Cette répétition est à simplifier si la version stabilisée la conserve. Aucun constat de débordement mobile ni jugement global de fidélité n'est possible sans les contrôles restants.

## Console et preuves techniques

Une lecture initiale de `tab.dev.logs({levels:['error','warn'],limit:20})` a renvoyé `[]` sur la liste desktop. Aucun relevé de fin de parcours n'a pu être fait : il serait incorrect de déclarer « zéro erreur console sur tout le parcours ». Les instantanés DOM et lectures accessibles des contrôles sont dans la trace de la tâche ; seules les captures et le présent journal constituent les fichiers locaux livrés. Aucune capture ne prouve Auth, RLS, autorisations, intégrité transactionnelle, audit serveur, persistance ou nettoyage.

Les preuves doivent être auditées par une personne ou un agent distinct avant toute déclaration de validation. Ce rapport n'autorise aucun déploiement.
