export type ExportStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ExportFormat = 'csv' | 'xlsx';
export type ExportEntity =
  | 'customers'
  | 'products'
  | 'orders'
  | 'order_items'
  | 'expenses'
  | 'incomes'
  | 'lots'
  | 'notes';

export type ExportReportType =
  | 'report_product_sales'
  | 'report_expenses'
  | 'report_incomes'
  | 'report_customer_sales'
  | 'report_cashflow';

export type ExportJob = {
  id: number;
  entity_types: (ExportEntity | ExportReportType)[];
  format: ExportFormat;
  start_date: string | null;
  end_date: string | null;
  status: ExportStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  file_path: string | null;
  error_message: string | null;
  report_params: Record<string, unknown> | null;
};

export type ExportJobStart = {
  entity_types: ExportEntity[];
  format: ExportFormat;
  start_date?: string | null;
  end_date?: string | null;
};

export type ExportReportJobStart = {
  report_type: ExportReportType;
  format: ExportFormat;
  start_date: string;
  end_date: string;
  product_ids?: number[] | null;
  expense_category_ids?: number[] | null;
  income_category_ids?: number[] | null;
  customer_id?: number | null;
  include_incomes?: boolean;
};

export const ENTITY_LABELS: Record<ExportEntity, string> = {
  customers: 'Clienti',
  products: 'Prodotti',
  orders: 'Ordini',
  order_items: 'Righe ordine',
  expenses: 'Spese',
  incomes: 'Entrate',
  lots: 'Lotti',
  notes: 'Note'
};

export const REPORT_TYPE_LABELS: Record<ExportReportType, string> = {
  report_product_sales: 'Vendite per prodotto',
  report_expenses: 'Spese per categoria',
  report_incomes: 'Entrate per categoria',
  report_customer_sales: 'Vendite per cliente',
  report_cashflow: 'Flusso di cassa',
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (XLSX)',
};

export const STATUS_LABELS: Record<ExportStatus, string> = {
  pending: 'In attesa',
  running: 'In elaborazione',
  completed: 'Completato',
  failed: 'Fallito'
};

export const ACTIVE_STATUSES: ExportStatus[] = ['pending', 'running'];

// Ordered list of all selectable entities (ORDER_ITEMS is not directly selectable:
// it is always included automatically when ORDERS is selected)
export const SELECTABLE_ENTITIES: ExportEntity[] = [
  'customers', 'products', 'orders', 'expenses', 'incomes', 'lots', 'notes',
];

export const SELECTABLE_REPORT_TYPES: ExportReportType[] = [
  'report_product_sales',
  'report_expenses',
  'report_incomes',
  'report_customer_sales',
  'report_cashflow',
];

// Returns a human-readable label for any entity type (table or report)
export function getEntityLabel(entity: ExportEntity | ExportReportType): string {
  if (entity in ENTITY_LABELS) return ENTITY_LABELS[entity as ExportEntity];
  if (entity in REPORT_TYPE_LABELS) return REPORT_TYPE_LABELS[entity as ExportReportType];
  return entity;
}
