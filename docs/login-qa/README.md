# Connexion : hauteur d’écran, logo et institutions

## Comportement livré

La page utilise une grille à hauteur `100dvh`. Les champs, le bouton de connexion et les liens restent visibles : les versions compactes réduisent les éléments de présentation avant les contrôles. Les erreurs de saisie et de connexion occupent une zone réservée, reliée aux champs et annoncée comme alerte. Aucun changement du service d’authentification, du MFA ou des formulaires métier.

Le logo provient du fichier utilisateur `F:/Data Universe/Gouvernement Burkina/Logo/Faso Sanama 2.png`, copié sans modification. SHA-256 : `e7a2a0941e3bf5af24fa8084596a98813f1ea68dff216b0b274eee7f6e728ca4`. La transparence et le ratio 3:2 sont conservés.

Le bandeau horizontal avance toutes les 4,5 secondes. Il s’arrête au survol, au focus, avec la commande Pause, lorsque la page est masquée et selon la préférence de réduction des animations. Les flèches restent disponibles. Les définitions s’ouvrent au survol, au focus ou au toucher ; Échap ou un clic extérieur les ferme. Les cinq institutions sont présentes une seule fois dans l’arbre d’accessibilité.

## Vérification reproductible sans données métier

```powershell
npm exec -- vite --config docs/login-qa/vite.config.ts
```

Ouvrir `http://127.0.0.1:5184/` pour un refus d’identifiants, ou `http://127.0.0.1:5184/?error=network` pour une erreur réseau. N’importe quelles valeurs non vides déclenchent la réponse simulée. Le vrai composant Login et ses styles sont utilisés ; l’alias AuthContext de cette configuration ne contacte aucun service. Cette fixture n’est ni importée ni compilée par l’application de production.

Contrôler les états initial, champs requis, identifiants refusés et erreur réseau. Pour chaque format, vérifier que la hauteur/largeur défilante du document ne dépasse pas le viewport, que le formulaire se termine avant le bandeau, et que le logo ne recouvre pas le titre. Comparer la position du bouton avant/après l’erreur. Vérifier ensuite les cinq logos, la pause, le survol d’une fiche, son accès clavier/tactile et sa fermeture.

Formats contrôlés : 320×568, 360×600, 360×640, 390×844, 667×375, 768×1024, 844×390, 960×540, 1024×768, 1280×720, 1366×650, 1366×768, 1440×900 et 1920×1080. `viewport-checks.json` contient les mesures avec erreur réseau. Les captures sont dans `captures/`.

Les tests de composant couvrent la pause automatique/manuelle, la réduction des animations, les définitions, le clic extérieur, Échap et le défilement au focus, en complément des contrats de connexion existants. Une connexion réelle et son challenge MFA nécessitent un compte autorisé ; les contrôles de cette modification ne créent aucune session métier.

## Sources des définitions

Le rattachement à la Présidence et le rôle commercial de la SONASP viennent des indications du propriétaire de la plateforme. Les descriptions restent informatives et ne changent pas les autorisations métier.

- [Ministère des Finances : organisation](https://www.finances.gov.bf/ministere/organisation) et [transparence du secteur extractif](https://www.finances.gov.bf/forum/detail-actualites?tx_news_pi1%5Bnews%5D=1728).
- [Primature : activités du ministère chargé de l’énergie et des mines](https://primature.gov.bf/contrat-dobjectifs-2025-un-taux-de-realisation-de-8966-pour-le-ministre-de-lenergie-des-mines-et-des-carrieres/).
- [BUMIGEB : présentation officielle](https://www.bumigeb.bf/) et [géoportail géologique et minier](https://geoportail.bumigeb.bf/).
