/*
  Setup exec_sql RPC function for MCP Server
  
  This function allows the MCP server to execute arbitrary SQL queries.
  IMPORTANT: This should only be used with proper security measures.
*/

-- Create a function to execute arbitrary SQL
CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Execute the query and return results as JSONB
  EXECUTE query_text INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION exec_sql(TEXT) IS 'Execute arbitrary SQL queries for MCP server. Use with caution.';
