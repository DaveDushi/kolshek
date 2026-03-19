import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./hooks/use-theme";
import { useTokenAuth } from "./hooks/use-token-auth";
import { AppShell } from "./components/layout/app-shell";
import { ErrorBoundary } from "./components/shared/error-boundary";
import { DashboardPage } from "./pages/dashboard-page";
import { TransactionsPage } from "./pages/transactions-page";
import { SpendingPage } from "./pages/spending-page";
import { TrendsPage } from "./pages/trends-page";
import { InsightsPage } from "./pages/insights-page";
import { CategoriesPage } from "./pages/categories-page";
import { TranslationsPage } from "./pages/translations-page";
import { ProvidersPage } from "./pages/providers-page";
import { CustomPage } from "./pages/custom-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  // Exchange ?token= for a session cookie via API (works through Vite proxy in dev)
  useTokenAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppShell>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/spending" element={<SpendingPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/translations" element={<TranslationsPage />} />
                <Route path="/providers" element={<ProvidersPage />} />
                <Route path="/pages/:pageId" element={<CustomPage />} />
              </Routes>
            </ErrorBoundary>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
