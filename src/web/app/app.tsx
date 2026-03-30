import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./hooks/use-theme";
import { useTokenAuth } from "./hooks/use-token-auth";
import { AppShell } from "./components/layout/app-shell";
import { ErrorBoundary } from "./components/shared/error-boundary";
import { Skeleton } from "./components/ui/skeleton";

// Route-level code splitting — each page loads its own chunk on navigation
const DashboardPage = lazy(() => import("./pages/dashboard-page").then(m => ({ default: m.DashboardPage })));
const TransactionsPage = lazy(() => import("./pages/transactions-page").then(m => ({ default: m.TransactionsPage })));
const SpendingPage = lazy(() => import("./pages/spending-page").then(m => ({ default: m.SpendingPage })));
const TrendsPage = lazy(() => import("./pages/trends-page").then(m => ({ default: m.TrendsPage })));
const InsightsPage = lazy(() => import("./pages/insights-page").then(m => ({ default: m.InsightsPage })));
const CategoriesPage = lazy(() => import("./pages/categories-page").then(m => ({ default: m.CategoriesPage })));
const TranslationsPage = lazy(() => import("./pages/translations-page").then(m => ({ default: m.TranslationsPage })));
const ProvidersPage = lazy(() => import("./pages/providers-page").then(m => ({ default: m.ProvidersPage })));
const CustomPage = lazy(() => import("./pages/custom-page").then(m => ({ default: m.CustomPage })));
const ImportPage = lazy(() => import("./pages/import-page").then(m => ({ default: m.ImportPage })));
const SchedulePage = lazy(() => import("./pages/schedule-page").then(m => ({ default: m.SchedulePage })));

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
