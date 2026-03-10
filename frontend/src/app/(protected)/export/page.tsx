'use client';

import * as React from 'react';
import { DownloadIcon, PlusIcon, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  type ExportEntity,
  type ExportFormat,
  type ExportJob,
  type ExportJobStart,
  ENTITY_LABELS,
  FORMAT_LABELS,
  STATUS_LABELS,
  SELECTABLE_ENTITIES,
} from './types/export';

const FORMAT_OPTIONS: ExportFormat[] = ['xlsx', 'csv'];

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
  const { rows, total, page, size, loading, error, setPage, setSize, refetch } =
    useExportJobs();

  // New export dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [entityTypes, setEntityTypes] = React.useState<ExportEntity[]>(['orders']);
  const [format, setFormat] = React.useState<ExportFormat>('xlsx');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [starting, setStarting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

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
      setStartDate('');
      setEndDate('');
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

  const isAllCsv = false; // kept for reference, no longer needed

  return (
    <TooltipProvider>
      <Card className="max-w-full">
        <CardHeader className="space-y-4">
          {/* Title + actions row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-lg">Export dati</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => { setFormError(null); setDialogOpen(true); }}>
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
            if (!v) { setFormError(null); setStartDate(''); setEndDate(''); }
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem]">
            <DialogHeader>
              <DialogTitle>Nuovo export</DialogTitle>
            </DialogHeader>

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
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as ExportFormat)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FORMAT_LABELS[f]}
                      </SelectItem>
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
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Da data"
                  className="w-full"
                />
              </div>

              <div className="grid gap-1 min-w-0">
                <Label>Data fine (opzionale)</Label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="A data"
                  className="w-full"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter className="mt-2 flex flex-row flex-wrap items-center justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Annulla</Button>
              </DialogClose>
              <Button onClick={startExport} disabled={starting}>
                {starting ? 'Avvio…' : 'Avvia export'}
              </Button>
            </DialogFooter>
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
                          <span className="block truncate" title={job.entity_types
                            .filter((e) => e !== 'order_items')
                            .map((e) => ENTITY_LABELS[e] ?? e)
                            .join(', ')}>
                          {job.entity_types
                            .filter((e) => e !== 'order_items')
                            .map((e) => ENTITY_LABELS[e] ?? e)
                            .join(', ')}
                          </span>
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
