# Recette locale — Collecteurs et ventes de collecte

Recette effectuée le 6 septembre 2026 sur les composants du module et le véritable habillage `NationalDashboardLayout`. Le serveur de recette utilise exclusivement des réponses locales ; aucune identité, vente, notification ou opération financière n’a été créée dans la base distante.

## Parcours vérifiés dans le navigateur

- Création d’une personne physique avec deux sites et un comptoir : complétion à 100 %, enregistrement et ouverture immédiate de la fiche.
- Modification du dossier : données retrouvées, retrait d’un site et mise à jour immédiate de la fiche.
- Soumission d’une vente depuis le profil Collecteur : statut à approuver et absence d’action d’auto-approbation.
- Approbation depuis le profil Comptoir : confirmation, nouveau statut et affichage des deux notifications simulées.
- Soumission d’un dossier incomplet : erreurs explicites et conservation des saisies.
- Affichage à 360, 768, 1366, 1440 et 1920 pixels : contrôles visuels et absence de débordement horizontal.
- Chargement à froid après corrections : aucune erreur dans la console du navigateur.

Les décalages des champs de téléphone et des actions du titre sur petit écran ont été corrigés pendant la recette. Les contrôles serveur sont exécutés séparément par les tests SQL ; le profil sélectionnable ici ne constitue pas un contrôle d’autorisation.

## Captures

| Vue | Fichier |
| --- | --- |
| Mobile | [360 px](form-mobile-360.png) |
| Tablette | [768 px](form-tablet-768.png) |
| Ordinateur | [1366 px](form-desktop-1366.png), [1440 px](form-desktop-1440.png), [1920 px](form-desktop-1920.png) |
| Rattachements | [Sites et organisme](form-rattachements.png) |
| Vente | [Saisie](vente-saisie.png), [approbation](vente-approbation.png) |

## Reproduire

Depuis la racine du projet :

```powershell
npm exec vite -- --config docs/collector-qa/vite.config.ts
```

Ouvrir `http://127.0.0.1:5183/artisan-minier/collecteurs/nouveau`. Le sélecteur « Profil de test » permet de parcourir les vues Administration, Collecteur et Comptoir. Les données disparaissent au rechargement complet. Ces fixtures ne sont pas incluses dans le build de production.

Les limites de recette et les prérequis de mise en service sont décrits dans [la documentation du module](../collecteurs-comptoirs.md).
