# Matrice de traçabilité des recommandations

| Recommandation | Implémentation | État | Validation |
|---|---|---|---|
| comptes sans mot de passe communiqué | lien GoTrue, gabarit SONASP, compensation à l'échec | déployé | smoke test courriel restant |
| MFA obligatoire | TOTP + `aal2` + protections de routes/RLS préparées | implémenté localement | recette DB/E2E restante |
| session 10 minutes | avertissement 9 min, fermeture 10 min, session navigateur | implémenté | tests unitaires verts, E2E restant |
| Owner multi-mines | sélection bornée au rôle Owner, périmètre serveur | implémenté | matrice inter-sociétés restante |
| supprimer faux cours | services live sans repli aléatoire | implémenté | test d'indisponibilité vert |
| décisions sensibles atomiques | RPC d'approbation, décision client, création vente | implémenté | tests unitaires verts, DB restante |
| contrôler client/raffinerie | client autorisé, SONASP active, raffinerie approuvée pour `in_process` | implémenté | tests service verts |
| cloisonner documents | vente obligatoire et contrôlée | implémenté | tests service verts, RLS restante |
| retirer données factices | fixtures hors runtime + migration ciblée | implémenté localement | rapprochement recette restant |
| retirer fonctions fictives | suppression `send-email` et `send-activation-email` | implémenté | recherche statique propre |
| supprimer analytique/IA simulée | routes, menu, services et écrans retirés | implémenté | navigation/tests verts |
| stabiliser performances | devis explicite, services inutiles retirés, chunks rationalisés | implémenté | build vert, profilage lourd restant |
| qualité stricte | type généré, lint/tests/build exécutés | partiel | lint et build verts ; typecheck strict rouge |
| sécurité RLS globale | migrations de restriction préparées | partiel | application et preuve recette obligatoires |
| facturation réglementaire | marquage spécimen conservé | non homologué | validation DGI obligatoire |
| restauration/PRA | exigence documentée | non exécuté | exercice de restauration obligatoire |

Une ligne « implémentée localement » ne peut être reclassée « active » qu'après
application contrôlée, preuve reproductible et validation métier/sécurité.
