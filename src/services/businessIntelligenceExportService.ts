import type {
  BIDimension,
  BIFilters,
  BIModel,
  BIView,
} from '@/services/businessIntelligenceService';
import { BI_DIMENSION_LABELS } from '@/services/businessIntelligenceService';
import { downloadExcelWorkbook } from '@/lib/excelExport';

export interface BIExportContext {
  title: string;
  subtitle: string;
  period: { startDate: string; endDate: string };
  filters: BIFilters;
  dimension: BIDimension;
  view: BIView;
}

const viewNames: Record<BIView, string> = {
  sales: 'analyse-ventes',
  production: 'rapport-production',
  institutional: 'rapport-institutionnel',
  national: 'performance-nationale',
};

const number = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(value);

const date = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  );

const fileName = (context: BIExportContext, extension: string) =>
  `sonasp-${viewNames[context.view]}-${context.period.startDate}-${context.period.endDate}.${extension}`;

const filterRows = (context: BIExportContext) => [
  { Filtre: 'Période', Valeur: `${date(context.period.startDate)} au ${date(context.period.endDate)}` },
  { Filtre: 'Région', Valeur: context.filters.region === 'all' ? 'Toutes' : context.filters.region },
  { Filtre: 'Site minier', Valeur: context.filters.siteId === 'all' ? 'Tous' : context.filters.siteId },
  { Filtre: 'Opérateur / acheteur', Valeur: context.filters.actorId === 'all' ? 'Tous' : context.filters.actorId },
  { Filtre: 'Filière', Valeur: context.filters.source === 'all' ? 'Toutes' : context.filters.source },
  { Filtre: 'Statut', Valeur: context.filters.status === 'all' ? 'Tous' : context.filters.status },
  { Filtre: 'Granularité', Valeur: context.filters.granularity },
];

const summaryRows = (model: BIModel) => [
  { Indicateur: 'Volume', Valeur: model.totalQuantityOz, Unite: 'oz' },
  { Indicateur: 'Valeur', Valeur: model.totalAmount, Unite: model.primaryCurrency },
  { Indicateur: 'Prélèvements et redevances', Valeur: model.totalTaxes, Unite: model.primaryCurrency },
  { Indicateur: 'Opérations', Valeur: model.operations, Unite: 'dossiers' },
  { Indicateur: 'Opérations finalisées', Valeur: model.completedOperations, Unite: 'dossiers' },
  { Indicateur: 'Opérations en attente', Valeur: model.pendingOperations, Unite: 'dossiers' },
  { Indicateur: 'Régions actives', Valeur: model.activeRegions, Unite: 'régions' },
  { Indicateur: 'Sites actifs', Valeur: model.activeSites, Unite: 'sites' },
];

const detailRows = (model: BIModel) =>
  model.records.map((record) => ({
    Date: record.date,
    Référence: record.reference,
    Flux: record.category,
    Filière: record.source,
    Région: record.region,
    Province: record.province,
    Site: record.siteName,
    'Opérateur / acheteur': record.actorName,
    Statut: record.status,
    'Quantité (oz)': record.quantityOz,
    Montant: record.amount,
    Devise: record.currency,
    Redevances: record.taxes,
    'Teneur (%)': record.qualityPct,
  }));

export async function exportBIExcel(model: BIModel, context: BIExportContext) {
  const metadata = [
    { Champ: 'Rapport', Valeur: context.title },
    { Champ: 'Objet', Valeur: context.subtitle },
    { Champ: 'Généré le', Valeur: new Date().toLocaleString('fr-FR') },
    ...filterRows(context).map((row) => ({ Champ: row.Filtre, Valeur: row.Valeur })),
  ];
  const sheets = [
    ['Synthèse', summaryRows(model)],
    ['Évolution', model.trend.map((row) => ({
      Période: row.label,
      'Quantité (oz)': row.quantityOz,
      Montant: row.amount,
      Opérations: row.operations,
    }))],
    [
      'Décomposition',
      model.breakdowns[context.dimension].map((row) => ({
        Dimension: BI_DIMENSION_LABELS[context.dimension],
        Libellé: row.label,
        Valeur: row.value,
        'Quantité (oz)': row.secondary,
        'Part (%)': row.share,
        Opérations: row.records,
      })),
    ],
    ['Détail', detailRows(model)],
    ['Métadonnées', metadata],
  ] as const;

  await downloadExcelWorkbook(
    sheets.map(([name, rows]) => ({ name, rows: [...rows] as Array<Record<string, unknown>> })),
    fileName(context, 'xlsx'),
  );
}

export async function exportBIPdf(model: BIModel, context: BIExportContext) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default;
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = document.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString('fr-FR');

  document.setFillColor(5, 92, 61);
  document.rect(0, 0, width, 22, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(15);
  document.text('SONASP · RAPPORT DE PILOTAGE', 14, 10);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.text(`Généré le ${generatedAt}`, width - 14, 10, { align: 'right' });

  document.setTextColor(13, 31, 45);
  document.setFont('helvetica', 'bold');
  document.setFontSize(18);
  document.text(context.title, 14, 33);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.setTextColor(80, 94, 104);
  document.text(
    `${date(context.period.startDate)} au ${date(context.period.endDate)} · ${context.subtitle}`,
    14,
    40,
  );

  autoTable(document, {
    startY: 47,
    head: [['Indicateur', 'Valeur', 'Unité']],
    body: summaryRows(model).map((row) => [row.Indicateur, number(row.Valeur), row.Unite]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.4, textColor: [30, 45, 53] },
    headStyles: { fillColor: [5, 92, 61], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    margin: { left: 14, right: 154 },
  });

  autoTable(document, {
    startY: 47,
    head: [[BI_DIMENSION_LABELS[context.dimension], 'Valeur', 'Part', 'Opérations']],
    body: model.breakdowns[context.dimension].slice(0, 8).map((row) => [
      row.label,
      number(row.value),
      `${number(row.share, 1)} %`,
      String(row.records),
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.4, textColor: [30, 45, 53] },
    headStyles: { fillColor: [181, 132, 17], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [252, 248, 238] },
    margin: { left: 151, right: 14 },
  });

  autoTable(document, {
    startY: 101,
    head: [['Date', 'Référence', 'Filière', 'Région', 'Site', 'Opérateur', 'Statut', 'Qté (oz)', 'Montant']],
    body: model.records.slice(0, 28).map((record) => [
      record.date,
      record.reference,
      record.source,
      record.region,
      record.siteName,
      record.actorName,
      record.status,
      number(record.quantityOz),
      record.amount ? `${number(record.amount)} ${record.currency}` : '—',
    ]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 48, 57], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 19 },
      1: { cellWidth: 28 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
    },
    margin: { left: 14, right: 14 },
  });

  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    document.setFontSize(7);
    document.setTextColor(110, 120, 126);
    document.text(
      `SONASP · document généré depuis les données disponibles · page ${page}/${pages}`,
      14,
      document.internal.pageSize.getHeight() - 7,
    );
  }
  document.save(fileName(context, 'pdf'));
}

export async function shareBIReport(context: BIExportContext): Promise<'shared' | 'copied'> {
  const url = new URL(window.location.href);
  url.searchParams.set('du', context.period.startDate);
  url.searchParams.set('au', context.period.endDate);
  if (context.filters.region !== 'all') url.searchParams.set('region', context.filters.region);
  if (context.filters.siteId !== 'all') url.searchParams.set('site', context.filters.siteId);
  if (context.filters.actorId !== 'all') url.searchParams.set('acteur', context.filters.actorId);

  const shareData = {
    title: context.title,
    text: `${context.subtitle} · ${date(context.period.startDate)} au ${date(context.period.endDate)}`,
    url: url.toString(),
  };

  if (navigator.share) {
    await navigator.share(shareData);
    return 'shared';
  }
  await navigator.clipboard.writeText(url.toString());
  return 'copied';
}
