import React from 'react';
import { useGetMarketPrices } from '@workspace/api-client-react';

export default function Dashboard() {
  const { data: prices, isLoading, error } = useGetMarketPrices();

  // Debug error for development
  React.useEffect(() => {
    if (error) {
      console.error('Market prices error:', error);
    }
  }, [error]);

  const btcPrice = prices?.find(p => p.symbol === 'BTC')?.price;
  const ethPrice = prices?.find(p => p.symbol === 'ETH')?.price;

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Hivemind Dashboard</h1>
        <p className="text-muted-foreground mt-2">Real-time market intelligence + AI predictions</p>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="text-sm text-muted-foreground">BTC</h3>
          <div className="text-3xl font-mono font-semibold">
            {isLoading ? '...' : error ? 'Error' : `$${btcPrice?.toLocaleString() || 'N/A'}`}
          </div>
          <div className="text-green-500 text-sm">Live</div>
        </div>
        <div className="bg-card p-6 rounded-xl border">
          <h3 className="text-sm text-muted-foreground">ETH</h3>
          <div className="text-3xl font-mono font-semibold">
            {isLoading ? '...' : error ? 'Error' : `$${ethPrice?.toLocaleString() || 'N/A'}`}
          </div>
          <div className="text-green-500 text-sm">Live</div>
        </div>
        {/* Add more cards similarly */}
      </div>

      {/* Lattice Section */}
      <div className="bg-card p-6 rounded-xl border">
        <h2 className="text-2xl font-semibold mb-4">Predictive Lattice (HPL-HPA)</h2>
        <p className="text-muted-foreground">Multi-agent reasoning engine running...</p>
      </div>

      <div className="text-center text-sm text-muted-foreground mt-12">
        More components coming soon — this is a working placeholder
      </div>
    </div>
  );
}
