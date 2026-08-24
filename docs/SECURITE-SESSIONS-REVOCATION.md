# Révocation des sessions SONASP

## Garantie effectivement fournie

Le registre `public.user_sessions` et Supabase Auth/GoTrue sont deux plans de
contrôle distincts. Une ligne applicative révoquée bloque immédiatement les RPC
qui appellent `snp_require_active_session`, mais elle ne supprime pas à elle seule
les refresh tokens GoTrue.

La fonction Edge `revoke-user-sessions` applique donc les garanties suivantes :

| Demande | Registre applicatif | Refresh tokens GoTrue | Access JWT déjà émis |
| --- | --- | --- | --- |
| Le titulaire révoque toutes ses sessions | Révoqué | Révoqués avec `auth.admin.signOut(jwt, 'global')` | Valide jusqu'à `exp`, mais refusé immédiatement par les RPC protégés |
| Le titulaire conserve la session courante | Autres sessions révoquées | Autres refresh tokens révoqués avec le scope `others` | Même limite jusqu'à `exp` |
| Owner/Admin révoque un autre compte | Révoqué après AAL2, `accounts.manage` et hiérarchie | **Non révoqués** | Valide jusqu'à `exp` sur les surfaces historiques non protégées |

Le mode est toujours renvoyé explicitement : `strong_self_global`,
`strong_self_others` ou `application_registry_only`. Le frontend refuse une
réponse incohérente qui prétendrait une révocation GoTrue forte en mode
`application_registry_only`.

## Pourquoi la révocation forte d'un tiers n'est pas simulée

L'API officielle `auth.admin.signOut` exige un JWT valide de l'utilisateur dont
les sessions doivent être terminées. Elle n'accepte pas un simple UUID cible.
Le portail ne collecte, ne stocke et ne transmet donc jamais le JWT ou le refresh
token d'un autre utilisateur à un administrateur.

`auth.admin.deleteUser(userId)` invaliderait les refresh tokens par suppression
du compte, mais cette action destructive n'est pas une primitive de gestion de
session et n'est volontairement pas utilisée. Un bannissement temporaire ne
révoque pas non plus les sessions existantes.

Références officielles :

- <https://supabase.com/docs/reference/javascript/auth-admin-signout>
- <https://supabase.com/docs/guides/auth/signout>
- <https://supabase.com/docs/guides/auth/sessions>

## Contrôles de l'endpoint

- Bearer validé par `auth.getUser` côté Edge ; aucun secret de service n'est
  livré au navigateur.
- AAL2, profil actif et national, capacité `accounts.manage`, RPC de hiérarchie
  et miroir de hiérarchie avant toute cible tierce.
- Mutation du registre par le client JWT de l'acteur, jamais par service role :
  `auth.uid()`, la session active et l'audit DB restent l'autorité.
- Corps JSON borné à 2 Kio, schéma fermé, UUID strict, motif de 10 à 500
  caractères et CORS par allowlist.
- Réponses `no-store`, erreurs génériques et aucun jeton dans le corps ou les
  journaux.
- Si GoTrue échoue après la révocation applicative self, la fonction retourne
  un état partiel explicite et un HTTP 502 ; elle ne déclare jamais un succès
  fort.

## TTL JWT recommandé

Pour ce portail à données sensibles, la cible recommandée est un access JWT de
**5 minutes**, après test de charge et validation du rafraîchissement dans tous
les navigateurs supportés. Un palier de déploiement à **10 minutes** est prudent
si la charge Auth ou la qualité réseau n'est pas encore mesurée. Ne pas descendre
sous 5 minutes : Supabase le déconseille à cause du rafraîchissement fréquent,
de la dérive des horloges et des requêtes longues.

Ce réglage se fait dans les paramètres Auth du projet, pas dans le frontend. Il
borne la fenêtre résiduelle des JWT stateless sur les anciennes policies/RPC qui
n'appellent pas encore `snp_require_active_session`.

## Déploiement et vérification

1. Appliquer et valider le lot DB sessions avant le frontend :
   `snp_sessions_revoquer_toutes` et `snp_require_active_session` doivent être
   présents avec leur contrat final.
2. Déployer `revoke-user-sessions` avec les secrets Edge standards
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`.
3. Tester AAL2 et la hiérarchie Owner/Admin sur une cible de test, puis confirmer
   que `application_registry_only` est présenté comme tel dans la télémétrie.
4. Tester les scopes self `others` et `global` sur deux navigateurs et vérifier
   qu'aucun refresh n'est possible après révocation.
5. Ramener le TTL JWT progressivement à 10 puis 5 minutes, avec surveillance des
   erreurs de refresh et de la charge Auth.

## Risque résiduel à traiter

Les RLS et RPC historiques qui contournent `snp_require_capability` ou
`snp_require_active_session` peuvent encore accepter un access JWT révoqué
jusqu'à son expiration. Leur migration vers la garde de session active reste le
contrôle prioritaire ; le TTL court est une borne temporelle, pas un substitut.
