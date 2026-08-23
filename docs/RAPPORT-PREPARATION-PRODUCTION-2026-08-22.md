# Rapport de préparation à la production

## Verdict

**Candidat de recette : OUI. Production : NO-GO.**

Le frontend franchit le lint, les tests et le build, mais pas le typecheck strict.
Les autres blocages sont opérationnels et liés à la base de données : historique
de migrations, RLS distante, nettoyage contrôlé, recette des courriels,
homologation des factures et restauration.

## Éléments prêts

- lint sans erreur ; typecheck strict encore en échec ;
- 881 tests automatisés réussis ;
- build PWA de production réussi ;
- chaîne de compte SONASP déployée séparément sur Supabase ;
- MFA/session/routes durcis dans l'application ;
- décisions de vente et approbations conçues comme transactions serveur ;
- cours financiers sans données inventées ;
- écrans et services simulés retirés.

## Plan de mise en recette

1. sauvegarder la base et prouver la restauration sur une instance isolée ;
2. consolider un baseline des 117 migrations locales et de l'historique distant ;
3. restaurer des données anonymisées ;
4. appliquer les sept migrations du 22 août dans l'ordre ;
5. exécuter la matrice RLS et les tests concurrents ;
6. rapprocher les données supprimées/conservées avec les responsables métiers ;
7. valider la chaîne courriel sur des comptes de recette ;
8. exécuter les workflows E2E par rôle ;
9. réaliser l'audit de dépendances et le profilage des bundles lourds ;
10. obtenir les visas sécurité, métier, exploitation et conformité.

## Rollback exigé

- aucune migration directement sur la production sans sauvegarde restaurée ;
- comptage des lignes avant et après chaque migration ;
- fenêtre de maintenance et responsables nommés ;
- rollback testé, incluant Auth, Storage et tables métier ;
- conservation des journaux d'audit hors de la transaction de nettoyage.

## Responsabilités de validation

| Domaine | Visa requis |
|---|---|
| rôles, RLS, MFA | responsable sécurité |
| production, expédition, ventes | responsables métiers SONASP |
| paiements, rapprochements | direction financière |
| facturation/DGI | conformité fiscale et juridique |
| sauvegarde, supervision, incident | exploitation |
| publication finale | propriétaire de la plateforme |

Le GO final doit être formalisé ; il ne peut être déduit d'un simple build réussi.
