# Fiche collecteur — recette du 6 septembre 2026

La fiche reprend la maquette fournie : bandeau d’identité, résumé, coordonnées en lignes, rattachements, actions et autorisation de paiement. Le volet droit présente l’activité propre au collecteur. Les formulaires de création artisan et site restent inchangés.

## Données et calculs

- Déclarations : ventes reliées explicitement au collecteur par `snp_collector_sales`, toutes périodes.
- Chiffre d’affaires suivi HT : somme des montants bruts des ventes approuvées, hors annulations. Il s’agit des ventes suivies, pas des commissions personnelles du collecteur.
- Taxes enregistrées : TVA et taxe de développement communal enregistrées sur ces ventes. Une valeur fiscale manquante est signalée ; ce total ne certifie pas un reversement fiscal.
- Quantité approuvée, nombre de ventes payées, refus/annulations et dernière déclaration complètent la synthèse.
- Lecture paginée avec jointure interne, filtre serveur sur le collecteur et politiques RLS existantes. Une erreur affiche une action Réessayer, jamais un faux bilan à zéro.
- Le lien vers les ventes conserve le filtre du collecteur. Les actions de gestion et de délégation conservent leurs habilitations existantes.

## Vérifications effectuées

- Tests des calculs, pagination au-delà de 500 ventes, exclusion d’un autre collecteur, refus/annulations, taxes manquantes et erreurs serveur.
- Tests du dossier incomplet, de la lecture seule, de la délégation expirée, de la configuration et des réponses tardives après changement de dossier.
- Parcours navigateur avec les composants réels et le layout national : dossier vide et complet, ouverture de la configuration, saisie de justification, ouverture des ventes filtrées, ouverture du formulaire de rattachement avec ses valeurs conservées, panne d’indicateurs et nouvelle tentative.
- Rendus 360, 768, 1366, 1440 et 1920 pixels, sans débordement horizontal. Le volet passe sous le dossier sur petit écran.
- Inspection en lecture seule de la base liée : relation un-à-un et clés étrangères présentes ; aucune vente dans le nouveau circuit de collecte au moment du contrôle.
- Requête PostgREST avec clé publique sans session : refus HTTP 401 / code 42501, sans exposition de données.

Les captures ci-dessous utilisent des scénarios locaux explicitement signalés à l’écran. Aucune identité ni opération financière n’a été créée, modifiée ou supprimée en production. La vérification de la fiche privée en ligne nécessite une session utilisateur active.

## Captures

- [1440 pixels](desktop-1440.png)
- [1920 pixels](desktop-1920.png)
- [Dossier complet à 1366 pixels](desktop-1366-complete.png)
- [Tablette](tablet-768.png)
- [Mobile](mobile-360.png)
- [Activité sur mobile](mobile-activity.png)
- [Erreur de chargement](activity-error.png)

Pour reproduire : `npm exec vite -- --config docs/collector-qa/vite.config.ts`, puis ouvrir `/artisan-minier/collecteurs/qa-incomplete` ou `/artisan-minier/collecteurs/qa-complete` sur le port 5183. Ajouter `?activity-error=1` pour le cas d’erreur. Ces scénarios ne sont pas inclus dans le build de production.
