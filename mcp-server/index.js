#!/usr/bin/env node

/**
 * MCP Server for Gold Shipper - Supabase SQL Execution
 * 
 * This server allows direct execution of SQL queries on Supabase
 * via the Model Context Protocol without manual copy-paste.
 */

import { createClient } from '@supabase/supabase-js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env file');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create MCP server
const server = new Server(
  {
    name: 'gold-shipper-supabase',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_sql',
        description: 'Execute a SQL query on the Supabase database. Supports SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, and all other SQL commands. Returns query results or execution status.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The SQL query to execute. Can be any valid PostgreSQL SQL statement.',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_tables',
        description: 'List all tables in the database with their row counts',
        inputSchema: {
          type: 'object',
          properties: {
            schema: {
              type: 'string',
              description: 'Schema name (default: public)',
              default: 'public',
            },
          },
        },
      },
      {
        name: 'describe_table',
        description: 'Get detailed information about a table including columns, types, and constraints',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'Name of the table to describe',
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'cleanup_freight_module',
        description: 'Execute the cleanup script to remove all Freight & Customs data',
        inputSchema: {
          type: 'object',
          properties: {
            confirm: {
              type: 'boolean',
              description: 'Must be true to confirm deletion',
            },
          },
          required: ['confirm'],
        },
      },
      {
        name: 'optimize_freight_tables',
        description: 'Run ANALYZE on freight tables to update statistics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'execute_sql': {
        const { query } = args;
        
        // Execute the SQL query using Supabase RPC
        const { data, error } = await supabase.rpc('exec_sql', { 
          query_text: query 
        });
        
        if (error) {
          // If RPC function doesn't exist, try direct query for SELECT statements
          if (error.code === '42883' && query.trim().toUpperCase().startsWith('SELECT')) {
            const { data: directData, error: directError } = await supabase
              .from(query.match(/FROM\s+(\w+)/i)?.[1] || '')
              .select('*');
            
            if (directError) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error executing query: ${directError.message}\n\nHint: For complex queries, you may need to create an exec_sql RPC function in Supabase.`,
                  },
                ],
                isError: true,
              };
            }
            
            return {
              content: [
                {
                  type: 'text',
                  text: `Query executed successfully.\n\nResults:\n${JSON.stringify(directData, null, 2)}`,
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error.message}\n\nDetails: ${JSON.stringify(error, null, 2)}`,
              },
            ],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Query executed successfully.\n\nResults:\n${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      }

      case 'list_tables': {
        const schema = args.schema || 'public';
        
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', schema)
          .order('table_name');
        
        if (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
        
        // Get row counts for each table
        const tables = [];
        for (const table of data) {
          const { count } = await supabase
            .from(table.table_name)
            .select('*', { count: 'exact', head: true });
          
          tables.push({
            name: table.table_name,
            rows: count || 0,
          });
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Tables in schema '${schema}':\n\n${tables
                .map(t => `- ${t.name} (${t.rows} rows)`)
                .join('\n')}`,
            },
          ],
        };
      }

      case 'describe_table': {
        const { table_name } = args;
        
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_name', table_name)
          .order('ordinal_position');
        
        if (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Table: ${table_name}\n\nColumns:\n${data
                .map(
                  col =>
                    `- ${col.column_name} (${col.data_type})${
                      col.is_nullable === 'NO' ? ' NOT NULL' : ''
                    }${col.column_default ? ` DEFAULT ${col.column_default}` : ''}`
                )
                .join('\n')}`,
            },
          ],
        };
      }

      case 'cleanup_freight_module': {
        if (!args.confirm) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Must set confirm=true to execute cleanup',
              },
            ],
            isError: true,
          };
        }
        
        // Read and execute the cleanup script
        const fs = await import('fs');
        const cleanupScript = fs.readFileSync(
          join(__dirname, '..', 'CLEANUP_FREIGHT_CUSTOMS_MODULE.sql'),
          'utf8'
        );
        
        const { data, error } = await supabase.rpc('exec_sql', {
          query_text: cleanupScript,
        });
        
        if (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: 'Cleanup completed successfully. All Freight & Customs data has been removed.',
            },
          ],
        };
      }

      case 'optimize_freight_tables': {
        const queries = [
          'ANALYZE freight_shipment_signatories;',
          'ANALYZE freight_shipment_productions;',
          'ANALYZE freight_shipments;',
        ];
        
        const results = [];
        for (const query of queries) {
          const { error } = await supabase.rpc('exec_sql', { query_text: query });
          if (error) {
            results.push(`Error on ${query}: ${error.message}`);
          } else {
            results.push(`✓ ${query}`);
          }
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Optimization results:\n${results.join('\n')}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}\n\nStack: ${error.stack}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gold Shipper MCP Server running on stdio');
}

main().catch(console.error);
