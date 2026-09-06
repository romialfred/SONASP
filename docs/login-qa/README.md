# Connexion : hauteur d’écran, logo et institutions

## Comportement livré

La page utilise une grille à hauteur `100dvh`. Les champs, le bouton de connexion et les liens restent visibles : les versions compactes réduisent les éléments de présentation avant les contrôles. Les erreurs de saisie et de connexion occupent une zone réservée, reliée aux champs et annoncée comme alerte. Aucun changement du service d’authentification, du MFA ou des formulaires métier.

Le logo provient du fichier utilisateur `F:/Data Universe/Gouvernement Burkina/Logo/Faso Sanama 2.png`, copié sans modification. SHA-256 : `e7a2a0941e3bf5af24fa8084596a98813f1ea68dff216b0b274eee7f6e728ca4`. La transparence et le ratio 3:2 sont conservés.

Depuis le 6 septembre 2026, le bandeau défile de manière continue, linéaire et en boucle (45 secondes par cycle). Il ne propose plus de commande de lecture, pause ou navigation et continue pendant la lecture d’une définition. La préférence de réduction des animations ralentit le cycle à 120 secondes. Deux groupes visuels identiques assurent la continuité ; le second est exclu de l’arbre d’accessibilité et de la tabulation. Les définitions restent fixes au-dessus du bandeau et s’ouvrent au survol, au focus ou au toucher ; Échap ou un clic extérieur les ferme.

Les armoiries en 500 × 587 pixels précèdent le logo Faso SANAMA dans l’en-tête et remplacent la version de 400 pixels dans le bandeau. Les proportions des images originales sont conservées. La devise bénéficie d’un fond ivoire contrasté et reste présente sur mobile. Le pied de page identifie la Présidence du Burkina Faso et Quantix Solutions Burkina Faso.

## Vérification reproductible sans données métier

```powershell
npm exec -- vite --config docs/login-qa/vite.config.ts
```

Ouvrir `http://127.0.0.1:5184/` pour un refus d’identifiants, ou `http://127.0.0.1:5184/?error=network` pour une erreur réseau. N’importe quelles valeurs non vides déclenchent la réponse simulée. Le vrai composant Login et ses styles sont utilisés ; l’alias AuthContext de cette configuration ne contacte aucun service. Cette fixture n’est ni importée ni compilée par l’application de production.

Contrôler les états initial, champs requis, identifiants refusés et erreur réseau. Pour chaque format, vérifier que la hauteur/largeur défilante du document ne dépasse pas le viewport, que le formulaire se termine avant le bandeau, et que le logo ne recouvre pas le titre. Comparer la position du bouton avant/après l’erreur. Vérifier ensuite les cinq logos, la continuité du mouvement pendant la lecture d’une fiche, son accès clavier/tactile et sa fermeture.

Formats contrôlés : 320×568, 360×600, 360×640, 390×844, 667×375, 768×1024, 844×390, 960×540, 1024×768, 1280×720, 1366×650, 1366×768, 1440×900 et 1920×1080. Les nouvelles mesures avec erreur réseau et captures sont dans [20260906](./20260906/viewport-checks.json). Les fichiers à la racine et dans `captures/` correspondent à la version précédente.

Les 22 tests ciblés couvrent les contrats de connexion, les nouveaux crédits et l’ordre des logos, les cinq institutions accessibles sans commandes de défilement, les définitions (y compris depuis la copie visuelle), le clic extérieur et Échap. La continuité de l’animation et la géométrie sont vérifiées dans Chrome, car JSDOM ne calcule pas les animations CSS. La suite complète de CI inclut ces tests. Une connexion réelle et son challenge MFA nécessitent un compte autorisé ; les contrôles de présentation ne créent aucune session métier.

## Sources des définitions

Le rattachement à la Présidence et le rôle commercial de la SONASP viennent des indications du propriétaire de la plateforme. Les descriptions restent informatives et ne changent pas les autorisations métier.

- [Ministère des Finances : organisation](https://www.finances.gov.bf/ministere/organisation) et [transparence du secteur extractif](https://www.finances.gov.bf/forum/detail-actualites?tx_news_pi1%5Bnews%5D=1728).
- [Primature : activités du ministère chargé de l’énergie et des mines](https://primature.gov.bf/contrat-dobjectifs-2025-un-taux-de-realisation-de-8966-pour-le-ministre-de-lenergie-des-mines-et-des-carrieres/).
- [BUMIGEB : présentation officielle](https://www.bumigeb.bf/) et [géoportail géologique et minier](https://geoportail.bumigeb.bf/).
