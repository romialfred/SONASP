# Environnement de recette — constat du 7 septembre 2026

État : **BLOQUÉ pour la recette authentifiée complète**, à la révision `83f8c74ea83c81a2734ef9e086c2edd211573ebe`, branche de travail `codex/amelioration-integrale`. Aucun enregistrement de recette n'a été écrit en production. Ce document ne certifie aucun formulaire.

## Contrôles exécutés

| ID | Contrôle | Résultat et limite |
|---|---|---|
| ENV-01 | Classification des fichiers de configuration sans imprimer leurs valeurs sensibles | `.env` configure `VITE_SUPABASE_URL` vers le projet de **production**. `.env.local` n'apporte pas de cible Supabase isolée. Le frontend stable `127.0.0.1:5180` ne doit pas être utilisé pour les écritures de recette. |
| ENV-02 | CLI et services locaux | Docker CLI 29.6.2 et PostgreSQL CLI 18 présents. Supabase CLI absent du PATH et des trois emplacements usuels examinés. PostgreSQL Windows écoute sur 5432. |
| ENV-03 | Docker Engine | Initialement arrêté ; lancement de Docker Desktop en arrière-plan. Deux contrôles bornés de l'API Docker (`version`, `ps -a`) expirent après 10 secondes. Aucun conteneur n'a pu être attesté opérationnel. WSL recense `docker-desktop`. |
| ENV-04 | Connexion PostgreSQL locale en lecture seule, sans mot de passe supposé | `psql -X -w -h 127.0.0.1 -p 5432 -U postgres -d postgres` refuse la connexion : `fe_sendauth: no password supplied`. La seule présence du service ne démontre ni le schéma attendu ni un accès de recette. |
| ENV-05 | Miroir ancien | Le dossier `F:/Development/SONASP-local-mirror` contient `supabase/snippets`, aucun `supabase/config.toml`. Le runner historique vise un conteneur nommé `supabase_db_SONASP-local-mirror`, actuellement non accessible. Il n'est pas relancé contre une base supposée jetable. |
| ENV-06 | Intégrité des migrations | `verify` réussit. `audit` strict échoue : 257 SQL, 169 versions distinctes, 11 groupes dupliqués, 11 fichiers non versionnés, 103 préfixes et 8 noms non canoniques ; 134 constats structurels. Ce contrôle est statique, sans connexion à une base. |
| ENV-07 | Reconstruction complète | Preuve historique du 24 août : échec sur `assay_certificates` absente au premier script reconnu. Aucun `CREATE TABLE` de cette table ni de `assay_certificate_data` trouvé dans les migrations actuelles. Le reset n'a **pas** été relancé dans cette mission. |
| ENV-08 | Sauvegardes/baselines disponibles | Un export local `public-before.sql` du 30 août existe, mais il est ancien, limité au schéma public et sa convergence avec la version courante n'est pas attestée. Les deux fichiers de sauvegarde du 4 septembre examinés ont une taille nulle. Aucun n'est déclaré restaurable ou utilisé comme baseline de recette. |
| ENV-09 | Bancs de test existants | `docs/multiportail-qa` utilise des réponses simulées ; `docs/affiliation-qa` utilise PGlite, identités injectées et stockage de fichiers en mémoire. Utiles aux tests ciblés, ils ne fournissent pas une vraie connexion Auth/MFA, une pile Storage/Edge complète ni une preuve de recette intégrale. |

Résultat reproductible expurgé : [preflight-result.json](preflight-result.json). Relancer uniquement les lectures :

```powershell
node docs/amelioration/environnement/preflight.mjs
```

Le runner n'imprime aucune clé, aucun mot de passe et aucune URL signée. Il n'effectue ni `reset`, ni `repair`, ni mutation distante. Sa sortie `NOT_PROVEN` est volontaire : une réponse Docker positive ne certifie pas à elle seule les parcours métier.

## Prérequis manquants précis

Une des deux solutions suffit, après contrôle :

1. **Préproduction déjà existante** : projet Supabase distinct de la production, cible frontend dédiée, vrais comptes synthétiques par portail et permissions, MFA utilisable, deux sociétés minières et deux comptoirs, Storage privé et Edge Functions correspondants, accès de lecture des valeurs persistées et autorisation des écritures/nettoyages de recette. Les intégrations de courriel/DGI doivent être dirigées vers un réceptacle de test autorisé, sans notification aux personnes réelles.
2. **Pile locale séparée** : Docker opérationnel ou stack locale équivalente, baseline de schéma approuvée et récente couvrant public/Auth/Storage, RLS, grants, triggers, fonctions et référentiels, procédure de restauration relue, puis comptes synthétiques avec MFA et fonctions Edge locales. Ne pas réutiliser les utilisateurs, mots de passe ou données personnelles du dump production. Ne pas désactiver les contrôles de session ou le MFA pour rendre le parcours exécutable.

Question ciblée au responsable : **quel environnement Supabase de test isolé est autorisé, avec accès sécurisé aux comptes/MFA multirôles et lecture de la base ; à défaut, où se trouve la baseline récente approuvée pour préparer la pile locale ?** Les secrets se transmettent via le mécanisme sécurisé de l'environnement, jamais dans le rapport ou dans Git.

## Préparation suivante, conditionnée à ces éléments

Réserver une origine frontend distincte (par exemple port 5194 après contrôle de disponibilité) et un projet local au nom unique ; ne pas réaffecter 5180/5186. Utiliser un fichier d'environnement privé distinct, dont la cible est contrôlée avant le lancement. Préserver `.env` de l'utilisateur. Vérifier la pile entière et l'absence d'intégrations sortantes réelles avant création des fixtures. Nommer chaque jeu `QA-20260907-<lot>-<agent>`, puis relier les identifiants créés dans l'UI aux lectures de persistance et au nettoyage ciblé. L'auditeur rejoue les scénarios avant promotion.

## Sources

- `CLAUDE.md`, sections 9, 13, 15 ; prompt maître, sections 2.10, 8, 14 et 19.
- `docs/audits/BASELINE-MIGRATIONS-ET-REPRODUCTIBILITE-2026-08-24.md` et `PREUVE-RESET-SUPABASE-LOCAL-2026-08-24.md` : contexte historique, pas nouvelle exécution.
- `scripts/test-supabase-reset-isolated.ps1`, `scripts/release/stage-full-release.mjs` : mécanismes existants examinés, non exécutés.
- [Documentation officielle Supabase sur le développement local](https://supabase.com/docs/guides/local-development/database-migrations), consultée le 7 septembre 2026 : une pile locale et les schémas Auth/Storage doivent être préparés explicitement ; le catalogue de fichiers seul ne suffit pas.
