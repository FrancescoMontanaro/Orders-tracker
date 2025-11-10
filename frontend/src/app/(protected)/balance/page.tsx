'use client';

import * as React from 'react';
import ExpensesCard from './components/ExpensesCard';
import ExpensesCategoriesCard from './components/CategoriesCard';
import IncomesCard from './components/IncomesCard';
import IncomesCategoriesCard from './components/IncomesCategoriesCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type SectionConfig = {
  value: 'expenses' | 'incomes';
  label: string;
  description: string;
  Icon: LucideIcon;
  Summary: React.ComponentType;
  Categories: React.ComponentType;
};

const SECTION_CONFIG: SectionConfig[] = [
  {
    value: 'expenses',
    label: 'Uscite',
    description: 'Gestisci movimenti e categorie delle uscite',
    Icon: TrendingDown,
    Summary: ExpensesCard,
    Categories: ExpensesCategoriesCard,
  },
  {
    value: 'incomes',
    label: 'Entrate',
    description: 'Monitora entrate e relative categorie',
    Icon: TrendingUp,
    Summary: IncomesCard,
    Categories: IncomesCategoriesCard,
  },
];

export default function BalancePage() {
  return (
    <div className="space-y-8">
      <Tabs defaultValue="expenses" className="w-full space-y-8">
        <TabsList className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-1 rounded-2xl border bg-muted/60 p-1 !h-auto items-stretch sm:grid-cols-2 sm:auto-rows-fr">
          {SECTION_CONFIG.map(({ value, label, description, Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex min-h-[60px] flex-col gap-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                {label}
              </div>
              <p className="text-xs text-muted-foreground leading-tight">{description}</p>
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTION_CONFIG.map(({ value, Summary, Categories }) => (
          <TabsContent key={value} value={value} className="space-y-6">
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="flex flex-wrap justify-center gap-3 rounded-full border bg-muted/40 p-1">
                <TabsTrigger value="summary" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow">
                  Riepilogo
                </TabsTrigger>
                <TabsTrigger value="categories" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow">
                  Categorie
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                <Summary />
              </TabsContent>

              <TabsContent value="categories" className="mt-4">
                <Categories />
              </TabsContent>
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
