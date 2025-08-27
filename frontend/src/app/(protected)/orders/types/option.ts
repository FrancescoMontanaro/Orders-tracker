// Generic "option" used by comboboxes (customers and products).

export type Option = {
  id: number;
  name: string;
  unit_price?: number | null; // Present only for product options
  unit?: string | null;       // Present only for product options
};