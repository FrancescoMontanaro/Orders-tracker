'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProductSalesCard } from './components/ProductSalesCard';
import { CustomerSalesCard } from './components/CustomerSalesCard';

/**
 * Reports page
 * - Tab selection is still driven by querystring: product_id has precedence, then customer_id.
 * - All previous behavior is preserved; the only change is improved structure and comments.
 */
export default function ReportPage() {
  const sp = useSearchParams();
  const hasProduct = !!Number(sp.get('product_id') || 0);
  const hasCustomer = !!Number(sp.get('customer_id') || 0);
  const initialTab = hasProduct ? 'product' : hasCustomer ? 'customer' : 'product';

  const [tab, setTab] = React.useState<'product' | 'customer'>(initialTab as any);

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="product">Per Prodotto</TabsTrigger>
          <TabsTrigger value="customer">Per Cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="product" className="space-y-6">
          <ProductSalesCard />
        </TabsContent>

        <TabsContent value="customer" className="space-y-6">
          <CustomerSalesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}