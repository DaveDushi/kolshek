import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./hooks/use-theme";
import { useTokenAuth } from "./hooks/use-token-auth";
import { AppShell } from "./components/layout/app-shell";
import { ErrorBoundary } from "./components/shared/error-boundary";
import { Skeleton } from "./components/ui/skeleton";

// Route-level code splitting — each page loads its own chunk on navigation
const DashboardPage = lazy(() => import("./pages/dashboard-page"));
const TransactionsPage = lazy(() => import("./pages/transactions-page"));
const SpendingPage = lazy(() => import("./pages/spending-page"));
const TrendsPage = lazy(() => import("./pages/trends-page"));
const InsightsPage = lazy(() => import("./pages/insights-page"));
const CategoriesPage = lazy(() => import("./pages/categories-page"));
const TranslationsPage = lazy(() => import("./pages/translations-page"));
const ProvidersPage = lazy(() => import("./pages/providers-page"));
const CustomPage = lazy(() => import("./pages/custom-page"));
const ImportPage = lazy(() => import("./pages/import-page"));
const SchedulePage = lazy(() => import("./pages/schedule-page"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-64 rounded-xl" />
    </div>
  );
}

export function App() {
  // Exchange ?token= for a session cookie via API (works through Vite proxy in dev)
  useTokenAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppShell>
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
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
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/schedule" element={<SchedulePage />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
