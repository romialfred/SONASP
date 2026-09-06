# Dossier Comptoir — vérification du 6 septembre 2026

Le menu **Artisans miniers → Comptoirs** ouvre désormais un registre d’entreprises. La création, la modification et la consultation partagent les six sections du dossier : société, immatriculation et fiscalité, autorisation d’achat, adresse, premier responsable et documents complémentaires.

Un brouillon peut être enregistré avec la dénomination, le type d’entreprise et la ville. La synthèse signale les autres informations et justificatifs à compléter. Le pourcentage mesure la complétude du dossier, pas une approbation administrative. La validité affichée est calculée à partir des dates saisies, sans attribuer automatiquement une durée réglementaire.

## Référentiels

- [Annuaire DGI](https://dgi.bf/contacts/) et [organigramme DGI](https://dgi.bf/organigramme/) : 70 directions et centres destinés au rattachement fiscal, avec la source de chaque entrée dans `src/data/comptoirTaxOffices.json`. Les libellés suivent l’annuaire publié, consulté le 6 septembre 2026.
- [CEFORE / Maison de l’Entreprise](https://creerentreprise.me.bf/) : entreprise individuelle, SARL, SA, SAS, SNC et SCS.
- [Loi de finances 2026 publiée par la DGI](https://dgi.bf/wp-content/uploads/2026/01/JOURNAL-OFFICIEL-N%C2%B001-SPECIAL-LOI-DE-FINANCES-2026.pdf) : choix RNI, RSI et CME. Le gestionnaire reporte le régime de son dossier fiscal ; l’application ne détermine pas l’éligibilité fiscale.

## Parcours navigateur vérifié

La fixture charge les véritables composants, le client Supabase JS et la migration PostgreSQL dans une base PGlite jetable. Seule l’authentification et les lectures du cadre applicatif sont simulées. Elle ne communique pas avec les données de production.

```powershell
npm exec -- vite --config docs/comptoir-qa/vite.config.ts
```

Ouvrir `http://127.0.0.1:5185/artisan-minier/comptoirs/nouveau`.

Parcours effectué : saisie d’un Comptoir SARL, sélection du régime RNI, recherche et sélection DME Centre V, enregistrement et consultation, modification du responsable et des dates, nouvelle consultation, retour à la liste sans rechargement manuel, puis filtre des autorisations expirées. Le changement de mode modification → détails recharge les données enregistrées ; ce comportement est couvert par un test de régression.

Les captures `form-*.png`, `autorisation.png`, `responsable.png` et `liste-apres-enregistrement.png` montrent les composants réellement rendus. `responsive.json` consigne cinq formats (360 × 800 à 1920 × 1080), sans débordement horizontal et avec le bouton d’enregistrement visible. Aucun message d’erreur console n’a été observé pendant ce parcours. `rpc-browser-evidence.json` ne contient que les noms et statuts des appels, sans données personnelles.

## Tests reproductibles

```powershell
npm run test:comptoirs
npm run test:registry
npm run typecheck
npm run lint
npm exec -- vitest run --maxWorkers=2
```

- Le test de liaison RPC utilise le véritable `SupabaseClient.rpc` et reproduit l’erreur Collecteurs « reading 'rest' » lorsque la méthode perd son contexte. Il couvre aussi les ventes et l’inventaire concernés.
- 62 contrôles SQL exécutent la migration réelle : création, lecture, modification, doublons RCCM/IFU, concurrence, répétition idempotente, préservation des organisations existantes, droits par rôle, pièces privées, archivage et restrictions d’écriture.
- Les tests du formulaire couvrent les champs, la complétude, les dates, les fichiers invalides, les reprises après erreur réseau ou envoi partiel, et la relecture après modification.
- 10 tests de la passerelle vérifient les métadonnées, la session/MFA, les formats réels des fichiers, l’idempotence, la révocation et les compensations d’envoi.

Le téléversement authentifié dans un vrai navigateur n’a pas été exercé : aucune session utilisateur connectée n’était disponible. La passerelle et les autorisations sont vérifiées séparément. Cette limite ne doit pas être présentée comme un parcours utilisateur complet en production.

## Publication et protection des données

La migration additive `20260906174800_dossiers_comptoirs_entreprises.sql` a été répétée sur la base hébergée dans une transaction intégralement annulée. Cette répétition a appelé les véritables RPC de création/lecture Comptoir et de liste Collecteurs sous rôle administrateur avec les contrôles de session. Les empreintes de 14 tables existantes ont été comparées avant et après. Aucun dossier de démonstration n’est conservé en production.

La migration a ensuite été appliquée le 6 septembre 2026 ; RLS, permissions des fonctions, confidentialité du bucket et référentiel ont été contrôlés. La passerelle `sensitive-upload` version 7 a été déployée et ses 14 fichiers ont été comparés aux sources locales ; les 12 dépendances préexistantes sont inchangées. Sauvegardes et reçus détaillés restent dans le répertoire privé `backups/deployment-20260906-comptoirs/`, exclu de Git.

Les scripts `scripts/release/deploy-comptoir-dossier.mjs` et `deploy-comptoir-upload.mjs` imposent le projet cible, les empreintes des sources et une répétition préalable. Ils constituent la trace de cette publication, pas une commande à réexécuter après application.

Les formulaires Site et Artisan ne sont pas modifiés. Les identifiants et rattachements des Comptoirs existants sont conservés. Les anciens points d’entrée de création/modification d’un Comptoir dirigent vers le nouveau dossier ; les autres types d’organisations gardent leur parcours.

Le frontend est publié uniquement depuis le commit poussé sur `SONASP_2026`, après `build:release`. Les contrôles Comptoirs rejoignent la barrière de régression existante des sites, artisans, affiliations et collecteurs.
