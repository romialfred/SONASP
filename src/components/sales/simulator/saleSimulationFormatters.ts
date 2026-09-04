export const formatNumberFr = (
  value: number | null | undefined,
  maximumFractionDigits = 2,
  minimumFractionDigits = 0,
) => value === null || value === undefined || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);

export const formatCompactXof = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${formatNumberFr(value / 1_000_000_000, 2)} Md FCFA`;
  if (absolute >= 1_000_000) return `${formatNumberFr(value / 1_000_000, 1)} M FCFA`;
  return `${formatNumberFr(value, 0)} FCFA`;
};

export const formatDateFr = (value: string) => new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

export function parseLocalizedNumber(value: string): number | null {
  const normalized = value
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.+-]/g, '');
  if (!normalized || normalized === '-' || normalized === '+') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
