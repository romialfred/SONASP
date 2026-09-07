# Refonte des portails FASO SANAMA — vérification du 7 septembre 2026

## Périmètre livré

La refonte concerne l’en-tête, la navigation latérale, le pied de page et les déclinaisons graphiques des portails authentifiés existants. Le tableau de bord national reprend la composition de la maquette : bandeau de cinq indicateurs, quatre onglets, graphique or, répartition par origine et opérations.

L’en-tête et le bloc des logos mesurent respectivement **102 px** de hauteur et **270 px** de largeur sur ordinateur. Le bord du bloc des logos est aligné avec celui de la sidebar. Les menus réellement disponibles sont conservés : leur contenu est plus riche que la maquette. Les chiffres proviennent des sources existantes et ne sont pas remplacés par ceux de l’illustration.

La typographie Source Sans 3 est auto-hébergée. Les icônes sont homogènes, les fonds, sélections, boutons et états de focus suivent le portail. Le portail Direction utilise désormais le même cadre persistant.

**Aucun changement de schéma, migration, donnée métier ou règle RLS.** Les workflows, contrôles d’accès et routes métier restent en place. La vitrine et la connexion publiques ne sont pas modifiées.

## Identités et déclinaisons

| Portail existant | Déclinaison | Logo partenaire |
|---|---|---|
| Administrateur (owner et admin) | Vert profond / or | Organisme réellement associé au compte |
| SONASP | Vert olive | SONASP si organisme SONASP |
| Direction SONASP | Vert olive | SONASP |
| Finances · DGI | Vert pétrole | Armoiries et nom institutionnel |
| Mines · DGMG | Bleu institutionnel | Armoiries et nom institutionnel |
| Société minière | Brun / or | Nom réel et monogramme en l’absence de champ logo |
| Comptoir | Bleu ardoise | Logo existant du dossier, par URL signée, ou nom réel |
| Agent collecteur | Cuivre | Organisme de rattachement réel |
| Client | Gris bleu | Organisme réellement associé ou nom du profil |
| Production | Palette antérieure harmonisée | Organisme réellement associé |
| Expéditions | Palette antérieure harmonisée | Organisme réellement associé |
| Raffinerie | Palette antérieure harmonisée | Organisme réellement associé |

Aucun type de compte Présidence ou Observatoire n’existe dans le registre actuel. Aucun portail fictif ni permission supplémentaire n’a été ajouté. Les trois portails Production, Expéditions et Raffinerie n’ayant pas de palette dédiée dans les prescriptions, ils conservent leur palette antérieure avec le nouveau cadre commun.

Le thème dérive du profil authentifié et du résolveur de comptes existant. Il ne peut pas être imposé par une URL ou une préférence locale. Les anciennes réponses de chargement sont ignorées lors d’un changement d’organisme ; les espaces mine, comptoir et collecteur sont remis à zéro au changement de contexte.

## Captures

Ouvrir [la galerie des 15 contextes](gallery.html). Les captures représentent **12 portails visuels**, avec deux profils administrateur, deux sociétés minières et deux comptoirs. Tous sont exécutés avec les vrais composants de l’application dans un banc local isolé.

Les noms, opérations et profils des captures sont des **fixtures de vérification**, jamais des données ajoutées à la production. Le transport du banc refuse les écritures. L’identité SONASP des profils de test correspond à leur rattachement explicite dans les fixtures, pas à un repli automatique pour les comptes privés.

Le banc contient des états vides pour plusieurs portails métier : cela valide leur rendu et leurs contrôles, pas l’exhaustivité de tous leurs jeux de données ou formulaires.

- [Administrateur](captures/administrateur.png)
- [Administrateur mobile 390 px](captures/administrateur-mobile-390.png)
- [État vide](captures/administrateur-vide.png)
- [Sources indisponibles](captures/administrateur-erreur.png)
- [Mesures responsive](responsive.json)

## Résultats automatisés

| Vérification | Résultat |
|---|---|
| Vitest, suite complète hors sauvegardes | **2 562 tests réussis, 348 fichiers, 0 échec** |
| Contrôles ciblés après dernière revue | **20 tests réussis, 3 fichiers, 0 échec** |
| TypeScript + couverture des types de relations | Réussis |
| ESLint + contrôle des libellés français | Réussis |
| Compilation Vite + PWA | Réussie |

Commandes reproductibles :

```sh
npm run typecheck
npm run lint
npx vitest run --maxWorkers=6 --exclude 'backups/**'
npm run build
npx vite --config docs/multiportail-qa/vite.config.ts
```

Le [résumé machine](tests-summary.json) reprend les résultats des rapports Vitest. Les sorties brutes de cette session restent locales.

Les tests ajoutés couvrent notamment la résolution des thèmes, l’absence d’élargissement des droits, le logo signé d’un comptoir, le repli sans logo, les changements d’organisme et réponses tardives, la persistance du header pendant une navigation réelle, les onglets, les unités, l’export CSV filtré et les réponses tardives lors d’un changement de période.

## Vérification dans le navigateur

- Quinze contextes ouverts et capturés ; aucune image cassée dans les en-têtes contrôlés.
- Passage Alpha → Bêta pour les mines et comptoirs : nom/monogramme adaptés, sans maintien de l’ancien contexte.
- Rechargement du contexte mine Bêta : identité conservée.
- Tentative d’ouverture de /users avec le profil mine : redirection vers /portail-mine, aucun écran d’administration.
- Onglets et commandes Volume/Valeur manipulés ; unités adaptées.
- Période modifiée au clavier : indicateur de production et série mensuelle changent ensemble.
- Filtre et export manipulés ; contenu du fichier CSV validé automatiquement.
- États vides et erreurs vérifiés : un zéro réel est distinct d’une source indisponible (tiret et message explicite).
- Rail réduit vérifié ; libellés accessibles ajoutés aux commandes du rail.
- Mobile : ouverture/fermeture du menu et Échap testés, focus rendu au bouton d’ouverture.
- Largeurs 1920, 1536, 1280, 1024, 768 et 390 px mesurées : aucune largeur de document supérieure au viewport ; tableaux dans leur propre zone de défilement.
- Le graphique circulaire reste contenu à 1280 px après correction des rayons responsifs.

## Limites explicitement conservées

Les sessions réelles de tous les organismes et une reconnexion complète de chaque type de compte ne sont pas disponibles. Les captures correspondantes proviennent donc du banc isolé, qui réutilise le résolveur et les gardes de routes réels ; il ne simule pas une validation de toutes les politiques serveur.

Le clic d’export a été effectué, mais la réception du téléchargement par le navigateur n’a pas pu être confirmée par l’outil. La génération du Blob CSV et le respect du filtre sont testés automatiquement. Le parcours de détail d’opération dans le banc est une destination de test, pas une preuve de validation du formulaire métier réel.

Le zoom natif à 200 % n’a pas été confirmé par l’outil ; les six dimensions responsive ont été contrôlées séparément. Ne pas assimiler ces mesures à un test de zoom natif.

Ces réserves empêchent d’affirmer une validation exhaustive de tous les workflows métier en production. Elles n’impliquent aucun changement de leurs données ni de leurs permissions.

## Publication et contrôles distants

L’implémentation est enregistrée dans le commit **8e801ed053e6** sur **SONASP_2026**. La compilation locale `npm run build:release` est réussie ; le point d’entrée local est http://127.0.0.1:5180/ (HTTP 200, police auto-hébergée HTTP 200).

Les [contrôles GitHub du commit applicatif](https://github.com/romialfred/SONASP/actions/runs/34082469694) sont tous réussis : lint et TypeScript, **2 562 tests dans 348 fichiers**, compilation de production et audit des dépendances.

Vercel a publié le commit applicatif sur https://sonasp.data-univers.com/ ; `/build-version.json` a renvoyé `8e801ed053e6-mtqqdslx`. Les mises à jour ultérieures de ce dossier de preuves ne changent pas les fichiers applicatifs.

Le nouvel onglet de vérification en ligne affiche la connexion et ne rapporte pas d’erreur JavaScript. L’ancien onglet authentifié n’est plus contrôlable par l’outil. Une connexion de l’utilisateur a donc été demandée pour terminer le contrôle authentifié réel ; ce contrôle et la navigation vers un dossier métier réel ne sont **pas déclarés réussis**.
