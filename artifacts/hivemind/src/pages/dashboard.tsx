// Simplified Dashboard

import React from 'react';
import { MarketOverview } from '../components/dashboard/MarketOverview';
import { QuickActions } from '../components/dashboard/QuickActions';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <DashboardHeader />
      <div className="max-w-7xl mx-auto space-y-8">
        <MarketOverview />
        <QuickActions />
      </div>
    </div>
  );
}
