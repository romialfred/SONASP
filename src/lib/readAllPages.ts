type PageResult<T> = { data: T[] | null; error: unknown; count: number | null };

/**
 * Read every RLS-visible row, using a fresh query and a deterministic order
 * (including the unique id) for each page. Callers must request count: 'exact'.
 * A lower server limit is supported: advance by received rows, not page size.
 * A changed count or duplicate means the read cannot safely be called complete.
 * This detects some concurrent changes; separate HTTP reads are not a snapshot.
 */
export async function readAllPages<T extends { id: string }>(
  query: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<string>();
  let expectedCount: number | undefined;

  for (;;) {
    const { data, error, count } = await query(rows.length, rows.length + 499);
    if (error) throw error;
    if (!Array.isArray(data) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('La lecture complète des données ne peut pas être confirmée. Veuillez actualiser.');
    }
    if (expectedCount !== undefined && count !== expectedCount) {
      throw new Error('Les données ont changé pendant le chargement. Veuillez actualiser.');
    }
    expectedCount = count;
    if (data.length > 500 || rows.length + data.length > count || (!data.length && rows.length < count)) {
      throw new Error('La lecture des données est incomplète. Veuillez actualiser.');
    }
    for (const row of data) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) {
        throw new Error('La lecture des données est incohérente. Veuillez actualiser.');
      }
      ids.add(row.id);
      rows.push(row);
    }
    if (rows.length === count) return rows;
  }
}
