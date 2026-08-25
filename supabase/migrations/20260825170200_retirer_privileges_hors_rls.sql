-- Retire aux roles joignables par l'API les privileges que RLS ne filtre pas.
--
-- CONSTAT
-- Les roles `anon` et `authenticated` detiennent, sur la quasi-totalite des
-- tables du schema public, les privileges TRUNCATE, REFERENCES et TRIGGER,
-- herites du GRANT ALL applique lors de la mise en place du schema.
--
-- SELECT, INSERT, UPDATE et DELETE restent filtres par les politiques RLS.
-- Les trois autres non :
--   - TRUNCATE  vide une table sans declencher les politiques, sans passer par
--               les declencheurs de ligne, et sans laisser de trace metier ;
--   - TRIGGER   permet d'attacher un declencheur a une table, donc de faire
--               executer du code arbitraire lors des ecritures d'autrui ;
--   - REFERENCES permet de creer une cle etrangere vers une table, ce qui
--               autorise a inferer l'existence de valeurs non lisibles.
--
-- Ces privileges ne sont pas atteignables via PostgREST, qui n'expose ni
-- TRUNCATE ni la creation de declencheurs. Ils ne constituent donc pas une
-- faille directement exploitable aujourd'hui, mais ils annulent la defense en
-- profondeur : toute voie d'execution SQL ouverte plus tard, du SQL dynamique
-- mal echappe dans un RPC a une extension trop permissive, s'appuierait
-- dessus. Aucun usage legitime de la plateforme n'en depend.
--
-- PARTI PRIS
-- Les privileges reellement utilises par l'application sont conserves
-- intacts. Les privileges par defaut sont egalement corriges, faute de quoi
-- toute table creee ensuite les recevrait a nouveau.
--
-- RETOUR ARRIERE
--   GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
--     TO anon, authenticated;
-- Ce retour arriere restaure un etat non conforme au moindre privilege.

BEGIN;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Les tables creees ensuite ne doivent pas recevoir ces privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

-- Postflight : plus aucun de ces privileges, et les droits de lecture et
-- d'ecriture legitimes restent en place.
DO $$
DECLARE
  v_hors_rls integer;
  v_select_restants integer;
BEGIN
  SELECT count(*) INTO v_hors_rls
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER');

  IF v_hors_rls <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % privilege(s) hors RLS subsistent.', v_hors_rls;
  END IF;

  SELECT count(distinct table_name) INTO v_select_restants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND grantee = 'authenticated'
     AND privilege_type = 'SELECT';

  IF v_select_restants = 0 THEN
    RAISE EXCEPTION
      'Postflight : les droits de lecture ont ete retires par erreur.';
  END IF;
END;
$$;

COMMIT;
