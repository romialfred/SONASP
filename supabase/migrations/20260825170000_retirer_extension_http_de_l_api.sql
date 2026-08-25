-- Retire les fonctions de l'extension `http` de la surface exposee par l'API.
--
-- CONSTAT, ETABLI PAR APPEL REEL SUR LA PRODUCTION
-- L'extension `http` est installee dans le schema `public`, dont PostgREST
-- expose toutes les fonctions sous /rest/v1/rpc/. Un appel
--   POST /rest/v1/rpc/http_get   {"uri": "http://127.0.0.1:1/"}
-- portant la seule cle anon — publique par construction, livree dans le
-- bundle du navigateur — a ete execute par le serveur de base de donnees, qui
-- a repondu « Failed to connect to 127.0.0.1 port 1 ». La requete sortante est
-- donc bien emise par la base.
--
-- Il s'agit d'une falsification de requete cote serveur, sans authentification :
-- atteinte des services internes, des metadonnees d'infrastructure, et
-- exfiltration possible via http_post vers un hote choisi par l'appelant. Elle
-- contournerait egalement toute liste blanche mise en place plus tard pour les
-- echanges avec la DGI, l'appel ne passant pas par la fonction de bord prevue.
--
-- POURQUOI UN SIMPLE REVOKE NE SUFFIT PAS
-- L'extension appartient a `supabase_admin`, alors que les migrations
-- s'executent sous `postgres`, qui n'en est pas membre. Un REVOKE emis par un
-- non-proprietaire est sans effet : verifie en production, ou la premiere
-- version de cette migration a ete rejetee par son propre postflight, les 38
-- droits d'execution subsistant apres coup. La transaction a ete annulee et
-- rien n'a ete modifie.
--
-- PARTI PRIS
-- L'extension est recreee dans le schema `extensions`, prevu par Supabase pour
-- cet usage et non expose par PostgREST. `ALTER EXTENSION ... SET SCHEMA` est
-- refuse par pg_http, d'ou la recreation. Les droits d'execution restent
-- accordes aux roles applicatifs, Supabase les reattribuant et la propriete
-- revenant a `supabase_admin` : la defense en profondeur reste donc
-- incomplete, mais la surface joignable depuis l'API est fermee, ce qui est
-- l'objet de cette migration. Retirer ces droits demanderait une intervention
-- sous `supabase_admin`, hors de portee d'une migration.
--
-- PREREQUIS VERIFIE : aucune fonction metier n'appelle http_get, http_post,
-- http_put ni http_delete. La suppression ne rompt donc aucune dependance.
--
-- RETOUR ARRIERE
--   DROP EXTENSION http;
--   CREATE EXTENSION http SCHEMA public;
-- Ce retour arriere rouvre la faille : il n'a de sens que pour un diagnostic.

BEGIN;

-- Preflight : ne rien tenter si une fonction metier depend de l'extension.
DO $$
DECLARE
  v_dependantes integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    RAISE NOTICE 'Extension http absente : rien a durcir.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_dependantes
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname NOT LIKE 'http%'
     AND (p.prosrc LIKE '%http_get(%'
       OR p.prosrc LIKE '%http_post(%'
       OR p.prosrc LIKE '%http_put(%'
       OR p.prosrc LIKE '%http_delete(%');

  IF v_dependantes <> 0 THEN
    RAISE EXCEPTION
      'Preflight : % fonction(s) metier dependent de l''extension http.',
      v_dependantes;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'http' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP EXTENSION http';
    EXECUTE 'CREATE EXTENSION http SCHEMA extensions';
  END IF;
END;
$$;

-- Postflight : plus aucune fonction http dans le schema expose.
DO $$
DECLARE
  v_dans_public integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_dans_public
    FROM pg_depend d
    JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'http'
    JOIN pg_proc p ON p.oid = d.objid
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE d.deptype = 'e'
     AND n.nspname = 'public';

  IF v_dans_public <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % fonction(s) http subsistent dans le schema public.',
      v_dans_public;
  END IF;
END;
$$;

COMMIT;

-- PostgREST met en cache la liste des fonctions exposees : sans rechargement,
-- il continuerait de router les appels vers des fonctions disparues.
NOTIFY pgrst, 'reload schema';
