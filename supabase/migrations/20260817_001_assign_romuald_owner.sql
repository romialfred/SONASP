-- Réconcilie le profil historique avec l'identité Auth actuelle et attribue
-- le niveau applicatif Owner à romuald.tiegnan@gmail.com.
--
-- `user_profiles.role` reste `management` pour conserver la compatibilité avec
-- les politiques RLS historiques. Le rôle Owner, plus privilégié, est stocké
-- dans auth.users.raw_app_meta_data, qui n'est pas modifiable par l'utilisateur.

DO $$
DECLARE
  v_email constant text := 'romuald.tiegnan@gmail.com';
  v_auth_id uuid;
  v_profile_id uuid;
BEGIN
  SELECT id
  INTO v_auth_id
  FROM auth.users
  WHERE lower(email) = v_email
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Compte Auth introuvable pour %', v_email;
  END IF;

  SELECT id
  INTO v_profile_id
  FROM public.user_profiles
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    VALUES (v_auth_id, v_email, 'TIEGNAN Romuald', 'management', true);
  ELSIF v_profile_id <> v_auth_id THEN
    -- Le profil historique peut être référencé par des documents d'audit.
    -- On le conserve et on libère seulement l'adresse e-mail unique.
    UPDATE public.user_profiles
    SET email = 'legacy+' || v_profile_id::text || '@sonasp.invalid',
        updated_at = now()
    WHERE id = v_profile_id;

    INSERT INTO public.user_profiles (
      id,
      email,
      full_name,
      phone,
      role,
      is_active,
      two_factor_enabled,
      language,
      email_notifications,
      approval_notifications
    )
    SELECT
      v_auth_id,
      v_email,
      full_name,
      phone,
      'management',
      true,
      two_factor_enabled,
      language,
      email_notifications,
      approval_notifications
    FROM public.user_profiles
    WHERE id = v_profile_id;
  ELSE
    UPDATE public.user_profiles
    SET role = 'management',
        is_active = true,
        updated_at = now()
    WHERE id = v_auth_id;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'owner')
  WHERE id = v_auth_id;
END;
$$;
