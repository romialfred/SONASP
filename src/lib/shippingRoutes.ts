const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const shippingPreparationDetailsPath = (id: string): string =>
  `/shipping/preparation/${encodeURIComponent(id)}/details`;

export const shippingPreparationEditPath = (id: string): string =>
  `/shipping/preparation/${encodeURIComponent(id)}/edit`;

export const legacyShippingPreparationEditDestination = (id: string | undefined): string =>
  id && UUID_PATTERN.test(id)
    ? shippingPreparationEditPath(id)
    : '/shipping/preparation';
