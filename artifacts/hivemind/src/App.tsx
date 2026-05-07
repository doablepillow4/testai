import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Simulator from "@/pages/simulator";
import Intelligence from "@/pages/geopolitics";
import Lattice from "@/pages/lattice";
import { Layout } from "@/components/layout/layout";
import { ErrorBoundary } from "@/components/error-boundary";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) {
        const msg = error instanceof Error ? error.message : "Failed to refresh data";
        toast.error("Data refresh failed", { description: msg });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Request failed";
      toast.error(msg);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 3,
      retryDelay: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/lattice" component={Lattice} />
        <Route path="/simulator" component={Simulator} />
        <Route path="/intelligence" component={Intelligence} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
        <SonnerToaster position="bottom-right" theme="dark" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
