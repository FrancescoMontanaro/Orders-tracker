export type ExportStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ExportFormat = 'csv' | 'xlsx';
export type ExportEntity =
  | 'all'
  | 'customers'
  | 'products'
  | 'orders'
  | 'expenses'
  | 'incomes'
  | 'lots'
  | 'notes';

export type ExportJob = {
  id: number;
  entity_type: ExportEntity;
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
  entity_type: ExportEntity;
  format: ExportFormat;
  start_date?: string | null;
  end_date?: string | null;
};

export const ENTITY_LABELS: Record<ExportEntity, string> = {
  all: 'Tutto',
  customers: 'Clienti',
  products: 'Prodotti',
  orders: 'Ordini',
  expenses: 'Uscite',
  incomes: 'Entrate',
  lots: 'Lotti',
  notes: 'Note',
};

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (XLSX)',
};

export const STATUS_LABELS: Record<ExportStatus, string> = {
  pending: 'In attesa',
  running: 'In elaborazione',
  completed: 'Completato',
  failed: 'Fallito',
};

export const ACTIVE_STATUSES: ExportStatus[] = ['pending', 'running'];
