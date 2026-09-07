# Candidate locale intégrée R03

7 septembre 2026. Build **local-mtrbrhf4**, sources applicatives au commit **5d0d29f9**, servi par Vite preview statique sur **http://127.0.0.1:5192**. Le serveur précédent sur ce port a été identifié par sa commande et arrêté ; le serveur stable 5180 est préservé. Aucun HMR dans cette candidate.

## Portes techniques

Le runner `../../audit/run-integration-locale.mjs` termine avec code 0 : **2 938 tests réussis sur 2 938 dans 366 fichiers**, aucune erreur non gérée, typage de base, TypeScript, ESLint global, contrôle du français, contrôle de provenance et build tous réussis. Empreintes sources/tests/configuration identiques avant et après. Les résultats complets sont dans `../../audit/integration-locale-r03-evidence.json` et le reçu de fin Vitest.

La vérification HTTP retrouve ce build et le HTML compilé exact sur `/login` avec code 200 (`../../audit/integration-locale-r03-server.json`). Elle n'est pas utilisée comme preuve de rendu.

## Vérification navigateur effectivement exécutée

Une nouvelle session du navigateur intégré a ouvert `/login`, attendu la fin de l'initialisation et observé le formulaire. À **1280 × 720**, les sept images institutionnelles nommées sont chargées ; le document et le viewport ont la même largeur et hauteur, sans scroll de page. Le logo Faso SANAMA est dans la carte de connexion et les armoiries dans le header.

Le clic Se connecter avec les deux champs vides affiche les deux erreurs locales de validation. La lecture du gestionnaire a confirmé que cette validation précède l'appel d'authentification ; aucun identifiant ni mot de passe n'a été saisi. Le document reste **1280 × 720**, puis **390 × 844** après adaptation mobile. Les mesures DOM sont enregistrées dans les deux fichiers `*-mesures.json`. Les captures natives `.jpg` ont été inspectées par le pilote.

La console de cette session ne retourne aucune erreur ou avertissement (`console.json`). Le viewport a été réinitialisé et `/login` rouvert sans erreur de saisie pour laisser la candidate prête à l'utilisateur.

## Limites

Ce contrôle du build intégré porte sur le login et ses erreurs locales ; il ne prétend pas tester un refus d'authentification distant, le MFA ou une session métier connectée. Les preuves Sites sur le banc 5188 sont distinctes et identifiées comme simulées. La création R02 effectuée auparavant dans une vraie session, sa comparaison SQL et son nettoyage ne valident pas rétroactivement tous les formulaires de ce nouveau build.

Aucune publication distante ni migration Supabase n'a été effectuée dans cette reprise. La suite des parcours authentifiés exige une reconnexion de test ; les formulaires et portails non exécutés restent ouverts dans l'inventaire.
