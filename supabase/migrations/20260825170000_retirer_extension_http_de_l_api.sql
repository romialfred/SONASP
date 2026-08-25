-- Retire les fonctions de l'extension `http` de la surface exposee par l'API.
--
-- CONSTAT
-- L'extension `http` est installee dans le schema `public`. PostgREST expose
-- toute fonction de ce schema sous /rest/v1/rpc/<nom>, et les fonctions
-- http_get, http_post, http_put, http_delete, http_head et http sont
-- executables par `anon` comme par `authenticated`.
--
-- La cle anon est publique par construction : elle est livree dans le bundle
-- du navigateur. N'importe qui peut donc appeler
--   POST /rest/v1/rpc/http_get  {"uri": "..."}
-- et faire emettre une requete HTTP arbitraire par le serveur de base de
-- donnees. C'est une falsification de requete cote serveur complete, sans
-- authentification : reseau interne, metadonnees d'infrastructure, et
-- exfiltration possible via http_post vers un hote controle par l'appelant.
--
-- Elle contournerait egalement toute liste blanche mise en place plus tard
-- pour les echanges avec la DGI, puisque l'appel ne passerait pas par la
-- fonction de bord prevue.
--
-- PARTI PRIS
-- L'extension n'est pas desinstallee : aucune fonction metier ne l'appelle
-- aujourd'hui, mais une desinstallation romprait toute dependance future non
-- inventoriee. Seuls les droits d'execution sont retires aux roles joignables
-- par l'API. `service_role` conserve les siens : il n'est jamais expose au
-- navigateur et sert les traitements de confiance.
--
-- RETOUR ARRIERE
--   GRANT EXECUTE ON FUNCTION public.http_get(text) TO anon, authenticated;
--   -- et de meme pour chaque fonction de l'extension.
-- Ce retour arriere retablirait la faille : il n'a de sens que pour un
-- diagnostic, jamais comme etat durable.

BEGIN;

DO $$
DECLARE
  v_fonction record;
  v_revoquees integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    RAISE NOTICE 'Extension http absente : rien a durcir.';
    RETURN;
  END IF;

  FOR v_fonction IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_depend d
      JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'http'
      JOIN pg_proc p ON p.oid = d.objid
     WHERE d.deptype = 'e'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_fonction.signature
    );
    v_revoquees := v_revoquees + 1;
  END LOOP;

  RAISE NOTICE 'Droits retires sur % fonction(s) de l''extension http.', v_revoquees;
END;
$$;

-- Postflight : plus aucune fonction de l'extension joignable par l'API.
DO $$
DECLARE
  v_restantes integer;
BEGIN
  SELECT count(*) INTO v_restantes
    FROM pg_depend d
    JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'http'
    JOIN pg_proc p ON p.oid = d.objid
    JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated')
   WHERE d.deptype = 'e'
     AND has_function_privilege(r.oid, p.oid, 'EXECUTE');

  IF v_restantes <> 0 THEN
    RAISE EXCEPTION
      'Postflight : % droit(s) d''execution subsistent sur l''extension http.',
      v_restantes;
  END IF;
END;
$$;

COMMIT;
