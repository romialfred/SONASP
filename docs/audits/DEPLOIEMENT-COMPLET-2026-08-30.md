# Publication complète SONASP — 30 août 2026

État : **publié en production**, après sauvegarde, répétition SQL, tests et bascule explicite du domaine.

## Version livrée

- Site : https://sonasp.data-univers.com
- Vercel : `dpl_BHgY3cssVueQ86YtsSHrUddCSE2U`, état `READY`.
- Build public vérifié : `f37a3f7f2c3a-mtge6ddc`.
- Empreinte SHA-256 du manifeste des sources publiées : `f37a3f7f2c3a8094fb726ae15ec826f7f0045122b5da9401cae24326f3916a5d`.
- Sources : état de travail local complet de l'application, y compris les fichiers non encore suivis. Cette empreinte est celle de l'instantané, **pas un commit Git**. Aucun commit ni push effectué.
- Construction distante : 3 220 modules transformés, compilation réussie, installation npm sans vulnérabilité signalée.
- Seuls les fichiers nécessaires à la construction ont été transmis : ni sauvegarde, ni `.env`, ni données de test, ni documents d'audit.

L'ancienne production du 27 août reste disponible pour retour arrière : `dpl_HzaTwq1oH7iyunmhEnHBMB5uxCAU` / `sonasp-9zickvwj2-business-tech-services.vercel.app`.

## Base de données

Projet Supabase : `yyverzuhkdonjjuficor`.

Sept migrations ont été appliquées dans une seule transaction, après répétition avec `ROLLBACK` sur la base liée et vérification sur copies locales isolées :

| Version | Objet |
| --- | --- |
| 20260827203000 | Numérotation et intégrité des ventes artisanales |
| 20260829204000 | Conservation stock/réserve, entrées atomiques, sources et idempotence export |
| 20260829213000 | Cloisonnement fiscal DGI et validation limitée DGMG |
| 20260830110000 | Réponse Mine aux demandes d'achat |
| 20260830120000 | Conciliation sur expédition effective, preuves et impacts fiscaux |
| 20260830171500 | Session active exigée pour consulter les ventes |
| 20260830222700 | Helpers manquants, séparation des fonctions et registre des dépendances comptes |

Les définitions critiques Owner/Administrateur ont été empreintées avant/après. Les données des **195 tables protégées** et les caractéristiques physiques des actifs sont inchangées. Le compte Owner reste actif ; le plafond Administrateur comporte toujours les 18 domaines. Les anciennes migrations susceptibles de réinitialiser les droits n'ont pas été rejouées.

Deux écritures techniques d'entrée de stock en double ont été consolidées. Aucun lot, vente ou compte n'a été supprimé. Aucun ajustement du disponible n'était nécessaire. Les mouvements canoniques ont été normalisés d'après le poids fin de leur inventaire.

Une dépendance nouvelle, `snp_export_sale_idempotency.actor_id`, a été ajoutée au registre contrôlé de suppression des comptes pour ne pas rendre ce contrôle inutilisable après la migration Stock.

L'historique ancien reste divergent (versions courtes, doublons et anciens scripts partiellement supersédés). Aucun `migration repair`, reset ou maquillage de cet historique. Les sept nouvelles inscriptions conservent les instructions SQL exactes et leur checksum ; les anciens scripts institutionnels déjà présents ou supersédés n'ont pas été rejoués.

## Services serveur

Les sources publiées ont été téléchargées dans des répertoires séparés puis comparées aux sources locales et à leurs dépendances.

| Service | Version finale |
| --- | --- |
| create-user | 8 |
| envoyer-courriel | 10 |
| get-users | 8 |
| get-user-details | 3 |
| manage-user-status | 3 |
| delete-user | 5 |
| reset-user-password | 4 |
| revoke-user-sessions | 3 |
| sensitive-upload | 3 |
| activate-account | 1 |
| public-assistance | 1 |
| fetch-daily-fx-rates | 1 |
| fetch-daily-lbma-prices | 1 |
| scheduled-tasks | 1 |

Les 14 services sont `ACTIVE`. Douze ont été publiés explicitement. `create-user` et `sensitive-upload` avaient déjà les bonnes sources ; la configuration de secrets entraîne également leur nouvelle version d'exécution. `create-user` a été revérifié après cette opération.

L'assistance publique reçoit son origine autorisée et un sel aléatoire privé, ajoutés sans remplacer les secrets existants. Son précontrôle HTTP 204 a été corrigé pour ne pas renvoyer de corps. Les outils `senior-devops`, `migration-architect` et `env-secrets-manager` ont guidé les validations, la sauvegarde et l'exclusion des secrets des fichiers publiés.

Les fonctions de collecte de cours et le planificateur sont publiés avec leurs contrôles d'accès. **Aucun nouveau cron ni déclenchement de tâche n'a été créé.** `CRON_SECRET` n'était pas configuré : le planificateur refuse les appels tant que son exploitation n'est pas configurée. Aucun cours ni paiement n'a été fabriqué pour vérifier la publication.

## Vérifications

- Vitest : **254 fichiers, 1 980 tests réussis**.
- ESLint et TypeScript : réussis ; lint relancé après les ajouts de livraison.
- Catalogue : **224 fichiers conformes**, dette historique inchangée ; **10 tests** du contrôleur d'intégrité réussis.
- SQL : **361 assertions** réparties sur 16 scénarios, avec transactions annulées. Scénarios IAM/conciliation/paiements sur copie dédiée aux fixtures ; conservation, réserve, portails fiscaux et catalogue sur copie du schéma et des données réels. Les tests anciens présumant un catalogue vide ont été adaptés à une base nommée explicitement ; les attentes de rôles ont été alignées sur Owner et le plafond Admin déjà approuvés. Le scénario de journaux de session utilise un Client pour isoler les sessions des attributions automatiques d'un Administrateur.
- Services : **24 contrôles HTTP** réussis (appels sans session/payload refusés et précontrôles CORS).
- Frontend public : **11 contrôles** réussis (empreinte, sept routes SPA, JS/CSS et service worker).
- Navigateur : accueil public et formulaire de connexion rendus, notification de mise à jour volontaire observée. Le test navigateur n'a pas créé de compte ni transmis de paiement.

Les réponses HTTP 200 des routes privées prouvent la disponibilité du shell SPA, pas l'accès authentifié. Aucun compte réel n'a été créé, aucune invitation ni message de test envoyé. La livraison effective SMTP et les parcours authentifiés complets restent à recetter avec des identités et destinataires convenus. Ces contrôles ne constituent pas une garantie d'absence de tout défaut préexistant.

## Sauvegarde et retour arrière

Sauvegarde durable, hors dépôt et hors fichiers publiés :

`C:/Users/romia/.codex/backups/sonasp/release-20260830T2213`

Elle contient le schéma public (1 753 850 octets), les données publiques (3 869 570 octets), les sources précédentes de chaque Edge modifiée, les inventaires, checksums, répétitions et reçus d'application. Le dump de données comporte des références circulaires : ne pas le restaurer aveuglément sur la base vivante ; effectuer une restauration isolée avec ordre/contraintes maîtrisés.

Pour le frontend, republier l'ancien déploiement avec `vercel promote` permet un retour ciblé. Pour SQL, préparer un correctif inverse relu ou une restauration ciblée depuis la sauvegarde, sans effacer l'historique ni perdre les opérations postérieures. Les sources Edge précédentes sont conservées par service, avec leurs dépendances exactes.

Après avoir enregistré leur travail, les utilisateurs peuvent cliquer sur **Mettre à jour maintenant** ou recharger une fois le site pour quitter l'ancienne version en mémoire.
