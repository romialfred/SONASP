# Header et navigation — vérification locale du 7 septembre 2026

Les changements sont limités aux composants partagés du header et de la navigation. Aucun déploiement, push Git, changement de permission ou écriture en base n’a été effectué pour ce lot.

## Résultat

- Faso SANAMA reste en première position. Les administrateurs Owner et Admin affichent ensuite les armoiries, même si leur profil possède un organisme de rattachement.
- Le code prévoit l’identité de l’organisme autorisé : SONASP, DGI, DGMG, ou le dernier logo du dossier du comptoir récupéré par le service existant avec une URL signée. Le collecteur reprend ainsi l’identité de son organisme. **La capture historique nommée DGMG n’en fournit pas la preuve visuelle : elle affiche DGI.**
- En l’absence de logo ou après une erreur de chargement, les armoiries remplacent le monogramme. Le nom de l’organisme demeure accessible au survol. Le modèle actuel des sociétés minières ne possède pas de champ de logo : leurs armoiries de repli ont été vérifiées, sans inventer de nouvelle colonne en base.
- Le badge Administrateur est un écusson vectoriel vert et or avec cadenas et coche, dimensionné selon la largeur disponible.
- Le jaune doré translucide ne s’applique qu’au lien actif, avec `aria-current="page"`. Les boutons de groupes ne sont plus surlignés. Les fiches détaillées conservent leur sous-menu actif ; les liens dupliqués vers l’accueil du collecteur ne produisent plus deux surlignages.

## Vérifications

- 85 tests réussis dans six fichiers : identité des portails, navigation, layout partagé, portails Mine et chrome, contraintes de défilement. Voir [tests.txt](tests.txt).
- Compilation Vite réussie, build `local-mtr1gox3`. Voir [build.txt](build.txt).
- Contrôle TypeScript et couverture des relations typées : [typecheck.txt](typecheck.txt).
- ESLint sur les huit fichiers TypeScript/TSX modifiés et `git diff --check` : aucune erreur.
- Treize fichiers de capture historiques sont conservés, issus du banc local avec les composants réels. **Ce nombre ne correspond pas à treize validations recevables.** Les enregistrements `05-finances-dgi` et `06-dgmg` présentaient une discordance entre mesures DOM et pixels ; ils sont séparés des contrôles retenus dans [verification-interface.json](verification-interface.json). Les constats d’absence de débordement, de chargement des logos et de lien actif doivent être lus pour chaque capture effectivement concordante ; ils ne valent pas validation de tous les portails.
- À 1024 px, l’écusson et le libellé Administrateur restent séparés du sélecteur de langue (14 px mesurés). Le contrôle visuel a permis de corriger cet espacement.
- Le banc utilise une authentification et des données isolées. Le logo « Comptoir Alpha » est une illustration de test locale ; aucune société réelle n’a été créée ou modifiée. Ces vérifications graphiques ne constituent pas une recette des écritures métier en base. Deux avertissements de rechargement à chaud `createRoot` ont été observés pendant les modifications du banc Vite ; ils concernent son point d’entrée de développement.

## Consulter

Application compilée, avec authentification réelle : http://127.0.0.1:5192/login

Banc graphique isolé : http://127.0.0.1:5186/ — ouvrir « Banc local de vérification » pour choisir un contexte.

Les serveurs locaux existants sur 5180 et 5190 ont été conservés. La version compilée de ce lot est servie séparément depuis `node_modules/.cache/header-local-build`.

### Captures principales

- [Administrateur — ordinateur](01-administrateur-ordinateur.png)
- [Administrateur — seul sous-menu Comptoirs actif](02-administrateur-sous-menu.png)
- [Collecteur — organisme SONASP](03-collecteur-sonasp.png)
- [Comptoir — logo personnalisé de test](08-comptoir-logo.png)
- [Administrateur — mobile](10-administrateur-mobile.png)
- [Navigation mobile — seul sous-menu actif](11-menu-actif-mobile.png)
- [Administrateur — largeur 1024 px](12-administrateur-1024.png)
- [Administrateur — menu réduit](13-administrateur-menu-reduit.png)

### Rectification indépendante des preuves DGI/DGMG

Audit du 7 septembre 2026, images originales conservées sans retouche ni remplacement :

| Fichier historique | Contenu effectivement visible | Limite de preuve |
|---|---|---|
| [05-finances-dgi.png](05-finances-dgi.png) | Header « Finances · DGI » ; corps « Navigation de vérification », texte `/collecte/ventes` ; aucun lien de menu surligné | Header DGI seulement. La mesure déclarant `/portail-dgi` avec Tableau de bord actif ne correspond pas à cette image et est écartée. |
| [06-dgmg.png](06-dgmg.png) | Header « Finances · DGI » ; page « Collecte des taxes et impôts » ; Tableau de bord surligné | **Non recevable pour DGMG.** Les déclarations `/portail-dgmg`, « Mines · DGMG » et « Vue d’ensemble » active sont écartées. L’image n’est pas renommée afin de conserver son historique. |

Les URLs réellement ouvertes ne peuvent pas être établies par ces pixels seuls. Aucune nouvelle capture ni recette métier DGMG n’est produite par cette correction documentaire. Les anciennes mesures sont conservées dans `rejectedChecks` avec leur motif, sans être présentées comme contrôles validés. Voir également [la revue indépendante](../amelioration/audit/REVUE_REPRISE_LOCALE_20260907.md).
