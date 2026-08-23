# Matrice de tests et de recette

## Contrôles automatisés exécutés

| Contrôle | Commande | Résultat |
|---|---|---|
| lint global | `npm run lint` | réussi, 0 erreur |
| typecheck strict | `npm run typecheck` | échec : dette historique et schéma généré non encore alignés |
| tests complets | `npm run test -- --run` | 108 fichiers, 881 tests réussis |
| build production | `npm run build` | réussi, 3 342 modules, 32,85 s |
| cohérence patch | `git diff --check` | réussi, avertissements EOL seulement |

## Recette obligatoire avant GO

| Domaine | Cas nominal | Cas de refus/erreur | Preuve |
|---|---|---|---|
| création de compte | courriel reçu, mot de passe choisi, TOTP enrôlé | SMTP indisponible, lien expiré/réutilisé | capture + journaux corrélés |
| session | activité maintient la session | popup 9 min, logout 10 min, fermeture onglet | vidéo E2E + timestamps |
| rôle/périmètre | accès du rôle à ses modules | route directe, rôle modifié, mine A vers B | matrice HTTP/SQL |
| Owner | sélection d'une mine et vue de son profil | ID absent/inactif/non mine | journaux + captures |
| production | prévision puis déclaration | quantité invalide/double soumission | lignes et audit |
| expédition | enlèvement, fret, douane, réception | transition hors ordre/rejet | machine à états |
| vente | spot/forward/in_process | client non autorisé, raffinerie absente | transaction rollback |
| approbation | décision unique | double clic/concurrence/décideur illégitime | test concurrent |
| documents | dépôt/lecture autorisés | vente étrangère/type interdit | réponse 403/RLS |
| paiement | émission, confirmation, rapprochement | dépassement/doublon/annulation | écritures équilibrées |
| cours | fournisseur disponible | timeout/valeur incohérente | aucune valeur fabriquée |
| nettoyage | suppression des lignes démo ciblées | conservation du réel et budgets ambigus | comptages signés |
| sauvegarde | restauration complète | corruption/interruption | RPO/RTO mesurés |

## Limites du contrôle local

Le démon Docker/Supabase local n'était pas disponible. Les migrations SQL n'ont
donc pas été exécutées dans une base jetable et ne doivent pas être appliquées
directement en production. L'audit npm n'a pas abouti à cause d'une résolution DNS
du registre npm indisponible.
