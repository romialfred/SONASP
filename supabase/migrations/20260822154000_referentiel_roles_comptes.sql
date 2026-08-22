-- Aligne le référentiel distant des rôles avec les portails effectivement
-- proposés par l'administration. La contrainte historique ne connaissait pas
-- encore les comptes de société minière (`mine`) ni le lecteur transverse
-- (`manager`), ce qui faisait échouer leur création après l'étape Auth.

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (
    role = ANY (ARRAY[
      'owner'::text,
      'admin'::text,
      'management'::text,
      'manager'::text,
      'mine'::text,
      'factory'::text,
      'airport'::text,
      'refinery'::text,
      'customer'::text
    ])
  );
