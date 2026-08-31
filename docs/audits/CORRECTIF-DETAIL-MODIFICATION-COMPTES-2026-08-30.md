# Détail et modification des comptes — 30 août 2026

## Périmètre

Correction locale du parcours fiche utilisateur → modification / habilitations.
Aucune migration, modification de compte réel, modification RLS, publication ou
opération Git de commit/push n’a été effectuée pour ce correctif. Les changements
préexistants dans le formulaire et le reste du dépôt sont conservés.

## Cause confirmée

Lecture seule des politiques du projet Supabase lié : la politique
`admins_select_all_profiles` dépend de `is_admin_user(auth.uid())`. Cette ancienne
fonction reconnaît `admin` et `management`, mais pas `owner`. Le formulaire lisait
directement le profil cible avec PostgREST et recevait donc une absence de ligne.

La fiche, elle, utilise déjà `get-user-details`, qui vérifie session administrative,
AAL2, identité serveur, rôle et hiérarchie avant de lire le profil. Le formulaire
utilise désormais ce même service, sans élargissement des politiques historiques.

L’absence de profil laissait aussi `roleInitial` vide, ce qui déclenchait à tort le
message de niveau hiérarchique insuffisant et affichait un formulaire vide.

## Changements

- Chargement de l’identité via `getAdministrationUserDetails`, avec contrôle de
  concordance entre la cible demandée et la fiche reçue.
- Écran d’échec avec retour à la liste et réessai ; aucune saisie ou sauvegarde
  tant que les données nécessaires ne sont pas disponibles.
- Les erreurs de catalogue, permissions, responsabilités et rattachement ne
  peuvent plus conduire à l’enregistrement de valeurs par défaut à leur place.
- Annulation logique des lectures périmées et protection contre l’affichage ou
  l’enregistrement d’un compte précédemment consulté.
- Réinitialisation de l’identité et de l’étape au changement de parcours ; une URL
  de modification sans identifiant n’ouvre plus la création.
- Préchargement du lien collecteur actif et exclusion des rattachements expirés.
- Messages distincts pour compte indisponible, compte Owner protégé, propre compte
  et refus réel de hiérarchie ; onglet d’habilitations bloqué si non autorisé.
- Retrait de la note globale « Données partielles ». Les sections concernées
  continuent d’indiquer une source indisponible et leurs exports restent bloqués :
  aucune donnée manquante n’est remplacée par un zéro.

L’écriture conserve exclusivement la RPC transactionnelle
`snp_configurer_acces_compte`. Les contrôles serveur, la MFA, la révocation des
sessions et l’audit restent inchangés.

## Vérifications

- Analyse de portée `focused-fix` affinée sur les pages d’administration : petite
  portée, correction directe ; uniquement deux pages et leurs tests modifiés.
- 10 fichiers / 129 tests ciblés réussis sur la première passe élargie.
- `npm run lint` et `npm run typecheck` réussis, y compris couverture des types
  Supabase et compilation TypeScript.
- Build de production réussi : 3 204 modules transformés.
- Catalogue/checksums des migrations conformes, aucune dérive introduite.
- Serveur local : HTTP 200 sur `http://127.0.0.1:5180/`.
- 17 tests de non-régression ajoutés. Les 232 fichiers attendus ont été exécutés :
  1 756 tests réussis au total, sans échec d’assertion.
- La passe globale a terminé avec 230 fichiers / 1 735 tests réussis, mais un code
  de sortie non nul dû à deux délais de démarrage de workers. Les deux fichiers
  non exécutés (`GlobalDashboardEnhanced.test.tsx` et `ParametersPage.test.tsx`)
  ont ensuite été relancés seuls avec `--pool=forks --maxWorkers=1` : 2 fichiers /
  21 tests réussis, code de sortie 0. Le total ci-dessus combine ces deux passes ;
  il ne décrit pas une passe globale unique sans erreur d’infrastructure.
- Le premier lancement Vitest n’a exécuté aucun test (délai de démarrage des
  workers). Les passes suivantes exécutent effectivement les tests ; aucun test
  ni contrôle de sécurité n’a été désactivé.
- Aucun compte réel n’a été enregistré pendant les vérifications. L’onglet local
  disponible est déconnecté ; une connexion Owner a été demandée pour compléter
  le contrôle visuel authentifié.
- `git diff --check` réussi. Aucun déploiement distant effectué ; le correctif
  est disponible dans le code servi par la plateforme locale.
