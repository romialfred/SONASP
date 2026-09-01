-- Only the isolated clone: public-data dumps omit auth identities. Supply inert FK fixtures.
DO $$
BEGIN
  IF current_database()<>'sonasp_label_validation_20260831' THEN
    RAISE EXCEPTION 'Exécution réservée à la copie locale isolée';
  END IF;
  INSERT INTO auth.users(id,banned_until)
    SELECT id,'infinity'::timestamptz FROM public.user_profiles
    WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=user_profiles.id);
END $$;
