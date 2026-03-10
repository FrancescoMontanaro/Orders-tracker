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

export type ExportJob = {
  id: number;
  entity_types: ExportEntity[];
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
};

export type ExportJobStart = {
  entity_types: ExportEntity[];
  format: ExportFormat;
  start_date?: string | null;
  end_date?: string | null;
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
