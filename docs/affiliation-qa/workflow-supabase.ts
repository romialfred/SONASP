/** Local-only transport. Real production services call real SQL through the QA Vite server. */
import { qaActor } from './workflow-auth';

async function request(body: Record<string, unknown>) {
  const response = await fetch('/__affiliation_qa/api', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-QA-Actor': qaActor() },
    body: JSON.stringify(body),
  });
  return response.json();
}
function tableQuery(table: string) {
  const query: { table: string; filters: unknown[]; orders: unknown[]; single: boolean; limit?: number } = { table, filters: [], orders: [], single: false };
  const chain = {
    select: () => chain,
    eq: (field: string, value: unknown) => { query.filters.push({ field, value }); return chain; },
    in: (field: string, value: unknown[]) => { query.filters.push({ field, value, op: 'in' }); return chain; },
    order: (field: string, options?: { ascending?: boolean }) => { query.orders.push({ field, ascending: options?.ascending !== false }); return chain; },
    limit: (value: number) => { query.limit = value; return chain; },
    maybeSingle: () => { query.single = true; return chain; },
    single: () => { query.single = true; return chain; },
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => request({ kind: 'table', ...query }).then(resolve, reject),
  };
  return chain;
}
async function invoke(name: string, options: { body?: unknown }) {
  if (options.body instanceof FormData) {
    const body: Record<string, unknown> = {};
    for (const [key, value] of options.body.entries()) {
      body[key] = value instanceof File ? { name: value.name, type: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) } : value;
    }
    return request({ kind: 'edge', name, body });
  }
  return request({ kind: 'edge', name, body: options.body });
}
export const supabase = {
  rpc: (name: string, args: Record<string, unknown> = {}) => request({ kind: 'rpc', name, args }),
  from: tableQuery,
  functions: { invoke },
  storage: { from: (bucket: string) => ({ createSignedUrl: async (path: string) => ({ data: { signedUrl: `/__affiliation_qa/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&actor=${qaActor()}` }, error: null }) }) },
  auth: { getSession: async () => ({ data: { session: null }, error: null }), getUser: async () => ({ data: { user: null }, error: null }) },
};
