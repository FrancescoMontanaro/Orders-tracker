import { api } from '@/lib/api-client';

/** Download the DDT PDF for a given order and trigger a browser save. */
export async function downloadDdt(
  orderId: number | string,
  onError: (msg: string) => void,
): Promise<void> {
  try {
    const response = await api.get(`/orders/${orderId}/ddt`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ddt_ordine_${orderId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    const detail =
      e?.response?.data?.detail ??
      e?.response?.data?.message ??
      e?.message ??
      'Errore sconosciuto';
    onError('Download DDT non riuscito: ' + String(detail));
  }
}
