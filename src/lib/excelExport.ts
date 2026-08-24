const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type CellValue = string | number | boolean | Date | null | undefined;

export interface ObjectSheetSpec {
  name: string;
  rows: Array<Record<string, unknown>>;
  widths?: number[];
}

export interface MatrixSheetSpec {
  name: string;
  matrix: unknown[][];
  widths?: number[];
}

export type ExcelSheetSpec = ObjectSheetSpec | MatrixSheetSpec;

function safeSheetName(name: string): string {
  return name.replace(/[\\/?*:[\]]/g, ' ').trim().slice(0, 31) || 'Données';
}

function safeCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  return JSON.stringify(value);
}

/** Génère un classeur sans jamais parser de fichier Excel non fiable. */
export async function buildExcelWorkbook(sheets: ExcelSheetSpec[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const preparedSheets = sheets.map((spec) => {
    const matrix = 'matrix' in spec
      ? spec.matrix.map((row) => row.map(safeCellValue))
      : (() => {
          const headers = Object.keys(spec.rows[0] ?? {});
          return [
            headers,
            ...spec.rows.map((row) => headers.map((header) => safeCellValue(row[header]))),
          ];
        })();
    const columnCount = Math.max(0, ...matrix.map((row) => row.length));
    const columns = Array.from({ length: columnCount }, (_, index) => {
      const requested = spec.widths?.[index];
      const observed = matrix.reduce((max, row) => Math.max(max, String(row[index] ?? '').length), 0);
      return { width: requested ?? Math.min(42, Math.max(12, observed + 2)) };
    });
    const data = matrix.map((row, rowIndex) => row.map((value) => rowIndex === 0
      ? {
          value: value ?? '',
          fontWeight: 'bold' as const,
          color: '#FFFFFF',
          backgroundColor: '#05623E',
          align: 'center' as const,
        }
      : value));

    return {
      sheet: safeSheetName(spec.name),
      data,
      columns,
      stickyRowsCount: 1,
    };
  });

  const blob = await writeXlsxFile(preparedSheets).toBlob();
  return new Blob([blob], { type: TYPE_XLSX });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadExcelWorkbook(sheets: ExcelSheetSpec[], fileName: string): Promise<void> {
  downloadBlob(await buildExcelWorkbook(sheets), fileName);
}
