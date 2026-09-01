-- Read business labels only; audit/auth/security records and external credentials are out of scope.
BEGIN;
SET LOCAL statement_timeout = '45s';
CREATE TEMP TABLE label_findings(table_name text, column_name text, occurrences bigint, samples jsonb) ON COMMIT DROP;
DO $audit$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT col.table_name, col.column_name FROM information_schema.columns col
    JOIN information_schema.tables t USING(table_catalog, table_schema, table_name)
    WHERE col.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND col.data_type IN ('text', 'character varying')
      AND col.table_name !~ '(audit|journal|logs?|outbox|event|session|token|user|permission|capabilit|notification)'
      AND col.column_name ~ '(^name$|^nom$|^prenoms$|^short_name$|^label$|^libelle$|^title$|^titre$|^description$|^notes$|^observations$|^commentaire$|^code$|reference|^numero_|_number$|^source$)'
      AND col.column_name !~ '(phone|account|iban|swift|compte|telephone|identite|piece)'
  LOOP
    EXECUTE format(
      'INSERT INTO label_findings SELECT %L,%L,count(*),to_jsonb((array_agg(DISTINCT left(%I,200)))[1:8]) FROM public.%I WHERE %I ~* %L HAVING count(*) > 0',
      c.table_name,c.column_name,c.column_name,c.table_name,c.column_name,
      '(^|[^[:alpha:]])(test([0-9]+[a-z]*)?|demo|démo|démonstration|demonstration)([^[:alpha:]]|$)|Jeu portail Mine'
    );
  END LOOP;
END $audit$;
SELECT * FROM label_findings ORDER BY table_name,column_name;
ROLLBACK;
