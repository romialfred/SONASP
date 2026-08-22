# Rapport de comparaison visuelle

## Référence et intention conservée

La composition reprend les marqueurs essentiels de la maquette : zone éditoriale vert profond, visuel minier à droite, séparation diagonale soulignée d’or, carte du Portail Mine, hiérarchie institutionnelle, CTA principal et début visible de la section suivante. L’interprétation a été adaptée au véritable logo SONASP et à une vitrine complète, et non à la seule page de connexion montrée dans la capture.

## Contrôles responsive

| Largeur testée | Navigation | Hero et titre | Débordement horizontal | Capture |
| ---: | --- | --- | --- | --- |
| 1440 px | horizontale | 4 lignes, aperçu visible | aucun | `captures/vitrine-1440.png` |
| 1280 px | horizontale | 4 lignes, aperçu visible | aucun | `captures/vitrine-1280.png` |
| 1024 px | horizontale compacte | 4 lignes, aperçu visible | aucun | `captures/vitrine-1024.png` |
| 768 px | menu mobile | 3 lignes, composition empilée | aucun | `captures/vitrine-768.png` |
| 430 px | menu mobile | 6 lignes, boutons tactiles | aucun | `captures/vitrine-430.png` |
| 390 px | menu mobile | 6 lignes, aperçu sous le texte | aucun | `captures/vitrine-390.png` |
| 360 px | menu mobile | 6 lignes, largeur minimale validée | aucun | `captures/vitrine-360.png` |

Les contrôles ont mesuré `scrollWidth === clientWidth` à chaque largeur. Le menu mobile se ferme avec Échap, restitue le focus au déclencheur et se referme après navigation. Le changement de langue met à jour le contenu, la valeur persistée et l’attribut `lang` du document.

## Écarts maîtrisés

- La référence montre une page de connexion scindée en deux ; la livraison reprend sa géométrie et son langage visuel dans un hero institutionnel public, puis réserve la connexion à sa route réelle.
- Le logo officiel contient « SONASP », alors que la capture semble afficher une forme plus courte. Aucune altération du logo n’a été faite.
- Le visuel minier est une scène reconstituée et déclarée comme telle, faute de photographie institutionnelle licenciée fournie dans le dépôt.
- Les armoiries officielles disponibles sont un raster ; elles sont utilisées discrètement dans le bandeau sans retouche symbolique.
- Les titres mobiles dépassent quatre lignes afin de conserver une taille lisible ; la contrainte de quatre lignes est respectée sur grand écran.

## Corrections issues de la boucle visuelle

- recalibrage de la hauteur du hero et de la largeur de la colonne éditoriale ;
- amélioration du trait doré et de la diagonale responsive ;
- réduction de la navigation à 1024 px sans chevauchement ;
- passage anticipé au menu mobile à 768 px ;
- suppression des débordements à 430, 390 et 360 px ;
- restauration du focus et fermeture clavier du menu ;
- ajustement du poids des images avec variantes 960 et 1600 px.

