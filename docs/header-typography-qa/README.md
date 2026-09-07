# Typographie et navigation — ajustement local du 7 septembre 2026

## Changements

Deux feuilles de style uniquement : `national-dashboard-layout.css` et `global-dashboard-enhanced.css`. Les corrections précédentes des logos, du badge et du seul lien actif sont conservées.

- Titre du header : 19,44 px à 1440 px de largeur (contre 24,48 px), plafonné à 21 px sur grand écran. Sous-titre : 13 px contre 16 px. Hauteur du header ordinateur : 92 px contre 102 px ; logos conservés à leur taille précédente.
- Titre du tableau de bord : 26 px contre 32 px ; sous-titre : 14 px contre 17 px. Boutons, onglets et titres de panneaux plus compacts.
- Menus : 13 px contre 14 px ; espace disponible pour les libellés de groupes augmenté de 140 à 159 px. Tous les menus Administrateur contrôlés tiennent sur une ligne sans troncature, notamment Gestion de la production, Achat aux mines industrielles et Ventes d’or internationales.
- Barre de filtres sur une ligne dédiée sur tablette. Les panneaux de dates et de filtres sont ancrés pour rester dans l’écran.
- Chiffres et icônes des indicateurs redimensionnés sur mobile pour éviter leur chevauchement.

## Vérifications

- 34 tests existants réussis dans quatre fichiers : layout général, portail Mine, confinement du défilement et tableau de bord national. [Journal](tests.txt).
- Compilation Vite réussie, build `local-mtr218tn`. [Journal](build.txt).
- `git diff --check` : aucune erreur sur les deux feuilles de style.
- Contrôles navigateur aux largeurs 360, 768, 1366, 1440 et 1920 px : absence de débordement horizontal, logos chargés, menus sur une seule ligne. Navigation mobile ouverte et portail Collecteur SONASP également contrôlés.
- Panneaux de période et de filtres ouverts dans l’interface : date à 768 px entre x=26 et x=316 ; filtre mobile à 360 px entre x=16 et x=306. Les actions existantes sont conservées.
- Les captures utilisent le banc graphique local avec composants réels et données/authentification simulées. Ce lot CSS n’a entraîné aucune écriture en base, modification de permission, commit, push ou déploiement distant.

Les contrôles de ce lot portent sur les contextes Administrateur et Collecteur documentés ici. Ils ne réhabilitent pas les anciennes captures DGI/DGMG du lot identité : [la rectification](../header-identity-qa/README.md#rectification-indépendante-des-preuves-dgidgmg) conserve l’image `06-dgmg.png` comme preuve non recevable pour DGMG et limite `05-finances-dgi.png` au header DGI. Aucune validation graphique DGMG ne doit être déduite de ce rapport typographique.

## Aperçu

Version locale actualisée sur la même origine : http://127.0.0.1:5192/login.

- [Avant — 1440 px](avant-1440.png)
- [Après — 1440 px](apres-1440.png)
- [Après — 1366 px](apres-1366.png)
- [Après — 1920 px](apres-1920.png)
- [Tablette — 768 px](apres-768.png)
- [Mobile — 360 px](apres-360.png)
- [Menus mobile](menus-mobile-360.png)
- [Collecteur SONASP](collecteur-1440.png)

Les serveurs 5180 et 5190 ne sont pas modifiés. Sur 5192, le serveur statique sert désormais `node_modules/.cache/typography-local-build`.
