// Dashboard page -- assembles all dashboard cards in a responsive grid
import { useNavigate } from "react-router";
import { LayoutDashboard } from "lucide-react";
import { useBalanceReport } from "@/hooks/use-accounts";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import { CashflowCard } from "@/components/dashboard/cashflow-card";
import { SpendingDonut } from "@/components/dashboard/spending-donut";
import { InsightsCard } from "@/components/dashboard/insights-card";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const navigate = useNavigate();
  const { data: balanceData, isLoading } = useBalanceReport();

  // balanceData is a BalanceRow[] array (not { accounts })
  const accounts = Array.isArray(balanceData) ? balanceData : [];
  const hasNoData = !isLoading && accounts.length === 0;

  if (hasNoData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <EmptyState
          icon={<LayoutDashboard />}
          title="No accounts found"
          description="Connect a bank or credit card provider to see your financial dashboard."
          action={{
            label: "Add Provider",
            onClick: () => navigate("/providers"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" />

      {/* Top row: Net Worth takes 1/3, Cashflow takes 2/3 on large screens */}
      <div className="grid gap-4 lg:grid-cols-5 stagger-children">
        <div className="animate-fade-up lg:col-span-2"><NetWorthCard /></div>
        <div className="animate-fade-up lg:col-span-3"><CashflowCard /></div>
      </div>

      {/* Bottom row: Spending and Insights side by side */}
      <div className="grid gap-4 md:grid-cols-2 stagger-children">
        <div className="animate-fade-up"><SpendingDonut /></div>
        <div className="animate-fade-up"><InsightsCard /></div>
      </div>

      {/* Recent transactions spans full width */}
      <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
        <RecentTransactions />
      </div>
    </div>
  );
}
