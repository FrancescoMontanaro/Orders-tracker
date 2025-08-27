'use client';

import * as React from 'react';
import DailySummaryCard from './components/DailySummaryCard';
import CashflowCard from './components/CashflowCard';
import CalendarCard from './components/CalendarCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function HomePage() {
  // Renders three feature cards inside tabs: Daily summary, Calendar and Cashflow.
  // UI strings remain in Italian; code comments are in English.
  return (
    <div className="space-y-6">
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="flex justify-center gap-4">
          <TabsTrigger value="daily">Riepilogo</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <DailySummaryCard />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarCard />
        </TabsContent>

        <TabsContent value="cashflow" className="mt-4">
          <CashflowCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}