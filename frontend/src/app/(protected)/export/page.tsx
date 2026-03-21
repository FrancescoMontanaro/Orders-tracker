'use client';

import * as React from 'react';
import { DownloadIcon, PlusIcon, X, Check, ChevronsUpDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useExportJobs } from './hooks/useExportJobs';
import { useSimpleSearch, type SimpleOption } from './hooks/useSimpleSearch';
import { useFixRadixInertLeak } from '../home/hooks/useFixRadixInertLeak';
import {
  type ExportEntity,
  type ExportFormat,
  type ExportJob,
  type ExportJobStart,
  type ExportReportType,
  type ExportReportJobStart,
  ENTITY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
  SELECTABLE_ENTITIES,
  SELECTABLE_REPORT_TYPES,
  REPORT_TYPE_LABELS,
  getEntityLabel,
} from './types/export';

const FORMAT_OPTIONS: ExportFormat[] = ['xlsx', 'csv'];

// ============================================================ //
// ===  Combobox helpers for the report export dialog tab  ==== //
// ============================================================ //

/**
 * Generic multi-select combobox backed by useSimpleSearch.
 * Used for products, expense categories and income categories.
 */
function MultiCombobox({
  endpoint,
  values,
  onChange,
  placeholder = 'Seleziona…',
  clearLabel = 'Tutti',
  emptyText = 'Nessun risultato',
}: {
  endpoint: Parameters<typeof useSimpleSearch>[0];
  values: SimpleOption[];
  onChange: (opts: SimpleOption[]) => void;
  placeholder?: string;
  clearLabel?: string;
  emptyText?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useSimpleSearch(endpoint);

  const isSelected = (id: number) => values.some((v) => v.id === id);
  const toggle = (opt: SimpleOption) => {
    if (isSelected(opt.id)) onChange(values.filter((v) => v.id !== opt.id));
    else onChange([...values, opt]);
  };

  const label =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? values[0].name
      : `${values.length} selezionati`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="min-w-0 w-full justify-between">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-h-[50vh] overflow-auto">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Digita per cercare…" />
          <CommandList>
            <CommandItem
              value="__all__"
              onMouseDown={(e) => e.preventDefault()}
              onSelect={() => { onChange([]); setQuery(''); }}
            >
              <Check className={cn('mr-2 h-4 w-4', values.length === 0 ? 'opacity-100' : 'opacity-0')} />
              {clearLabel}
            </CommandItem>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => toggle(opt)}
                >
                  <Check className={cn('mr-2 h-4 w-4', isSelected(opt.id) ? 'opacity-100' : 'opacity-0')} />
                  {opt.name}
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Generic single-select combobox backed by useSimpleSearch.
 * Used for customers.
 */
function SingleCombobox({
  endpoint,
  value,
  onChange,
  placeholder = 'Seleziona…',
  emptyText = 'Nessun risultato',
}: {
  endpoint: Parameters<typeof useSimpleSearch>[0];
  value: SimpleOption | null;
  onChange: (opt: SimpleOption | null) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const { open, setOpen, query, setQuery, options, loading } = useSimpleSearch(endpoint);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="min-w-0 w-full justify-between">
          <span className="truncate">{value ? value.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-h-[50vh] overflow-auto">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Digita per cercare…" />
          <CommandList>
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Caricamento…</div>
            ) : options.length ? (
              options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={() => { onChange(opt); setOpen(false); setQuery(''); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value?.id === opt.id ? 'opacity-100' : 'opacity-0')} />
                  {opt.name}
                </CommandItem>
              ))
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function StatusBadge({ status }: { status: ExportJob['status'] }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">{STATUS_LABELS.pending}</Badge>;
    case 'running':
      return <Badge>{STATUS_LABELS.running}</Badge>;
    case 'completed':
      return (
        <Badge
          variant="outline"
          className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-400"
        >
          {STATUS_LABELS.completed}
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">{STATUS_LABELS.failed}</Badge>;
  }
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

function fmtDate(s: string | null) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

export default function ExportPage() {
  useFixRadixInertLeak();

  const { rows, total, page, size, loading, error, setPage, setSize, refetch } =
    useExportJobs();

  // New export dialog — shared state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogTab, setDialogTab] = React.useState<'tables' | 'report'>('tables');

  // ── Tab "Tabelle" state ──────────────────────────────────────────────────
  const [entityTypes, setEntityTypes] = React.useState<ExportEntity[]>(['orders']);
  const [format, setFormat] = React.useState<ExportFormat>('xlsx');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [starting, setStarting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // ── Tab "Report" state ───────────────────────────────────────────────────
  const [reportType, setReportType] = React.useState<ExportReportType>('report_product_sales');
  const [reportFormat, setReportFormat] = React.useState<ExportFormat>('xlsx');
  const [reportStartDate, setReportStartDate] = React.useState('');
  const [reportEndDate, setReportEndDate] = React.useState('');
  const [reportProducts, setReportProducts] = React.useState<SimpleOption[]>([]);
  const [reportExpenseCategories, setReportExpenseCategories] = React.useState<SimpleOption[]>([]);
  const [reportIncomeCategories, setReportIncomeCategories] = React.useState<SimpleOption[]>([]);
  const [reportCustomer, setReportCustomer] = React.useState<SimpleOption | null>(null);
  const [reportIncludeIncomes, setReportIncludeIncomes] = React.useState(true);
  const [reportStarting, setReportStarting] = React.useState(false);
  const [reportFormError, setReportFormError] = React.useState<string | null>(null);

  function toggleEntity(entity: ExportEntity) {
    setEntityTypes((prev) =>
      prev.includes(entity) ? prev.filter((e) => e !== entity) : [...prev, entity]
    );
  }

  function selectAll() {
    setEntityTypes([...SELECTABLE_ENTITIES]);
  }

  function clearAll() {
    setEntityTypes([]);
  }

  // Resets the dialog state for both tabs when it closes
  function resetDialog() {
    setFormError(null);
    setStartDate('');
    setEndDate('');
    setReportFormError(null);
    setReportStartDate('');
    setReportEndDate('');
    setReportProducts([]);
    setReportExpenseCategories([]);
    setReportIncomeCategories([]);
    setReportCustomer(null);
    setReportIncludeIncomes(true);
  }

  // Global error banner
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [errorVisible, setErrorVisible] = React.useState(false);
  React.useEffect(() => {
    if (globalError || error) setErrorVisible(true);
  }, [globalError, error]);

  // Download loading state per job id
  const [downloading, setDownloading] = React.useState<number | null>(null);

  async function startExport() {
    setFormError(null);
    if (entityTypes.length === 0) {
      setFormError('Seleziona almeno un\'entità da esportare.');
      return;
    }
    setStarting(true);
    try {
      const payload: ExportJobStart = {
        entity_types: entityTypes,
        format,
        start_date: startDate || null,
        end_date: endDate || null,
      };
      await api.post('/export/start', payload);
      setDialogOpen(false);
      resetDialog();
      await refetch();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setFormError(
          'Un export per una o più delle entità selezionate è già in corso. Attendi che termini.'
        );
      } else {
        const detail =
          e?.response?.data?.detail ??
          e?.response?.data?.message ??
          e?.message ??
          'Errore sconosciuto';
        setFormError(String(detail));
      }
    } finally {
      setStarting(false);
    }
  }

  async function startReportExport() {
    setReportFormError(null);
    if (!reportStartDate || !reportEndDate) {
      setReportFormError('Seleziona un intervallo di date.');
      return;
    }
    if (reportType === 'report_customer_sales' && !reportCustomer) {
      setReportFormError('Seleziona un cliente per questo tipo di report.');
      return;
    }
    setReportStarting(true);
    try {
      const payload: ExportReportJobStart = {
        report_type: reportType,
        format: reportFormat,
        start_date: reportStartDate,
        end_date: reportEndDate,
        product_ids: reportProducts.length ? reportProducts.map((p) => p.id) : null,
        expense_category_ids: reportExpenseCategories.length ? reportExpenseCategories.map((c) => c.id) : null,
        income_category_ids: reportIncomeCategories.length ? reportIncomeCategories.map((c) => c.id) : null,
        customer_id: reportCustomer ? reportCustomer.id : null,
        include_incomes: reportIncludeIncomes,
      };
      await api.post('/export/report/start', payload);
      setDialogOpen(false);
      resetDialog();
      await refetch();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setReportFormError(
          'Un export per questo tipo di report è già in corso. Attendi che termini.'
        );
      } else {
        const detail =
          e?.response?.data?.detail ??
          e?.response?.data?.message ??
          e?.message ??
          'Errore sconosciuto';
        setReportFormError(String(detail));
      }
    } finally {
      setReportStarting(false);
    }
  }

  async function downloadJob(job: ExportJob) {
    setDownloading(job.id);
    try {
      const res = await api.get(`/export/download/${job.id}`, {
        responseType: 'blob',
      });
      const cd = res.headers['content-disposition'] as string | undefined;
      let filename = `export_${job.entity_types.join('_')}_${job.id}`;
      if (cd) {
        const m = cd.match(/filename[^;=\n]*=(["']?)([^"'\n;]+)\1/);
        if (m?.[2]) filename = m[2];
      }
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ?? e?.message ?? 'Download fallito';
      setGlobalError(String(detail));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <TooltipProvider>
      <Card className="max-w-full">
        <CardHeader className="space-y-4">
          {/* Title + actions row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg">Export dati</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => { resetDialog(); setDialogOpen(true); }}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Nuovo export
              </Button>
            </div>
          </div>

          {/* Error banner */}
          {errorVisible && (globalError || error) && (
            <div className="relative rounded-md border border-red-200 bg-red-50 p-3 pr-10 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 whitespace-pre-line">
              <button
                type="button"
                aria-label="Chiudi errore"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded hover:bg-red-100/60 dark:hover:bg-red-900/40"
                onClick={() => setErrorVisible(false)}
              >
                <X className="h-4 w-4" />
              </button>
              {globalError || error}
            </div>
          )}
        </CardHeader>

        {/* New export dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) resetDialog();
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-[32rem] md:w-[36rem]">
            <DialogHeader>
              <DialogTitle>Nuovo export</DialogTitle>
            </DialogHeader>

            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'tables' | 'report')}>
              <TabsList className="mb-2">
                <TabsTrigger value="tables">Dati</TabsTrigger>
                <TabsTrigger value="report">Analisi</TabsTrigger>
              </TabsList>

              {/* ──────────────────────────────────────────── */}
              {/* Tab "Tabelle" — existing table export form  */}
              {/* ──────────────────────────────────────────── */}
              <TabsContent value="tables">
                <div className="grid gap-4">
                  {/* Multi-select entities */}
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Entità da esportare</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          onClick={selectAll}
                        >
                          Seleziona tutte
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          onClick={clearAll}
                        >
                          Deseleziona
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 rounded-md border p-3">
                      {SELECTABLE_ENTITIES.map((entity) => (
                        <div key={entity} className="flex items-center gap-2">
                          <Checkbox
                            id={`entity-${entity}`}
                            checked={entityTypes.includes(entity)}
                            onCheckedChange={() => toggleEntity(entity)}
                          />
                          <label
                            htmlFor={`entity-${entity}`}
                            className="text-sm cursor-pointer select-none"
                          >
                            {ENTITY_LABELS[entity]}
                            {entity === 'orders' && (
                              <span className="ml-1 text-xs text-muted-foreground">(+ righe)</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-1 min-w-0">
                    <Label>Formato</Label>
                    <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f}>{FORMAT_LABELS[f]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {entityTypes.length > 1 && format === 'csv' && (
                      <p className="text-xs text-muted-foreground">
                        Con più entità verrà generato un archivio ZIP.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-1 min-w-0">
                    <Label>Data inizio (opzionale)</Label>
                    <DatePicker value={startDate} onChange={setStartDate} placeholder="Da data" className="w-full" />
                  </div>

                  <div className="grid gap-1 min-w-0">
                    <Label>Data fine (opzionale)</Label>
                    <DatePicker value={endDate} onChange={setEndDate} placeholder="A data" className="w-full" />
                  </div>

                  {formError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                  )}
                </div>

                <DialogFooter className="mt-4 flex flex-row flex-wrap items-center justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">Annulla</Button>
                  </DialogClose>
                  <Button onClick={startExport} disabled={starting}>
                    {starting ? 'Avvio…' : 'Avvia export'}
                  </Button>
                </DialogFooter>
              </TabsContent>

              {/* ──────────────────────────────────────────── */}
              {/* Tab "Report" — computed report export form  */}
              {/* ──────────────────────────────────────────── */}
              <TabsContent value="report">
                <div className="grid gap-4">
                  {/* Report type */}
                  <div className="grid gap-1 min-w-0">
                    <Label>Tipo di report</Label>
                    <Select
                      value={reportType}
                      onValueChange={(v) => {
                        setReportType(v as ExportReportType);
                        // Reset type-specific filters when switching
                        setReportProducts([]);
                        setReportExpenseCategories([]);
                        setReportIncomeCategories([]);
                        setReportCustomer(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_REPORT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{REPORT_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date range — required for all reports */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1 min-w-0">
                      <Label>Data inizio <span className="text-destructive">*</span></Label>
                      <DatePicker value={reportStartDate} onChange={setReportStartDate} placeholder="Da data" className="w-full" />
                    </div>
                    <div className="grid gap-1 min-w-0">
                      <Label>Data fine <span className="text-destructive">*</span></Label>
                      <DatePicker value={reportEndDate} onChange={setReportEndDate} placeholder="A data" className="w-full" />
                    </div>
                  </div>

                  {/* Type-specific filters */}
                  {reportType === 'report_product_sales' && (
                    <div className="grid gap-1 min-w-0">
                      <Label>Prodotti (opzionale)</Label>
                      <MultiCombobox
                        endpoint="/products/list"
                        values={reportProducts}
                        onChange={setReportProducts}
                        placeholder="Tutti i prodotti"
                        clearLabel="Tutti i prodotti"
                        emptyText="Nessun prodotto trovato"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lascia vuoto per includere tutti i prodotti.
                      </p>
                    </div>
                  )}

                  {reportType === 'report_expenses' && (
                    <div className="grid gap-1 min-w-0">
                      <Label>Categorie spese (opzionale)</Label>
                      <MultiCombobox
                        endpoint="expenses/categories/list"
                        values={reportExpenseCategories}
                        onChange={setReportExpenseCategories}
                        placeholder="Tutte le categorie"
                        clearLabel="Tutte le categorie"
                        emptyText="Nessuna categoria trovata"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lascia vuoto per includere tutte le categorie.
                      </p>
                    </div>
                  )}

                  {reportType === 'report_incomes' && (
                    <div className="grid gap-1 min-w-0">
                      <Label>Categorie entrate (opzionale)</Label>
                      <MultiCombobox
                        endpoint="incomes/categories/list"
                        values={reportIncomeCategories}
                        onChange={setReportIncomeCategories}
                        placeholder="Tutte le categorie"
                        clearLabel="Tutte le categorie"
                        emptyText="Nessuna categoria trovata"
                      />
                      <p className="text-xs text-muted-foreground">
                        Lascia vuoto per includere tutte le categorie.
                      </p>
                    </div>
                  )}

                  {reportType === 'report_customer_sales' && (
                    <div className="grid gap-1 min-w-0">
                      <Label>
                        Cliente <span className="text-destructive">*</span>
                      </Label>
                      <SingleCombobox
                        endpoint="/customers/list"
                        value={reportCustomer}
                        onChange={setReportCustomer}
                        placeholder="Cerca cliente…"
                        emptyText="Nessun cliente trovato"
                      />
                    </div>
                  )}

                  {reportType === 'report_cashflow' && (
                    <div className="flex items-center gap-3">
                      <Switch
                        id="include-incomes"
                        checked={reportIncludeIncomes}
                        onCheckedChange={setReportIncludeIncomes}
                      />
                      <label htmlFor="include-incomes" className="text-sm cursor-pointer select-none">
                        Includi entrate extra nel flusso di cassa
                      </label>
                    </div>
                  )}

                  {/* Format */}
                  <div className="grid gap-1 min-w-0">
                    <Label>Formato</Label>
                    <Select value={reportFormat} onValueChange={(v) => setReportFormat(v as ExportFormat)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((f) => (
                          <SelectItem key={f} value={f}>{FORMAT_LABELS[f]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Excel (XLSX) consigliato per i report.
                    </p>
                  </div>

                  {reportFormError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{reportFormError}</p>
                  )}
                </div>

                <DialogFooter className="mt-4 flex flex-row flex-wrap items-center justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="outline">Annulla</Button>
                  </DialogClose>
                  <Button onClick={startReportExport} disabled={reportStarting}>
                    {reportStarting ? 'Avvio…' : 'Avvia export'}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <CardContent className="overflow-x-auto">
          {loading && rows.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-5/6" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessun export. Avvia un nuovo export con il pulsante in alto.
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="max-w-[180px]">Entità</TableHead>
                    <TableHead>Formato</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Creato il</TableHead>
                    <TableHead className="w-10 text-right">Azione</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((job) => {
                    const from = fmtDate(job.start_date);
                    const to = fmtDate(job.end_date);
                    const periodo =
                      from || to
                        ? [from, to].filter(Boolean).join(' → ')
                        : '—';

                    return (
                      <TableRow key={job.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {job.id}
                        </TableCell>
                        <TableCell className="font-medium max-w-[180px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate cursor-default">
                                  {job.entity_types
                                    .filter((e) => e !== 'order_items')
                                    .map((e) => getEntityLabel(e))
                                    .join(', ')}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <ul>
                                  {job.entity_types
                                    .filter((e) => e !== 'order_items')
                                    .map((e) => (
                                      <li key={e}>{getEntityLabel(e)}</li>
                                    ))}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>{FORMAT_LABELS[job.format]}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {periodo}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {fmtDateTime(job.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {job.status === 'completed' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={downloading === job.id}
                                  onClick={() => downloadJob(job)}
                                  aria-label="Scarica file"
                                >
                                  <DownloadIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Scarica</TooltipContent>
                            </Tooltip>
                          )}
                          {job.status === 'failed' && job.error_message && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  role="img"
                                  aria-label="Errore export"
                                  tabIndex={0}
                                  className="inline-flex h-8 w-8 cursor-default select-none items-center justify-center rounded text-sm font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  !
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[260px] whitespace-pre-wrap">
                                {job.error_message}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <PaginationControls
                page={page}
                size={size}
                total={total}
                onPrev={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
                onSizeChange={(s) => {
                  setSize(s);
                  setPage(1);
                }}
                disabled={loading}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
