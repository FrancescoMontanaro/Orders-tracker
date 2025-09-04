'use client';

import * as React from 'react';
import ExpensesCard from './components/ExpensesCard';
import ExpensesCategoriesCard from './components/CategoriesCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="flex justify-center gap-4">
          <TabsTrigger value="daily">Riepilogo</TabsTrigger>
          <TabsTrigger value="calendar">Categorie</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <ExpensesCard />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ExpensesCategoriesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}