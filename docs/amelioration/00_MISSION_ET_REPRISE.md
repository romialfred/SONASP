# Amélioration intégrale FASO SANAMA — journal de mission

Mission autorisée le 7 septembre 2026 : exécuter `amelioration labs/Prompt_Maitre_Codex_Amelioration_Integrale_FASO_SANAMA.md` dans le projet existant. Ce document gouverne la mission complète et ses annexes ; les captures antérieures ne prouvent pas les enregistrements en base.

## État réel

**Mission inachevée. Aucun formulaire déclaré VALIDÉ. Aucun déploiement admissible.** Une base de préproduction réellement isolée et ses accès Auth/MFA/API/Storage/lecture DB manquent. Question ciblée envoyée au commanditaire dans la session. Les corrections locales et contrôles indépendants continuent ; ils ne remplacent pas la recette intégrée requise.

Branche de travail : `codex/amelioration-integrale`. Baseline locale et distante : `83f8c74ea83c81a2734ef9e086c2edd211573ebe`. Aucun push ni déploiement de ce lot. La modification/suppression préexistante de `Bonjour Monsieur SAKO,.txt`, les documents utilisateur et autres fichiers hors mission sont conservés sans intervention.

## Équipe réellement mobilisée

| Responsable | Fonction | Livrables / indépendance |
|---|---|---|
| Agent principal | Coordination, corrections frontend, tests de composants | Pages Clients et banques, service RPC ; ne s’auto-attribue aucune homologation |
| inventaire_architecture | Inventaire métier/technique, puis QA navigateur distincte | Matrices 01–04, plan Clients, captures et contrôles de présentation |
| environnement_recette | Diagnostic d’environnement, backend transactionnel, banc isolé | Préflight, migration additive, tests SQL embarqués et prévisualisation sans écriture |
| audit_independant | Audit séparé du code et des preuves | Critères atomiques, tests SQL complémentaires, revue frontend, décision indépendante |

L’agent ayant écrit le backend n’est pas son auditeur. La QA navigateur est exécutée par un agent distinct de l’implémentation frontend. Les tests du navigateur sont sérialisés.

## Périmètre conservé et organisation par lots

L’inventaire automatisé conserve 13 types de compte authentifiés et 12 identités graphiques. La matrice 01 comprend aussi le regroupement technique POR-public, soit 14 identifiants, sans en faire un portail institutionnel supplémentaire. Les 21 modules canoniques se distinguent des 30 codes de regroupement observés ; 139 couples portail/module restent candidats. La matrice contient 202 déclarations JSX de routes (201 motifs distincts), 10 sections profondes Direction et 2 motifs génériques ; 2 146 détections au total, dont actions, tableaux, modales et formulaires. Ces chiffres sont des détections à qualifier, pas un dénombrement de formulaires validés. Les occurrences ne sont pas additionnées comme formulaires distincts.

Chaque couple portail/module conserve son ID et son propriétaire proposé dans 01. Chaque écran/action garde son ID en 02 ; chaque décision de fonction pure reste distincte d’un accès serveur en 04. Le plan 05 conserve chaque détection dans le dénominateur de qualification, sans exclusion silencieuse.

Ordre d’exécution prévu, sans réduction du périmètre :

1. **Socle et pilote Clients internationaux** : défauts concrets de persistance, banques, détails, agrégats, scopes et navigation. Ce pilote sert à éprouver la chaîne de preuve avant généralisation.
2. **Référentiels et artisanat** : sites, artisans, collecteurs, comptoirs, affiliations/cartes, documents ; variations DGMG/SONASP/Administrateur et accès partenaires.
3. **Ventes et finance** : ventes artisanales et internationales, paiements, comptes, redevances, DGI ; cohérence client/vente/paiement et organisations A/B.
4. **Production et logistique** : mines, prévisions/licences, achats, expéditions, usine, aéroport, raffinerie, stocks/réserve.
5. **Supervision et administration** : Direction, tableaux de bord, rapports, documents, parties prenantes, utilisateurs, rôles, messagerie et paramètres.
6. **Transverse et public** : routes profondes, états vides/erreurs, responsive et zoom, navigation, login/vitrine, régressions croisées et pièces jointes.

Tous les portails existants sont concernés via les couples de 01, y compris les espaces sans formulaire direct. Aucun portail Présidence/Observatoire supplémentaire n’est inventé. Les modules hors pilote restent à qualifier et NON EXÉCUTÉS en recette.

## Itération en cours

Le pilote corrige les défauts de crédit zéro, banque libre tronquée, mutation des banques, sauvegarde non atomique, erreurs de lecture masquées, valeurs historiques invisibles, faux historiques/indicateurs, précision des montants, accès aux actions, contexte de navigation et réponses asynchrones obsolètes. Le backend conserve les IDs, désactive les comptes retirés et fait un rollback si une étape échoue. La migration n’a été appliquée à aucune base distante.

Les tests Vitest utilisent des doubles de service et ne prouvent pas une base réelle. Les tests PGlite exécutent bien du SQL mais utilisent une baseline dédiée et une session simulée. Le banc navigateur 5187 charge les composants réels avec fixtures ; un bandeau permanent et le refus de sauvegarde empêchent de le confondre avec une recette intégrée.

La QA de présentation indépendante et son complément IAB sont disponibles dans `preuves/presentation-clients/`. Les captures finales 06–20 sont des JPEG natifs (ordinateur 1536 × 1024, mobile 390 × 844), avec captures successives du cadre défilant. Elles ne sont pas des pages intégrales ni une preuve de persistance. Le manifeste complémentaire distingue les versions antérieures et les captures rejetées/reprises.

Un défaut voisin a été traité dans la lecture du détail Artisan : une erreur de ventes ou d’infractions ne doit pas devenir un faux zéro. Le lot a reçu une revue indépendante avec 38 tests de composants réussis, dont 6 contrôles indépendants ; la recette réelle reste non exécutée. Le formulaire de création/modification d’Artisan n’est pas modifié par ce correctif.

La première suite Vitest globale a exécuté ses assertions avec succès mais **échoué globalement** à cause d’un import dans une copie de test archivée. Les 31 copies de `backups/` ont toutes une source canonique byte-identique. La configuration exclut ces seules archives ; le rapport de découverte conserve la comparaison des fichiers et des noms de cas afin de ne pas confondre déduplication technique et réduction du périmètre fonctionnel.

## Reprise obligatoire

1. Lire 07 et 08, inspecter `git status`, conserver les modifications concurrentes.
2. Obtenir l’environnement isolé et ses comptes/MFA sans publier de secrets. Vérifier la cible avant chaque écriture.
3. Stabiliser et identifier la version candidate, comparer le schéma cible aux préconditions ; appliquer uniquement la migration additive autorisée en préproduction.
4. Rejouer les 12 scénarios UI intégrés du pilote : création complète, relecture DB du même ID, détails/liste, modification et relecture, droits et erreurs ; nettoyage limité aux données du run.
5. Faire auditer les preuves, corriger et répéter ; qualifier puis exécuter chaque autre lot du périmètre 01–05.
6. Déployer seulement si tous les critères applicables sont réussis et acceptés. Une note partielle ou des tests unitaires ne permettent pas de passer cette condition.

## Traçabilité complémentaire

Les 12 scénarios détaillés CLI-UI-001 à 012 du plan et de 03 sont désormais repris à l’identique dans 05. Le fichier 05_CORRESPONDANCE_IDS_PILOTE.csv conserve les anciens identifiants UI-CLI et leur correspondance sémantique, sans transférer de réussite ni supprimer d’exigence. Le contrôle design CLI-UI-011, déjà exigé dans le plan, est explicitement réintégré. Les 2146 lignes génériques restent intactes ; les 12 scénarios détaillés restent BLOQUÉS. Ces lignes ne sont pas un dénominateur de critères atomiques qualifiés.

Le registre actif des défauts ouverts de l’artisanat est également dans lot-artisanat/README.md : ART-DASH-002/003, SITE-CONC-004, AFF-ACK-005, LECT-VOL-006, SITE-DOC-007. Leur absence de correction ne constitue aucune exclusion du périmètre. Le mapping détaillé complémentaire est une préparation, sans preuve d’enregistrement.

Commit applicatif local de cette itération : `07ffc71ab9e1320df845694736a3f5af88141431` sur `codex/amelioration-integrale`. Les documents et preuves sont versionnés séparément. Aucun push ni déploiement.
