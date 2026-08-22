export type PublicNewsItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  published_at: string;
  image_url: string | null;
  document_url: string | null;
};

function publicNewsEndpoint() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return null;

  const endpoint = new URL(`${baseUrl.replace(/\/$/, '')}/rest/v1/publications`);
  endpoint.searchParams.set('select', 'id,slug,title,summary,content,category,published_at,image_url,document_url');
  endpoint.searchParams.set('status', 'eq.published');
  endpoint.searchParams.set('published_at', `lte.${new Date().toISOString()}`);
  endpoint.searchParams.set('order', 'published_at.desc');
  endpoint.searchParams.set('limit', '12');
  return { endpoint, anonKey };
}

function publicNewsRequest(endpoint: URL, anonKey: string, signal?: AbortSignal) {
  return fetch(endpoint, {
    signal,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: 'application/json',
    },
  });
}

export async function loadPublicNews(signal?: AbortSignal): Promise<PublicNewsItem[]> {
  const config = publicNewsEndpoint();
  if (!config) return [];

  const response = await publicNewsRequest(config.endpoint, config.anonKey, signal);

  if (!response.ok) throw new Error('PUBLICATIONS_UNAVAILABLE');
  return response.json() as Promise<PublicNewsItem[]>;
}

export async function loadPublicNewsBySlug(slug: string, signal?: AbortSignal): Promise<PublicNewsItem | null> {
  const config = publicNewsEndpoint();
  if (!config) return null;
  config.endpoint.searchParams.set('slug', `eq.${slug}`);
  config.endpoint.searchParams.set('limit', '1');
  const response = await publicNewsRequest(config.endpoint, config.anonKey, signal);
  if (!response.ok) throw new Error('PUBLICATION_UNAVAILABLE');
  const items = await response.json() as PublicNewsItem[];
  return items[0] ?? null;
}
