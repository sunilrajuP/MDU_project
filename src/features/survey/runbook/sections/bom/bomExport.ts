import type { RunbookModel } from '../../model/types';
import { bomQuantity, isRowConfirmed } from '../../logic/bom';

const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

/** CSV of the BoM as currently reviewed (quantities in force + confirmation). */
export function bomToCsv(model: RunbookModel): string {
  const header = ['Item', 'Description', 'Quantity', 'Unit', 'Source', 'Confirmed'];
  const lines = model.bomRows.map((row) =>
    [row.item, row.description, bomQuantity(model, row), row.unit, row.source, isRowConfirmed(model, row) ? 'Yes' : 'No'].map(cell).join(','),
  );
  return [header.map(cell).join(','), ...lines].join('\r\n');
}

/**
 * Downloads the BoM. This is a CSV, not .xlsx: a real spreadsheet export is a backend endpoint
 * (GET /jobs/{jobRef}/bom/export, see docs/surveyor-api-contract.md) and is tracked in the backlog.
 */
export function downloadBomCsv(model: RunbookModel): void {
  const blob = new Blob([bomToCsv(model)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bom-${model.jobRef}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
