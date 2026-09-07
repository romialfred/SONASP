# Qualification du lot artisanat

Revue statique du 7 septembre 2026. Les matrices générales 01/02/05 ne sont pas modifiées. Les trois fichiers `*_EXTRAIT_*_BASELINE.csv` conservent les identifiants et statuts d'origine ; ce sont des extraits de détection, pas des écrans validés. `comptages.json` donne les nombres calculés : 25 couples portail/module candidats, 502 lignes d'écrans/actions et 502 scénarios génériques. Parmi ces lignes, 46 proviennent de déclarations de routes JSX. Les 58 valeurs distinctes de colonne `route` comprennent aussi des chemins combinés de consommateurs/alias. Les compteurs d'actions, formulaires HTML et routes ne doivent pas être additionnés pour inventer un nombre de formulaires métier distincts.

La revue approfondie couvre les dossiers de sites, artisans, collecteurs, comptoirs, les sous-formulaires de documents/moyens de paiement et les parcours de droits/cartes. Les ventes, infractions, paiements, stocks et rapports connexes sont conservés dans le dénominateur et restent à qualifier en profondeur. Aucune exécution Auth/API/base ni recette navigateur de ce lot n'a été réalisée ici.

## Portails et accès observés

Le registre `src/lib/routeAccessRegistry.ts:82` à `222` contient les règles explicites du lot. Owner est transversal selon le moteur du registre ; Admin et ses modules autorisés sont à contrôler, sans déduire une permission serveur de la simple présence d'un menu.

| Parcours | Contextes frontend explicites | Contrôle complémentaire observé |
|---|---|---|
| Création/modification site, création artisan, création/modification comptoir | Owner, Admin, DGMG | `canManageMiningRegistry` exige profil actif, aucune mine, rôle owner/admin/dgmg ; RPC et RLS à exécuter séparément |
| Liste/détail collecteur | Owner/Admin/DGMG/SONASP/Comptoir/Collecteur | Références et dossiers retournés par RPC ; délégation selon capacités et organisme |
| Création/modification collecteur | Owner/Admin/DGMG | Personne physique, un organisme SONASP ou comptoir, au moins un site |
| Liste/détail artisan | SONASP, Comptoir, Collecteur, DGMG, plus accès administrateur selon moteur | Le détail Collecteur reste consultatif et ne charge pas les infractions |
| Affiliations/cartes et infractions | Politique SONASP du registre, plus accès administrateur selon moteur | Capacités séparées `ARTISAN_CARDS_MANAGE`, `ARTISAN_MEMBERSHIP_MANAGE`, `ARTISAN_MEMBERSHIP_CONFIRM`, `ARTISAN_CARDS_ACTIVATE` |
| Portail collecteur | Type de compte collector, capacité COLLECTOR_OPERATE | Guards dédiés et RPC par périmètre |
| Portail comptoir | Type de compte comptoir, capacité COMPTOIR_MANAGE | Guards dédiés et RPC par organisme |
| Ventes/rapports fiscaux | SONASP/partenaires et DGI sur routes prévues | Ne pas élargir DGI aux écritures du référentiel |
| Vérification QR | Public, `/verifier-carte/:reference` | Retour limité de `snp_verifier_affiliation`, distinct du dossier privé |

Les sept libellés présents dans l'extrait 01 incluent un groupe technique « Public / identité / alias à qualifier ». Ce n'est pas un nouveau portail institutionnel. Direction/Présidence ne sont pas ajoutés artificiellement aux droits du module.

## Familles de formulaires et variantes réelles

Voir `matrice-formulaires-regles.csv`. Une ligne désigne soit un formulaire, soit une variante conditionnelle, soit un sous-formulaire/action ; la colonne `nature` évite de compter les trois comme des formulaires indépendants. Les routes création/modification partagent souvent le même composant et doivent pourtant être testées séparément en persistance. Les pages `CarteSuivi.tsx`, `CarteValidation.tsx`, `CarteExpirations.tsx` historiques ne sont pas les composants routés : `PrivateApp.tsx:159–161` importe trois fois `AffiliationsCartes.tsx` avec variantes de props. Ne pas valider les anciens composants pour conclure sur les routes actuelles.

## Défauts concrets et risques sourcés

| ID | Niveau | Constat et déclencheur | Source | État |
|---|---|---|---|---|
| ART-LECT-001 | P1 | Échec ventes/infractions dans le détail remplacé par `[]`. La fiche affiche faux zéro/faux dossier vide ; le test existant exige même « Aucune vente déclarée » après rejet. | `src/pages/artisan-minier/ArtisanMinierDetails.tsx:127–164`, `ArtisanMinierDetails.test.tsx:166` (avant correction) | Correction étroite réalisée ; 32 tests de composant réussis, incluant le contexte d'accès. Recette navigateur/base non exécutée. Voir `rapport-correction-lecture.md`. |
| ART-DASH-002 | P1 | Les trois chargements du tableau de bord interceptent chacun toute erreur pour retourner `[]`. Le catch externe ne peut signaler ces rejets ; une panne peut produire des indicateurs sans données présentés comme valides. | `src/pages/artisan-minier/ArtisanMinierDashboard.tsx:97–121` | OUVERT, pas modifié |
| ART-DASH-003 | P1 | Filtre d'un site construit une liste de localités puis compare `artisan.commune`, sans utiliser `artisan.artisanal_site_id`. Deux sites dans une même commune sont confondus ; un artisan rattaché à un site dont la commune diffère peut être exclu. | `src/pages/artisan-minier/ArtisanMinierDashboard.tsx:147–164` | OUVERT, pas modifié |
| SITE-CONC-004 | P1 | Sauvegarde du site par UPSERT de tous les champs sans version ni horodatage attendu. Deux utilisateurs ouvrant le même dossier peuvent s'écraser silencieusement. | `src/services/artisanalSiteService.ts:136–178`, `supabase/migrations/20260906093115_sites_artisanaux_formalisation_aea.sql:100–130` | OUVERT ; protocole concurrence/API à cadrer avant modification |
| AFF-ACK-005 | P2 | `load` et `loadDetails` capturent leurs erreurs ; `run` les attend puis affiche quand même son succès. L'action Actualiser passe une fonction vide : une relecture échouée peut coexister avec « Statut actualisé ». Une mutation peut être réussie, mais sa relecture n'est pas confirmée. | `src/components/artisan/AffiliationDossier.tsx:112–220`, `:347` | OUVERT ; séparer mutation confirmée et relecture échouée |
| LECT-VOL-006 | Risque structurel à reproduire | `getAll` artisans, `getAll/getByArtisan` ventes et `listSites` ne paginent pas et ne vérifient pas de total. Si le plafond REST est atteint, le résultat est accepté comme exhaustif. `getSite` recherche même l'identifiant dans cette liste ; un dossier au-delà de la tranche peut être déclaré introuvable. | `src/services/artisanMinierService.ts:112–120`, `artisanGoldSalesService.ts:86–112`, `artisanalSiteService.ts:103–113`, `:194–196` | Reproduction au-delà du plafond de l'environnement requise ; aucun nombre de lignes perdues affirmé |
| SITE-DOC-007 | Risque/qualité à qualifier | Toute erreur Storage des photos se transforme silencieusement en data URL ; aucun retour n'indique que le dépôt privé a échoué. Une lecture signée en erreur retourne chaîne vide, puis la galerie disparaît. Les photos réussies d'un ajout multiple ne sont pas rattachées si une compression du lot échoue. | `src/services/sitePhotoService.ts:43–72`, `src/pages/artisanal-sites/ArtisanalSiteForm.tsx:306–329`, `ArtisanalSiteDetails.tsx:34–40` | À cadrer ; aucun contournement RLS ni fuite démontré |

Ces constats sont obtenus par inspection de code. Ils ne prouvent pas que le défaut est actuellement rencontré en production. Seul ART-LECT-001 reçoit une modification applicative dans ce lot.

## Ce qui existe déjà et doit être préservé

- Site : type forcé artisanale, catégorie formalisé/non formalisé, AEA conditionnelle, RPC atomique site/deux responsables, événement `SITE_DATA_CHANGED`, nom réel dans le détail. Conformité : indice opérationnel, non décision juridique ; planifié non évalué, pénalités d'occupation/déclaration/suspension dans `artisanalSiteInsights.ts:49–72`. Aucune pénalité AEA inventée.
- Artisan : RPC de dossier avec identifiant de création, version `expectedUpdatedAt`, confirmation de transition de rôle ; documents et moyens de paiement peuvent échouer après la fiche mais le message annonce explicitement la reprise. La personne morale possède un responsable distinct. L'aide exploitant possède une relation exploitant requise.
- Collecteur : un dossier physique, plusieurs sites, un organisme ; sauvegarde RPC avec version ; reprise des pièces échouées sans recréation du dossier. Les agrégats du détail utilisent uniquement les ventes attribuées explicitement au collecteur, paginent par 500 et signalent les taxes historiques inconnues.
- Comptoir : société de droit burkinabé, 33 clés de formulaire existantes, listes forme juridique/régime/DGI, métadonnées et pièces typées, RPC avec version et clé de requête, relecture après sauvegarde. Le détail réutilise `ComptoirDossierForm` en lecture seule.
- Affiliation : instantané et fichiers distincts du statut métier, droits et encaissements conservés, preuve privée, confirmation par agent habilité, génération après paiement confirmé et activation manuelle sous conditions serveur existantes. La génération technique n'est pas une autorisation d'opérer.
- Le fichier `src/data/artisanalSitesData.ts` ne contient actuellement que la frontière géographique nationale ; son nom n'est pas une preuve de données de sites fictifs. Les données `DEMO_ARTISANAL_SITES` détectées sont sous `src/test/fixtures/`. Aucun faux chiffre runtime explicite n'a été identifié par la recherche ciblée ; cela ne constitue pas une certification d'absence dans tout le lot.

## Recette réelle à instancier

Pour chaque famille : créer un dossier identifié QA dans une préproduction autorisée ; relire DB et détail ; recharger ; vérifier liste, recherche, filtres et chiffres ; modifier chaque champ ; préserver IDs/relations/pièces ; tester échec réseau, double soumission et concurrence ; vérifier profils autorisés/interdits avec RLS réelle ; nettoyer seulement les artefacts QA créés ; auditer les preuves. Chaque ligne 05 reste NON EXÉCUTÉ tant que cette chaîne n'est pas attestée. Tester séparément les variantes physique/morale/aide exploitant, site formalisé/non formalisé, organisme collecteur SONASP/comptoir, pièces comptoir et cycles de droits partiels/confirmés/annulés/expirés. Ne pas inventer des droits ou une date d'activation pour remplir les données manquantes.
