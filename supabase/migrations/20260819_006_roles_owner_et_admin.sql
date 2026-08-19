-- ============================================================================
-- Rôles `owner` et `admin` acceptés par le référentiel des comptes
--
-- `user_profiles_role_check` n'admettait que factory, airport, refinery,
-- customer et management. Or le code en définit sept : `UserRole` et
-- `ROLE_PERMISSIONS` connaissent `owner` et `admin`, `ProtectedRoute` accorde à
-- `owner` le contournement de toute restriction de rôle, et dix routes se
-- réservent à `['management', 'admin']`.
--
-- Aucun compte ne pouvait donc porter ces deux rôles. Le contournement était une
-- liste d'adresses codée en dur dans `AuthContext` (`OWNER_ACCOUNT_EMAILS`), qui
-- forçait le rôle à l'exécution sans que la base en sache rien : le profil
-- affichait « management » pendant que l'application traitait le compte en
-- propriétaire.
--
-- Élargissement d'une contrainte CHECK : aucune ligne existante n'est invalidée.
--
-- Retour arrière :
--   ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;
--   ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
--     CHECK (role = ANY (ARRAY['factory','airport','refinery','customer','management']));
--   À ne faire qu'après avoir ramené les comptes `owner` et `admin` à
--   `management`, faute de quoi la contrainte serait rejetée.
-- ============================================================================

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (
    role = ANY (ARRAY['owner'::text, 'admin'::text, 'management'::text,
                      'factory'::text, 'airport'::text, 'refinery'::text, 'customer'::text])
  );

-- Compte de présentation : propriétaire, tous droits.
UPDATE user_profiles
SET role = 'owner', is_active = true, updated_at = now()
WHERE lower(email) = 'romuald.tiegnan@gmail.com';
