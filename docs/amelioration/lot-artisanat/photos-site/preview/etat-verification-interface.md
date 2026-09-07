# Vérification interface SITE-DOC-007 — partielle, transport simulé

> État historique avant la reprise du pilote. Le complément [Recette navigateur après correction CSP](recette-interface-apres-csp.md) décrit les essais ultérieurs réussis sur le banc mémoire, dont l'ajout partiel, les reprises et le mobile. Les limites des captures initiales ci-dessous sont conservées.

Le 7 septembre 2026, le banc local dédié écoute sur `127.0.0.1:5188` (port vérifié libre avant lancement). La page et les transformations Vite du formulaire, détail et transport répondent HTTP 200. Ceci prouve uniquement que le serveur livre les ressources ; ce n'est pas une validation de leur rendu.

L'instruction de coordination réserve Chrome au pilote pour la recette des affiliations. Une nouvelle session IAB exclusivement est demandée pour les photos.

L'appel `cua.getState()` expose uniquement le navigateur Chrome id `1`, avec les pages 5192/5185 du pilote et une autre application. L'appel demandé `cua.createBrowserTab('iab', 'http://127.0.0.1:5188/artisan-sites/qa-site/modifier', { visible: false })` retourne **« Browser is not available: iab »**. Aucun onglet, viewport, contenu ou état de Chrome n'a été modifié par cette tentative.

Le pilote a ensuite attribué un créneau exclusif dans Chrome. Une seule nouvelle tab `357297852` a été créée dans la session « QA photos sites », à l'origine 5188. Aucune autre tab n'a été utilisée. Le viewport a été temporairement réglé à **1536 × 1024**, puis **`viewport.reset()` a réussi** avant restitution du créneau au pilote pour sa recette réelle. La tab de test reste ouverte ; aucune tab utilisateur n'a été fermée.

## Résultats réellement observés

| Scénario | Résultat observé | Preuve / limite |
| --- | --- | --- |
| Chargement du formulaire de modification | Champs et catégorie non formalisée affichés ; deux photos de fixture chargées. Mesure DOM : largeur 1536, hauteur 1024, `scrollWidth` 1536, deux images complètes de largeur intrinsèque 1751. | `captures/desktop-form-initial.png`. Le profil initial de la fixture utilisait un type institution générique, donnant un habillage « Accès sécurisé » ; fixture corrigée ensuite vers `organization_type: dgmg`, sans nouvelle capture. |
| Retrait de deux références historiques du brouillon | Les deux boutons de retrait fonctionnent ; le formulaire peut proposer un nouveau lot. | Observation DOM et parcours avant sélection. Aucun retrait d'objets réels, transport simulé. |
| Sélecteur natif | Le chooser s'ouvre et annonce la sélection multiple ; `setFiles` échoue avec `Not allowed`. | Sélection effective de fichiers natifs non attestée ; aucun contournement par commande native. |
| Sélection par commande QA locale | Les fichiers du bouton du banc parviennent au vrai `input` et au vrai traitement. Les deux fichiers finissent en erreur, y compris l'image valide, avant le transport Storage. Erreurs et actions de reprise/retrait visibles. | `captures/desktop-upload-partiel.png` est une capture de **deux refus avant correction CSP**, malgré son nom de fichier initial. Elle ne montre pas un succès partiel. |
| Capture intégrale | Appel `screenshot({fullPage:true})` terminé par timeout CDP 5 s. Capture du viewport ensuite réussie. | Aucune page intégrale déclarée capturée. |

Le refus de la fixture valide a conduit à identifier `fetch(dataURL)` dans le service, incompatible avec `connect-src 'self'` du banc et le `connect-src` sans `data:` de la configuration Vercel. Une conversion locale JPEG base64 → octets → Blob a été autorisée, reproduite rouge puis corrigée. La CSP du banc reste stricte (`connect-src 'self'`), et celle de l'application n'a pas été modifiée. **Aucune nouvelle capture après ce correctif** : le pilote a repris le navigateur pour la recette réelle.

## Restant à vérifier

**NON EXÉCUTÉ :** réussite de dépôt après correction, reprise ciblée réussie, sauvegarde simulée/détails après dépôt, refus/reprise de lecture dans l'interface, compensation/reprise après refus dans l'interface, responsive mobile, captures complètes. Ces comportements possèdent des tests DOM locaux mais ne sont pas déclarés validés dans le navigateur par ce rapport. Auth, base et Storage réels n'ont jamais été connectés au banc.
