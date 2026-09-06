# Ressources de la carte, modèle v1

`header-recto.png` et `header-verso.png` : extraction déterministe des seuls en-têtes du PDF utilisateur « Faso_SANAMA_Carte_ID1_Recto_Verso (1).pdf », images embarquées de 1536 × 1024 pixels, rectangle (23, 70)–(1513, 307). Ils conservent le logo, le drapeau et le titre présents dans la référence, sans redessin ni IA. Aucune donnée du titulaire de démonstration n’est incluse. Un original vectoriel permettra ultérieurement d’améliorer la finesse du logo à l’impression.

`Roboto.ttf` : source variable Roboto du dépôt officiel google/fonts, licence OFL fournie. Les instances locales `Roboto-Regular.ttf` (400) et `Roboto-Bold.ttf` (700) sont utilisées par le moteur. Les avances des caractères de ces mêmes fontes, extraites dans `affiliation-font-metrics.ts`, servent à ajuster les textes longs sans les tronquer.

`resvg.wasm` : moteur déterministe resvg 2.6.2, licence MPL fournie (`resvg-LICENSE`). Les polices, en-têtes et moteur sont inclus dans le déploiement Edge via `static_files`.

Le portrait et le QR sont propres à chaque émission. Le rendu n’utilise aucun téléchargement de ressource graphique arbitraire.
